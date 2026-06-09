"""
segment_service — business logic for previewing an audience from a filter.

Flow:  raw filter  --validate-->  compile to Select  --execute-->  count + sample
                                                                   (with derived
                                                                    spend/recency)

Routers call this; they never touch the validator/compiler directly. That keeps
the HTTP layer thin and the segmentation logic unit-testable in isolation.
"""

from __future__ import annotations

from sqlalchemy import func
from sqlmodel import Session, select

from app.lib.segment_compiler import compile_segment
from app.lib.segment_validator import validate_segment
from app.models import Customer, Order
from app.schemas import CustomerSummary, SegmentPreviewResponse

# How many example customers to return in a preview.
SAMPLE_SIZE = 10


def _derived_metrics(session: Session, customer_ids: list[int]) -> dict[int, dict]:
    """Fetch total_spend / order_count / last_order_at for a set of customers in
    one grouped query (avoids N+1 round-trips when building the sample)."""
    if not customer_ids:
        return {}
    rows = session.exec(
        select(
            Order.customer_id,
            func.coalesce(func.sum(Order.amount), 0),
            func.count(Order.id),
            func.max(Order.created_at),
        )
        .where(Order.customer_id.in_(customer_ids))
        .group_by(Order.customer_id)
    ).all()
    metrics = {
        cid: {"total_spend": float(spend or 0), "order_count": int(cnt or 0),
              "last_order_at": last}
        for cid, spend, cnt, last in rows
    }
    # Customers with no orders won't appear in `rows`; fill defaults.
    for cid in customer_ids:
        metrics.setdefault(
            cid, {"total_spend": 0.0, "order_count": 0, "last_order_at": None}
        )
    return metrics


def preview_segment(session: Session, raw_filter: dict) -> SegmentPreviewResponse:
    """Validate + compile a filter, then return audience count and a sample.

    Raises SegmentValidationError (caught by the router → 400) on a bad filter.
    """
    validated = validate_segment(raw_filter)
    base_stmt = compile_segment(validated)

    # COUNT: wrap the compiled select in a count over the customer id. We count
    # the subquery so all the JOIN/WHERE logic is reused exactly.
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    count = session.exec(count_stmt).one()

    # SAMPLE: take up to SAMPLE_SIZE customers from the same compiled query.
    sample_customers = session.exec(base_stmt.limit(SAMPLE_SIZE)).all()
    metrics = _derived_metrics(session, [c.id for c in sample_customers])

    sample = [
        CustomerSummary(
            id=c.id,
            name=c.name,
            email=c.email,
            city=c.city,
            tags=c.tags,
            total_spend=metrics[c.id]["total_spend"],
            order_count=metrics[c.id]["order_count"],
            last_order_at=metrics[c.id]["last_order_at"],
        )
        for c in sample_customers
    ]
    return SegmentPreviewResponse(count=count, sample=sample)


def resolve_segment_customers(session: Session, raw_filter: dict) -> list[Customer]:
    """Resolve a filter to the FULL list of matching Customer rows.

    Used by the send flow (Milestone 4) to fan a campaign out to its audience.
    Kept here so validation+compilation live in exactly one place.
    """
    validated = validate_segment(raw_filter)
    stmt = compile_segment(validated)
    return list(session.exec(stmt).all())
