"""
The five focused tests for the attribution + rationale features.

Scope is deliberately the *portable* logic — status machine, idempotency dedup,
revenue aggregation, and the segment validator — so SQLite-in-memory is a faithful
stand-in for Postgres here. Anything that only holds on Postgres (JSON operators,
etc.) is intentionally out of scope and noted rather than faked.

  1. idempotent replay: same conversion event id twice -> revenue counted once.
  2. out-of-order: a higher-rank status arriving before a lower one -> status
     never regresses.
  3. attributed_amount sums correctly into campaign attributed_revenue.
  4. rationale-missing graceful path: AI output without rationale -> still works.
  5. validator rejects an unknown filter field (the gate still holds).
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.config import settings
from app.lib.segment_validator import SegmentValidationError, validate_segment
from app.models import (
    Campaign,
    CampaignStatus,
    Channel,
    Communication,
    CommStatus,
    Customer,
    Order,
)
from app.schemas import ReceiptIn
from app.services import stats_service
from app.services.ai_service import _split_filter_and_rationale
from app.services.receipt_service import process_receipt


# --------------------------------------------------------------------------- #
#  Helpers
# --------------------------------------------------------------------------- #
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_campaign_with_comm(
    session, *, with_orders: list[float] | None = None
) -> Communication:
    """Create a customer (optionally with order history), a campaign, and one
    Communication advanced to CLICKED so a CONVERTED event is the next legal step."""
    cust = Customer(name="Asha Rao", email="asha@example.com", phone="9000000000",
                    city="Mumbai", tags=[])
    session.add(cust)
    session.commit()
    session.refresh(cust)

    for amt in (with_orders or []):
        session.add(Order(customer_id=cust.id, amount=amt, items=[], status="PLACED"))
    session.commit()

    campaign = Campaign(
        name="Win-back", goal="win back lapsed", channel=Channel.WHATSAPP,
        segment_definition={"all": []}, message_template="Hi {name}",
        status=CampaignStatus.SENT,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    comm = Communication(
        campaign_id=campaign.id, customer_id=cust.id, channel=Channel.WHATSAPP,
        rendered_message="Hi Asha", status=CommStatus.CLICKED,
    )
    session.add(comm)
    session.commit()
    session.refresh(comm)
    return comm


def _conversion_receipt(comm_id: int, event_id: str) -> ReceiptIn:
    """A CONVERTED callback with no explicit amount (CRM derives it from AOV)."""
    return ReceiptIn(
        communication_id=comm_id,
        event_type="CONVERTED",
        event_id=event_id,
        occurred_at=_now(),
        callback_secret=settings.CALLBACK_SECRET,
    )


# --------------------------------------------------------------------------- #
#  1) Idempotent replay: same conversion event id twice -> revenue once.
# --------------------------------------------------------------------------- #
def test_idempotent_conversion_replay_counts_revenue_once(session):
    comm = _seed_campaign_with_comm(session, with_orders=[1000.0, 2000.0])

    first = process_receipt(session, _conversion_receipt(comm.id, "evt-conv-1"))
    assert first.applied is True
    assert first.status == CommStatus.CONVERTED

    session.refresh(comm)
    amount_after_first = comm.attributed_amount
    assert amount_after_first is not None and amount_after_first > 0

    # Replay the EXACT same event_id — the unique-event_id guard must no-op it.
    replay = process_receipt(session, _conversion_receipt(comm.id, "evt-conv-1"))
    assert replay.applied is False
    assert "Duplicate" in (replay.reason or "")

    session.refresh(comm)
    # Amount unchanged: not doubled, not re-derived.
    assert comm.attributed_amount == amount_after_first

    stats = stats_service.compute_stats(session, comm.campaign_id)
    assert stats.converted == 1
    assert stats.attributed_revenue == pytest.approx(amount_after_first)


# --------------------------------------------------------------------------- #
#  2) Out-of-order: a higher-rank status arriving before a lower one ->
#     status never regresses.
# --------------------------------------------------------------------------- #
def test_out_of_order_status_never_regresses(session):
    comm = _seed_campaign_with_comm(session)
    # Reset to a fresh QUEUED so we can drive the sequence ourselves.
    comm.status = CommStatus.QUEUED
    session.add(comm)
    session.commit()

    def post(event_type: str, event_id: str):
        return process_receipt(session, ReceiptIn(
            communication_id=comm.id, event_type=event_type, event_id=event_id,
            occurred_at=_now(), callback_secret=settings.CALLBACK_SECRET,
        ))

    # CLICKED arrives first (the later stage), then a delayed OPENED (earlier).
    post("CLICKED", "evt-clicked")
    session.refresh(comm)
    assert comm.status == CommStatus.CLICKED

    res = post("OPENED", "evt-opened")
    assert res.applied is False  # earlier rank: ignored
    session.refresh(comm)
    assert comm.status == CommStatus.CLICKED  # never rolled back

    # And a later CONVERTED still advances normally.
    post("CONVERTED", "evt-conv")
    session.refresh(comm)
    assert comm.status == CommStatus.CONVERTED


# --------------------------------------------------------------------------- #
#  3) attributed_amount sums correctly into campaign attributed_revenue.
# --------------------------------------------------------------------------- #
def test_attributed_amounts_sum_into_campaign_revenue(session):
    # One campaign, three communications, two of which convert.
    cust = Customer(name="B", email="b@x.com", phone="9", city="Pune", tags=[])
    session.add(cust)
    session.commit()
    session.refresh(cust)

    campaign = Campaign(
        name="C", goal="g", channel=Channel.SMS,
        segment_definition={"all": []}, message_template="Hi {name}",
        status=CampaignStatus.SENT,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    comms = []
    for _ in range(3):
        c = Communication(campaign_id=campaign.id, customer_id=cust.id,
                          channel=Channel.SMS, rendered_message="hi",
                          status=CommStatus.CLICKED)
        session.add(c)
        comms.append(c)
    session.commit()
    for c in comms:
        session.refresh(c)

    # Attribute explicit amounts on two of them (third stays unconverted -> null).
    comms[0].attributed_amount = 1500.0
    comms[0].status = CommStatus.CONVERTED
    comms[1].attributed_amount = 2500.0
    comms[1].status = CommStatus.CONVERTED
    session.add(comms[0])
    session.add(comms[1])
    session.commit()

    stats = stats_service.compute_stats(session, campaign.id)
    assert stats.converted == 2
    assert stats.attributed_revenue == pytest.approx(4000.0)

    # The unconverted/null row must not break the SUM (COALESCE -> 0 contribution).
    # And overall (campaign_id=None) sees the same total here.
    overall = stats_service.compute_stats(session, None)
    assert overall.attributed_revenue == pytest.approx(4000.0)


# --------------------------------------------------------------------------- #
#  4) Rationale-missing graceful path: AI output without rationale still works.
# --------------------------------------------------------------------------- #
def test_rationale_missing_is_graceful():
    # Wrapped shape but no rationale key.
    filt, rat = _split_filter_and_rationale({"filter": {"all": [
        {"field": "city", "op": "eq", "value": "Mumbai"}]}})
    assert rat is None
    assert validate_segment(filt) == {"all": [
        {"field": "city", "op": "eq", "value": "Mumbai"}]}

    # Legacy bare-filter shape (no wrapper, no rationale) still validates.
    filt2, rat2 = _split_filter_and_rationale({"any": [
        {"field": "order_count", "op": "gte", "value": 2}]})
    assert rat2 is None
    assert validate_segment(filt2) == {"any": [
        {"field": "order_count", "op": "gte", "value": 2}]}

    # Sibling-rationale shape: rationale peeled off, filter still clean.
    filt3, rat3 = _split_filter_and_rationale({
        "all": [{"field": "city", "op": "eq", "value": "Delhi"}],
        "rationale": "Delhi shoppers",
    })
    assert rat3 == "Delhi shoppers"
    assert validate_segment(filt3) == {"all": [
        {"field": "city", "op": "eq", "value": "Delhi"}]}


# --------------------------------------------------------------------------- #
#  5) Validator rejects an unknown filter field (the gate still holds).
# --------------------------------------------------------------------------- #
def test_validator_rejects_unknown_field():
    # An unknown field must be rejected even when a rationale was alongside it —
    # proving rationale never weakens the gate.
    filt, rationale = _split_filter_and_rationale({
        "filter": {"all": [{"field": "ssn", "op": "eq", "value": "123"}]},
        "rationale": "totally fine, trust me",
    })
    assert rationale == "totally fine, trust me"
    with pytest.raises(SegmentValidationError):
        validate_segment(filt)
