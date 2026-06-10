"""
The structured segment-filter schema — the contract between the AI and the DB.

The LLM never writes SQL. It emits a small JSON document in THIS shape, which we
validate against a strict whitelist and then compile into a parameterized query.

Grammar (intentionally minimal so it is easy to validate and explain):

    Filter      := { "all": [Condition, ...] }            # AND of conditions
                 | { "any": [Condition, ...] }            # OR of conditions
    Condition   := { "field": <FIELD>, "op": <OP>, "value": <scalar> }

We support ONE level of all/any (no arbitrary nesting). That covers the vast
majority of marketing segments ("lapsed AND high-spend") while keeping the
validator and compiler trivial to reason about and inject-safe.

Allowed fields fall into two groups:
  * Direct customer columns: city, tags, created_at.
  * Derived (aggregated from Order at query time): total_spend, order_count,
    last_order_at. The compiler computes these via subqueries — they are not
    stored, so they can never go stale.

Date values support relative tokens like "30d_ago" / "6m_ago" so the AI can
express recency without inventing absolute timestamps.
"""

from __future__ import annotations

# Each field maps to its semantic type, which constrains the operators and the
# value coercion the compiler applies.
FIELD_TYPES: dict[str, str] = {
    "city": "string",
    "tags": "string_list",        # membership test against the JSON tags array
    "created_at": "date",         # when the customer signed up
    "total_spend": "number",      # SUM(order.amount)
    "order_count": "number",      # COUNT(order.id)
    "last_order_at": "date",      # MAX(order.created_at)
}

# Which fields require aggregating the Order table.
DERIVED_FIELDS = {"total_spend", "order_count", "last_order_at"}

# Operators allowed per semantic type. Anything outside these is rejected.
OPERATORS_BY_TYPE: dict[str, set[str]] = {
    "string": {"eq", "neq", "in"},
    "string_list": {"contains", "not_contains"},  # does tags array contain X?
    "number": {"eq", "neq", "gt", "gte", "lt", "lte"},
    "date": {"before", "after", "on_or_before", "on_or_after"},
}

# Top-level boolean combinators we accept.
COMBINATORS = {"all", "any"}
