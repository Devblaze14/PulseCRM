"""
ingest_service — take customers and orders into the system.

This is the one place data enters the product through the API (the other path is
the dev-only `app.seed` CLI). We insert plain Customer / Order rows exactly like
seed.py does, which is what keeps ingestion safe: spend/order_count/last_order_at
are DERIVED from the Order table at query time (see customer_service + the segment
compiler), so freshly ingested orders flow into segments, previews and stats
automatically — there are no aggregate fields to keep in sync.

Design choices:
  * Skip & report — duplicate customers (by email) are skipped, not rejected, so a
    re-run of the same batch is harmless (good for demos). Per-record problems go
    into `errors` (index-tagged, user-safe) instead of failing the whole request.
  * Commit once — we validate and stage every record in memory, then commit a
    single time at the end. Nothing is written until the whole batch is processed,
    so there are no partial-write surprises.
  * Batch cap — a hard limit guards against a giant payload exhausting memory or
    the DB connection.
"""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import Customer, Order
from app.schemas import CustomerIn, IngestResult, OrderIn

# Upper bound on records per request. Above this we reject the whole call with a
# clear error rather than trying to stage an unbounded number of rows.
MAX_BATCH = 5000

# Mirrors the order-status values seed.py emits and the model documents.
_VALID_ORDER_STATUS = {"PLACED", "DELIVERED", "RETURNED", "CANCELLED"}


def ingest_customers(session: Session, records: list[CustomerIn]) -> IngestResult:
    """Insert new customers; skip any whose email already exists (in the DB or
    earlier in this same batch). Returns a {created, skipped, errors} summary."""
    if len(records) > MAX_BATCH:
        return IngestResult(
            created=0,
            skipped=0,
            errors=[f"batch too large: {len(records)} > {MAX_BATCH} max per request"],
        )

    # One query for all existing emails, then dedup in memory (avoids N queries).
    existing_emails: set[str] = set(session.exec(select(Customer.email)).all())

    created = 0
    skipped = 0
    errors: list[str] = []
    seen_in_batch: set[str] = set()

    for i, rec in enumerate(records):
        email = rec.email.strip().lower()
        if not email:
            errors.append(f"customers[{i}]: missing email")
            continue
        if email in existing_emails or email in seen_in_batch:
            skipped += 1
            continue
        session.add(
            Customer(
                name=rec.name,
                email=rec.email,
                phone=rec.phone,
                city=rec.city,
                tags=rec.tags,
            )
        )
        seen_in_batch.add(email)
        created += 1

    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        return IngestResult(
            created=0, skipped=skipped, errors=[f"database rejected the batch: {type(e).__name__}"]
        )

    return IngestResult(created=created, skipped=skipped, errors=errors)


def ingest_orders(session: Session, records: list[OrderIn]) -> IngestResult:
    """Insert orders whose customer_id exists. Orders referencing an unknown
    customer, a negative amount, or an unknown status are reported in `errors`
    and skipped (never inserted as orphans). Returns a {created, skipped, errors}
    summary."""
    if len(records) > MAX_BATCH:
        return IngestResult(
            created=0,
            skipped=0,
            errors=[f"batch too large: {len(records)} > {MAX_BATCH} max per request"],
        )

    # One query for all valid customer ids; membership checks are then in-memory.
    valid_ids: set[int] = set(session.exec(select(Customer.id)).all())

    created = 0
    skipped = 0
    errors: list[str] = []

    for i, rec in enumerate(records):
        if rec.customer_id not in valid_ids:
            errors.append(f"orders[{i}]: customer_id {rec.customer_id} not found")
            skipped += 1
            continue
        if rec.amount < 0:
            errors.append(f"orders[{i}]: amount must be >= 0 (got {rec.amount})")
            skipped += 1
            continue
        status = rec.status.upper()
        if status not in _VALID_ORDER_STATUS:
            errors.append(
                f"orders[{i}]: status '{rec.status}' must be one of {sorted(_VALID_ORDER_STATUS)}"
            )
            skipped += 1
            continue
        session.add(
            Order(
                customer_id=rec.customer_id,
                amount=rec.amount,
                items=rec.items,
                status=status,
            )
        )
        created += 1

    try:
        session.commit()
    except IntegrityError as e:
        session.rollback()
        return IngestResult(
            created=0, skipped=skipped, errors=[f"database rejected the batch: {type(e).__name__}"]
        )

    return IngestResult(created=created, skipped=skipped, errors=errors)
