"""
customer_service — list customers with their derived metrics for the UI table.

Reuses the same derived-aggregate approach as segments (spend/order_count/
last_order_at computed from Order), via a LEFT JOIN so zero-order customers
still appear. Supports a simple search across name/email/city.
"""

from __future__ import annotations

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.models import Customer, Order
from app.schemas import CustomerSummary


def list_customers(
    session: Session, search: str | None = None, limit: int = 500
) -> list[CustomerSummary]:
    # Per-customer aggregates.
    agg = (
        select(
            Order.customer_id.label("cid"),
            func.coalesce(func.sum(Order.amount), 0).label("spend"),
            func.count(Order.id).label("orders"),
            func.max(Order.created_at).label("last"),
        )
        .group_by(Order.customer_id)
        .subquery()
    )

    stmt = (
        select(
            Customer,
            func.coalesce(agg.c.spend, 0),
            func.coalesce(agg.c.orders, 0),
            agg.c.last,
        )
        .join(agg, agg.c.cid == Customer.id, isouter=True)
        .order_by(func.coalesce(agg.c.spend, 0).desc())  # biggest spenders first
        .limit(limit)
    )

    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(like),
                Customer.email.ilike(like),
                Customer.city.ilike(like),
            )
        )

    rows = session.exec(stmt).all()
    return [
        CustomerSummary(
            id=c.id,
            name=c.name,
            email=c.email,
            city=c.city,
            tags=c.tags,
            total_spend=float(spend or 0),
            order_count=int(orders or 0),
            last_order_at=last,
        )
        for c, spend, orders, last in rows
    ]
