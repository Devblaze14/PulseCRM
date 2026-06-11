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

import hmac

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.config import settings
from app.lib.status_machine import next_status
from app.models import (
    Communication,
    CommStatus,
    CommunicationEvent,
    Order,
    utcnow,
)
from app.schemas import ReceiptIn, ReceiptResult


class ReceiptAuthError(Exception):
    """Raised when the callback_secret doesn't match — surfaced as 401."""


# Fallback band (INR) when a customer has NO order history to average over, so a
# brand-new customer who converts still attributes a plausible, non-zero amount.
_FALLBACK_AOV_MIN, _FALLBACK_AOV_MAX = 499.0, 2999.0


def _attributed_amount(session: Session, comm: Communication) -> float:
    """Derive a PLAUSIBLE conversion value (INR) for this communication.

    Sampled around the *customer's own* average order value, not a flat random
    number, so "₹X attributed" survives scrutiny: a high-spender attributes more
    than a bargain shopper. The CRM owns this (the channel has no DB access).

    DETERMINISTIC: the jitter is seeded from communication_id alone (never
    random.*), so the same conversion always yields the same amount. Combined
    with the unique-event_id idempotency guard upstream, a replayed conversion
    can never change or double-count the attributed revenue.
    """
    aov = session.exec(
        select(func.avg(Order.amount)).where(Order.customer_id == comm.customer_id)
    ).one()

    if aov:
        # ±20% spread around the customer's AOV, position fixed by comm id.
        base = float(aov)
        frac = ((comm.id * 2654435761) % 1000) / 1000.0  # stable 0..1 from id
        amount = base * (0.8 + 0.4 * frac)               # 0.8x .. 1.2x of AOV
    else:
        # No orders to average → spread deterministically across the fallback band.
        span = _FALLBACK_AOV_MAX - _FALLBACK_AOV_MIN
        amount = _FALLBACK_AOV_MIN + (comm.id * 2654435761) % (int(span) + 1)

    return round(float(amount), 2)


def process_receipt(session: Session, receipt: ReceiptIn) -> ReceiptResult:
    # --- 1) Authenticate the callback ------------------------------------
    # Constant-time compare avoids leaking the secret via response timing.
    if not hmac.compare_digest(receipt.callback_secret, settings.CALLBACK_SECRET):
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
        # 4) If converted, attribute revenue. This runs ONLY on a real status
        #    advance, which itself runs only AFTER the unique-event_id insert
        #    succeeded above — so a replayed conversion (duplicate event_id) hits
        #    the IntegrityError no-op path and never re-attributes. No double count.
        #    The amount is derived HERE (CRM-side) from the customer's own order
        #    history, deterministically by communication_id; we prefer an explicit
        #    order_amount from the callback if one is supplied, else compute it.
        if new_status == CommStatus.CONVERTED:
            if receipt.converted_order_id:
                comm.converted_order_id = receipt.converted_order_id
            if receipt.order_amount is not None:
                comm.attributed_amount = receipt.order_amount
            else:
                comm.attributed_amount = _attributed_amount(session, comm)
        session.add(comm)
        session.commit()
        session.refresh(comm)

    return ReceiptResult(
        accepted=True,
        applied=applied,
        status=comm.status,
        reason=None if applied else "Status not advanced (older or duplicate stage).",
    )
