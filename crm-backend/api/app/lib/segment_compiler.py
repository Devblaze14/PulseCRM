"""
segment_compiler — turns a VALIDATED filter into a parameterized SQLAlchemy query.

Why this matters (interview talking points):
  * We NEVER build SQL by string concatenation. Every value flows in as a bound
    parameter through SQLAlchemy expression objects, so injection is impossible
    by construction — even though the AI produced the input.
  * Derived fields (total_spend, order_count, last_order_at) are computed from
    the Order table via a single grouped subquery that we LEFT JOIN onto
    Customer. LEFT JOIN (not INNER) so customers with zero orders still appear,
    with NULL aggregates — important for "never ordered" style segments.
  * The output is a SQLAlchemy Select over Customer that the service layer can
    execute, count, or limit for the preview.

Relative date tokens ("30d_ago", "6m_ago", "1y_ago") are resolved to concrete
UTC datetimes here, so the compiler is the single place time is interpreted.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import Text, and_, func, or_
from sqlalchemy.sql import ColumnElement
from sqlmodel import select
from sqlmodel.sql.expression import Select, SelectOfScalar

from app.lib.segment_schema import DERIVED_FIELDS
from app.models import Customer, Order


# --------------------------------------------------------------------------- #
#  Date token resolution
# --------------------------------------------------------------------------- #
def _resolve_date(value: str) -> datetime:
    """Resolve a relative token or ISO string to a tz-aware UTC datetime."""
    now = datetime.now(timezone.utc)
    if value.endswith("d_ago"):
        return now - timedelta(days=int(value[:-len("d_ago")]))
    if value.endswith("m_ago"):
        # Approximate a month as 30 days — fine for marketing recency buckets.
        return now - timedelta(days=30 * int(value[:-len("m_ago")]))
    if value.endswith("y_ago"):
        return now - timedelta(days=365 * int(value[:-len("y_ago")]))
    # Otherwise treat as ISO date/datetime.
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# --------------------------------------------------------------------------- #
#  Derived-aggregate subquery
# --------------------------------------------------------------------------- #
# Built once at import: per-customer SUM(amount), COUNT(*), MAX(created_at).
# Referencing its columns below lets us filter on derived fields.
_agg = (
    select(
        Order.customer_id.label("customer_id"),
        func.coalesce(func.sum(Order.amount), 0).label("total_spend"),
        func.count(Order.id).label("order_count"),
        func.max(Order.created_at).label("last_order_at"),
    )
    .group_by(Order.customer_id)
    .subquery()
)

# Map each filterable field name to the concrete SQL column expression.
_FIELD_COLUMNS: dict[str, ColumnElement] = {
    "city": Customer.city,
    "created_at": Customer.created_at,
    "total_spend": _agg.c.total_spend,
    "order_count": _agg.c.order_count,
    "last_order_at": _agg.c.last_order_at,
    # tags handled specially below (JSON membership), not via a plain column.
}


def _compile_condition(field: str, op: str, value) -> ColumnElement:
    """Compile a single validated condition into a SQLAlchemy boolean expression."""

    # --- tags: JSON-array membership -------------------------------------
    if field == "tags":
        # Portable membership test: does the JSON tags array contain `value`?
        # We cast the JSON to text and LIKE for the quoted tag. This works on
        # both SQLite and Postgres without dialect-specific JSON operators.
        # (At real Postgres scale you'd use `tags @> '["x"]'` with a GIN index;
        # noted in the README as a deliberate simplification.)
        needle = f'%"{value}"%'
        col = func.cast(Customer.tags, Text)
        return col.like(needle) if op == "contains" else ~col.like(needle)

    col = _FIELD_COLUMNS[field]

    # --- numbers ----------------------------------------------------------
    if op == "eq":
        return col == value
    if op == "neq":
        return col != value
    if op == "gt":
        return col > value
    if op == "gte":
        return col >= value
    if op == "lt":
        return col < value
    if op == "lte":
        return col <= value

    # --- strings ----------------------------------------------------------
    if op == "in":
        return col.in_(value)

    # --- dates ------------------------------------------------------------
    if op in {"before", "after", "on_or_before", "on_or_after"}:
        dt = _resolve_date(value)
        if op == "before":
            return col < dt
        if op == "after":
            return col > dt
        if op == "on_or_before":
            return col <= dt
        return col >= dt  # on_or_after

    # Should never reach here — the validator guarantees op/field compatibility.
    raise ValueError(f"Uncompilable condition: {field} {op} {value!r}")


def _needs_agg_join(validated: dict) -> bool:
    """Only LEFT JOIN the aggregate subquery if a derived field is referenced —
    keeps simple city/tag segments cheap."""
    conditions = next(iter(validated.values()))
    return any(c["field"] in DERIVED_FIELDS for c in conditions)


def compile_segment(validated: dict) -> SelectOfScalar[Customer]:
    """Compile a validated filter into a `select(Customer)` with WHERE applied.

    Returns a SQLModel Select the caller can further `.limit()` or wrap in a
    count. All user/AI values are bound parameters — no string interpolation.
    """
    combinator, conditions = next(iter(validated.items()))

    clauses = [
        _compile_condition(c["field"], c["op"], c["value"]) for c in conditions
    ]
    where = and_(*clauses) if combinator == "all" else or_(*clauses)

    stmt: Select = select(Customer)
    if _needs_agg_join(validated):
        # LEFT OUTER so zero-order customers are retained (NULL aggregates).
        stmt = stmt.join(
            _agg, _agg.c.customer_id == Customer.id, isouter=True
        )
    return stmt.where(where)
