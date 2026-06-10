"""
segment_validator — the security gate between AI output and the database.

The LLM (or a user) hands us a JSON filter. Before it goes anywhere near a query
we validate it against a strict whitelist: known combinator, known fields, known
operators-for-that-field-type, and value shapes that match the field type. Any
deviation raises SegmentValidationError with a human-readable reason the UI can
show. This is what lets us promise "the AI cannot do anything we didn't allow."

The validator returns a NORMALISED copy (e.g. ensures `in`/`contains` values are
the right container type) so the compiler downstream can trust its input.
"""

from __future__ import annotations

from typing import Any

from app.lib.segment_schema import (
    COMBINATORS,
    FIELD_TYPES,
    OPERATORS_BY_TYPE,
)


class SegmentValidationError(ValueError):
    """Raised when a filter violates the schema. Message is user-safe."""


# Relative date tokens the compiler understands. We validate the SHAPE here and
# let the compiler resolve them to real datetimes at query time.
_REL_SUFFIXES = ("d_ago", "m_ago", "y_ago")


def _validate_value(field: str, op: str, value: Any) -> Any:
    """Type-check (and lightly normalise) a condition's value."""
    ftype = FIELD_TYPES[field]

    if ftype == "string":
        if op == "in":
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise SegmentValidationError(
                    f"Operator 'in' on '{field}' requires a list of strings."
                )
            return value
        if not isinstance(value, str):
            raise SegmentValidationError(f"Field '{field}' expects a string value.")
        return value

    if ftype == "string_list":  # tags membership
        if not isinstance(value, str):
            raise SegmentValidationError(
                f"Field '{field}' expects a single string (a tag) to test membership."
            )
        return value

    if ftype == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise SegmentValidationError(f"Field '{field}' expects a number.")
        return value

    if ftype == "date":
        # Accept either a relative token ("30d_ago") or an ISO date string.
        if not isinstance(value, str):
            raise SegmentValidationError(
                f"Field '{field}' expects a date string or relative token like '30d_ago'."
            )
        if value.endswith(_REL_SUFFIXES):
            num = value.rsplit("_", 1)[0][:-1]  # strip 'd'/'m'/'y' then '_ago'
            if not num.isdigit():
                raise SegmentValidationError(
                    f"Bad relative date '{value}'. Use forms like '30d_ago', '6m_ago'."
                )
        # ISO strings are validated lazily by the compiler's date parser.
        return value

    # Unreachable given FIELD_TYPES, but defensive.
    raise SegmentValidationError(f"Unsupported field type for '{field}'.")


def _validate_condition(cond: Any) -> dict:
    if not isinstance(cond, dict):
        raise SegmentValidationError("Each condition must be an object.")

    missing = {"field", "op", "value"} - cond.keys()
    if missing:
        raise SegmentValidationError(
            f"Condition missing keys: {', '.join(sorted(missing))}."
        )

    field, op, value = cond["field"], cond["op"], cond["value"]

    if field not in FIELD_TYPES:
        raise SegmentValidationError(
            f"Unknown field '{field}'. Allowed: {', '.join(sorted(FIELD_TYPES))}."
        )

    allowed_ops = OPERATORS_BY_TYPE[FIELD_TYPES[field]]
    if op not in allowed_ops:
        raise SegmentValidationError(
            f"Operator '{op}' not allowed on '{field}'. "
            f"Allowed: {', '.join(sorted(allowed_ops))}."
        )

    normalised_value = _validate_value(field, op, value)
    return {"field": field, "op": op, "value": normalised_value}


def validate_segment(filter_doc: Any) -> dict:
    """Validate a top-level filter document and return a normalised copy.

    Shape:  { "all": [cond, ...] }  OR  { "any": [cond, ...] }
    Exactly one combinator key, mapping to a non-empty list of conditions.
    """
    if not isinstance(filter_doc, dict):
        raise SegmentValidationError("Segment filter must be a JSON object.")

    combinator_keys = COMBINATORS & filter_doc.keys()
    if len(combinator_keys) != 1:
        raise SegmentValidationError(
            "Filter must have exactly one of 'all' or 'any' at the top level."
        )
    if len(filter_doc) != 1:
        extra = set(filter_doc.keys()) - COMBINATORS
        raise SegmentValidationError(
            f"Unexpected top-level keys: {', '.join(sorted(extra))}."
        )

    combinator = combinator_keys.pop()
    conditions = filter_doc[combinator]
    if not isinstance(conditions, list) or not conditions:
        raise SegmentValidationError(
            f"'{combinator}' must be a non-empty list of conditions."
        )

    return {combinator: [_validate_condition(c) for c in conditions]}
