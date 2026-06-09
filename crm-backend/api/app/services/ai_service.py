"""
ai_service — all Groq LLM interactions, isolated behind three functions.

Design principles (interview-relevant):
  * The LLM is woven into the product (segmenting + drafting) but NEVER trusted
    blindly. `intent_to_segment` returns a filter that is *separately validated*
    by segment_validator before it can touch the DB.
  * JSON mode (`response_format={"type": "json_object"}`) forces well-formed JSON
    so we parse deterministically instead of regexing prose.
  * The allowed-field/operator spec embedded in the system prompt is GENERATED
    from segment_schema.py — single source of truth, so the prompt and the
    validator can never drift apart.
  * Every call degrades gracefully: a Groq outage / bad key / malformed output
    returns a structured error (or a sensible fallback) instead of crashing the
    request. Marketers should see "AI is unavailable, try again", not a 500.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional

from groq import Groq

from app.config import settings
from app.lib.segment_schema import FIELD_TYPES, OPERATORS_BY_TYPE

# Lazily-constructed singleton client. Built on first use so importing this
# module never fails just because the key is absent (e.g. during tests).
_client: Optional[Groq] = None


def _get_client() -> Optional[Groq]:
    global _client
    if not settings.GROQ_API_KEY:
        return None  # no key configured → callers fall back gracefully
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


# --------------------------------------------------------------------------- #
#  Result wrapper
# --------------------------------------------------------------------------- #
@dataclass
class AIResult:
    """Uniform return type so callers can branch on .ok without try/except.

    ok=True  → `data` holds the parsed result.
    ok=False → `error` holds a user-safe message to surface in the UI.
    """
    ok: bool
    data: Optional[dict] = None
    text: Optional[str] = None
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
#  Prompt construction
# --------------------------------------------------------------------------- #
def _segment_schema_spec() -> str:
    """Render the allowed fields + operators as prompt text, derived from the
    validator's own schema so the two can't disagree."""
    lines = []
    for field, ftype in FIELD_TYPES.items():
        ops = sorted(OPERATORS_BY_TYPE[ftype])
        lines.append(f"  - {field} ({ftype}): operators {ops}")
    return "\n".join(lines)


_SEGMENT_SYSTEM_PROMPT = f"""You are a marketing audience-segmentation engine for a Direct-to-Consumer brand.
Translate the marketer's plain-English intent into a STRUCTURED JSON FILTER. You do NOT write SQL.

Output a single JSON object with EXACTLY this shape:
  {{ "all": [ {{ "field": <field>, "op": <operator>, "value": <value> }}, ... ] }}
Use "all" for AND logic, "any" for OR logic. Exactly one of "all"/"any" at the top level.

Allowed fields and their operators (use ONLY these — anything else is rejected):
{_segment_schema_spec()}

Value rules:
  - Dates use relative tokens: "30d_ago", "6m_ago", "1y_ago" (N + d/m/y + _ago).
    "haven't ordered in 30 days" => last_order_at before 30d_ago.
  - Numbers (total_spend, order_count) are plain numbers. Spend is in INR (rupees).
  - city/tags values are strings. tags uses "contains"/"not_contains" with ONE tag.
  - For "in" on city, value is a list of strings.

Return ONLY the JSON object, no commentary."""


# --------------------------------------------------------------------------- #
#  1) intent_to_segment
# --------------------------------------------------------------------------- #
def intent_to_segment(text: str) -> AIResult:
    """Plain-English intent → structured segment filter (unvalidated here).

    The caller is expected to run the returned filter through segment_validator;
    this function only guarantees JSON parses. On any failure we return
    ok=False with a message the UI can show verbatim.
    """
    client = _get_client()
    if client is None:
        return AIResult(ok=False, error="AI is not configured (missing GROQ_API_KEY).")

    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SEGMENT_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},  # JSON mode
            temperature=0,  # deterministic structure
        )
        raw = resp.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        return AIResult(ok=True, data=parsed)
    except json.JSONDecodeError:
        return AIResult(ok=False, error="The AI returned invalid JSON. Please rephrase.")
    except Exception as e:  # network, auth, rate limit, etc.
        return AIResult(ok=False, error=f"AI request failed: {type(e).__name__}.")


# --------------------------------------------------------------------------- #
#  2) draft_message
# --------------------------------------------------------------------------- #
# Channel-specific guidance so the copy fits the medium (length, formality).
_CHANNEL_HINTS = {
    "SMS": "Keep under 160 characters. Plain text, no emojis, include the offer.",
    "WHATSAPP": "Conversational and friendly, 1-2 short lines, an emoji is fine.",
    "EMAIL": "A short subject-less body, 2-3 sentences, warm and on-brand.",
    "RCS": "Rich and friendly, 1-2 lines, can hint at a button/CTA.",
}


def draft_message(goal: str, channel: str, segment_summary: str) -> AIResult:
    """Draft a channel-appropriate message with a {name} placeholder.

    On failure we fall back to a generic-but-usable template so the marketer is
    never blocked — they can always edit it before sending.
    """
    client = _get_client()
    fallback = (
        f"Hi {{name}}, we miss you! {goal.strip().rstrip('.')}. "
        "Tap to shop now."
    )
    if client is None:
        return AIResult(ok=True, text=fallback,
                        error="AI unavailable — using a fallback draft.")

    hint = _CHANNEL_HINTS.get(channel.upper(), "Keep it short and on-brand.")
    system = (
        "You are a DTC brand's marketing copywriter. Write ONE message for the "
        "given channel. Use the literal placeholder {name} for the recipient's "
        "first name. Return ONLY the message text, no quotes, no preamble."
    )
    user = (
        f"Channel: {channel}\nChannel guidance: {hint}\n"
        f"Campaign goal: {goal}\nAudience: {segment_summary}\n"
        "Write the message now."
    )
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "system", "content": system},
                     {"role": "user", "content": user}],
            temperature=0.7,  # a little creativity for copy
            max_tokens=200,
        )
        text = (resp.choices[0].message.content or "").strip()
        if "{name}" not in text:
            # Ensure the personalisation token is present for rendering later.
            text = "Hi {name}, " + text
        return AIResult(ok=True, text=text)
    except Exception:
        return AIResult(ok=True, text=fallback,
                        error="AI unavailable — using a fallback draft.")


# --------------------------------------------------------------------------- #
#  3) summarize_campaign
# --------------------------------------------------------------------------- #
def summarize_campaign(stats: dict) -> AIResult:
    """One plain-English performance insight from a campaign's stats dict.

    Falls back to a deterministic templated line if the LLM is unavailable, so
    the dashboard always has something to show.
    """
    client = _get_client()
    fallback = (
        f"{stats.get('sent', 0)} sent · {stats.get('delivered', 0)} delivered · "
        f"{stats.get('clicked', 0)} clicked · {stats.get('converted', 0)} converted."
    )
    if client is None:
        return AIResult(ok=True, text=fallback)

    system = (
        "You are a marketing analyst. Given campaign stats, write ONE concise, "
        "insightful sentence a marketer would find useful (mention the standout "
        "number and what to do next). No preamble, one sentence."
    )
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "system", "content": system},
                     {"role": "user", "content": json.dumps(stats)}],
            temperature=0.4,
            max_tokens=120,
        )
        text = (resp.choices[0].message.content or "").strip()
        return AIResult(ok=True, text=text or fallback)
    except Exception:
        return AIResult(ok=True, text=fallback)
