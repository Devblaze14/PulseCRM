"""
receipt_service — process one delivery callback from the channel.

This is the consumer side of the send→callback loop and must be robust to the
two hard realities of webhook ingestion:

  1. IDEMPOTENCY — the channel retries on non-2xx, so the same event_id may
     arrive more than once. We persist a CommunicationEvent with a UNIQUE
     event_id; a duplicate insert is caught and treated as a no-op. No double
     counting, ever.

  2. OUT-OF-ORDER — events can arrive in any order. We advance the
     Communication's status using the rank-based status machine, which never
     regresses. The append-only event log still records EVERY event (even late
     ones) for audit; only the derived `status` is guarded.

We return 2xx quickly so the channel doesn't needlessly retry.
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.config import settings
from app.lib.status_machine import next_status
from app.models import (
    Communication,
    CommunicationEvent,
    CommStatus,
    utcnow,
)
from app.schemas import ReceiptIn, ReceiptResult


class ReceiptAuthError(Exception):
    """Raised when the callback_secret doesn't match — surfaced as 401."""


def process_receipt(session: Session, receipt: ReceiptIn) -> ReceiptResult:
    # --- 1) Authenticate the callback ------------------------------------
    if receipt.callback_secret != settings.CALLBACK_SECRET:
        raise ReceiptAuthError("Invalid callback secret.")

    # --- validate event_type maps to a known status ----------------------
    try:
        incoming_status = CommStatus(receipt.event_type)
    except ValueError:
        # Unknown event type: ack so the channel stops retrying, but do nothing.
        return ReceiptResult(
            accepted=True, applied=False, reason="Unknown event_type."
        )

    comm = session.get(Communication, receipt.communication_id)
    if comm is None:
        return ReceiptResult(
            accepted=True, applied=False, reason="Unknown communication_id."
        )

    # --- 2) Idempotency: insert the append-only event first ---------------
    # The UNIQUE constraint on event_id is the idempotency guard. We try the
    # insert; if it collides, this exact event was already processed → no-op.
    event = CommunicationEvent(
        communication_id=comm.id,
        event_type=receipt.event_type,
        event_id=receipt.event_id,
        occurred_at=receipt.occurred_at,
        received_at=utcnow(),
        payload=receipt.model_dump(mode="json", exclude={"callback_secret"}),
    )
    session.add(event)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return ReceiptResult(
            accepted=True,
            applied=False,
            status=comm.status,
            reason="Duplicate event (idempotent no-op).",
        )

    # --- 3) Order-safe status advance ------------------------------------
    new_status = next_status(comm.status, incoming_status)
    applied = new_status != comm.status
    if applied:
        comm.status = new_status
        comm.updated_at = utcnow()
        # 4) If converted, optionally attribute the order.
        if new_status == CommStatus.CONVERTED and receipt.converted_order_id:
            comm.converted_order_id = receipt.converted_order_id
        session.add(comm)
        session.commit()
        session.refresh(comm)

    return ReceiptResult(
        accepted=True,
        applied=applied,
        status=comm.status,
        reason=None if applied else "Status not advanced (older or duplicate stage).",
    )
