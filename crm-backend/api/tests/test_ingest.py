"""
Tests for the data-ingestion service (POST /api/customers, /api/orders).

Scope is the portable invariants that matter for ingestion, so SQLite-in-memory
(the shared `session` fixture) is a faithful stand-in:

  1. bulk customer insert -> created count + rows present.
  2. duplicate email -> skipped, no second row.
  3. order with an unknown customer_id -> reported in errors, NOT inserted (no orphan).
  4. integration: an ingested order shows up in the DERIVED metrics
     (total_spend / order_count) via the existing customer_service path.
  5. a single (non-array) record is accepted by the service layer.
"""

from __future__ import annotations

from sqlmodel import select

from app.models import Customer, Order
from app.schemas import CustomerIn, OrderIn
from app.services import customer_service, ingest_service


def _ingest_two_customers(session) -> ingest_service.IngestResult:
    records = [
        CustomerIn(name="Asha Rao", email="asha@example.com", phone="9000000001",
                   city="Mumbai", tags=["vip"]),
        CustomerIn(name="Vikram Shah", email="vikram@example.com", phone="9000000002",
                   city="Delhi", tags=[]),
    ]
    return ingest_service.ingest_customers(session, records)


def test_bulk_customer_insert(session):
    result = _ingest_two_customers(session)
    assert result.created == 2
    assert result.skipped == 0
    assert result.errors == []
    assert len(session.exec(select(Customer)).all()) == 2


def test_duplicate_email_is_skipped(session):
    _ingest_two_customers(session)
    # Re-ingest the same emails (different name/phone shouldn't matter).
    again = ingest_service.ingest_customers(
        session,
        [CustomerIn(name="Asha R.", email="asha@example.com", phone="9999999999",
                    city="Pune", tags=[])],
    )
    assert again.created == 0
    assert again.skipped == 1
    # Still exactly one row for that email.
    rows = session.exec(select(Customer).where(Customer.email == "asha@example.com")).all()
    assert len(rows) == 1


def test_order_with_unknown_customer_is_reported_not_inserted(session):
    _ingest_two_customers(session)
    result = ingest_service.ingest_orders(
        session, [OrderIn(customer_id=99999, amount=500.0, items=[], status="PLACED")]
    )
    assert result.created == 0
    assert result.skipped == 1
    assert len(result.errors) == 1
    assert "99999" in result.errors[0]
    # No orphan order was written.
    assert session.exec(select(Order)).all() == []


def test_ingested_order_flows_into_derived_metrics(session):
    """The whole point: ingest a customer + order, and the existing derived-metrics
    path (customer_service) reflects it with zero extra wiring."""
    ingest_service.ingest_customers(
        session,
        [CustomerIn(name="Asha Rao", email="asha@example.com", phone="9000000001",
                    city="Mumbai", tags=[])],
    )
    cust = session.exec(select(Customer)).first()
    ingest_service.ingest_orders(
        session,
        [
            OrderIn(customer_id=cust.id, amount=1200.0, items=[], status="DELIVERED"),
            OrderIn(customer_id=cust.id, amount=800.0, items=[], status="PLACED"),
        ],
    )

    summaries = customer_service.list_customers(session)
    me = next(s for s in summaries if s.id == cust.id)
    assert me.order_count == 2
    assert me.total_spend == 2000.0
    assert me.last_order_at is not None


def test_single_record_is_accepted(session):
    """The router normalizes a single object to a one-element list; the service
    accepts a list of one just the same."""
    result = ingest_service.ingest_customers(
        session,
        [CustomerIn(name="Solo", email="solo@example.com", phone="9000000003",
                    city="Kochi", tags=[])],
    )
    assert result.created == 1
    assert session.exec(select(Customer).where(Customer.email == "solo@example.com")).first()
