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
    # One-line plain-English explanation of a proposed segment. Metadata only —
    # never validated or executed. None when the model omitted it.
    rationale: Optional[str] = None


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
  {{
    "filter": {{ "all": [ {{ "field": <field>, "op": <operator>, "value": <value> }}, ... ] }},
    "rationale": <one short plain-English sentence explaining the segment>
  }}
Inside "filter", use "all" for AND logic, "any" for OR logic. Exactly one of "all"/"any".
"rationale" is a brief human explanation (e.g. "lapsed high-value: 2+ orders, nothing in 60 days").
Keep it to one line; it is shown to the marketer, never executed.

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
#  Filter / rationale separation
# --------------------------------------------------------------------------- #
def _split_filter_and_rationale(parsed: dict) -> tuple[dict, Optional[str]]:
    """Separate the executable filter from the human rationale BEFORE validation.

    This is the clean boundary that keeps rationale out of the segment gate: the
    validator only ever sees the {all|any:[...]} filter doc and keeps rejecting
    unknown FILTER fields/operators; `rationale` is peeled off here as harmless
    metadata. We tolerate three shapes so a model that ignores the wrapper, or
    omits the rationale, still works:

      * {"filter": {all|any:[...]}, "rationale": "..."}   (preferred)
      * {"all"|"any": [...], "rationale": "..."}          (rationale as sibling)
      * {"all"|"any": [...]}                              (legacy bare filter)

    Returns (filter_doc, rationale_or_None). Never raises — a malformed shape is
    passed through as the filter for the validator to reject with its own message.
    """
    if not isinstance(parsed, dict):
        return parsed, None

    rationale = parsed.get("rationale")
    if not isinstance(rationale, str) or not rationale.strip():
        rationale = None
    else:
        rationale = rationale.strip()

    inner = parsed.get("filter")
    if isinstance(inner, dict):
        # Preferred wrapped shape: the filter lives under "filter".
        return inner, rationale

    # Otherwise treat the object itself as the filter, minus the rationale key,
    # so a sibling-rationale shape doesn't trip the validator's "unexpected key".
    filter_doc = {k: v for k, v in parsed.items() if k != "rationale"}
    return filter_doc, rationale


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
        filter_doc, rationale = _split_filter_and_rationale(parsed)
        return AIResult(ok=True, data=filter_doc, rationale=rationale)
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


# Things that make win-back/marketing copy read as generic AI sludge. Banning
# them explicitly forces the model off the statistical mean and toward specifics.
_ANTI_CLICHE_RULES = (
    "Do NOT open with \"We've missed you\", \"Long time no see\", or \"It's been "
    "a while\".\n"
    "Do NOT make a bare discount the entire message (\"get X% off\") — if there's "
    "an offer, frame it around a reason or a specific product moment.\n"
    "Do NOT use hollow filler: \"amazing deals\", \"don't miss out\", \"exclusive "
    "offer\", \"limited time\", \"shop now\" as the whole CTA.\n"
    "DO lead with a concrete hook, a point of view, or a specific detail. Each "
    "variant must take a genuinely DIFFERENT angle from the others."
)

# How many distinct copy options we ask the model for.
_VARIANT_COUNT = 3


def _draft_fallbacks(goal: str) -> list[str]:
    """Deterministic, distinct fallbacks used when the LLM is unavailable, so the
    marketer still gets choices (not one bland line) and is never blocked."""
    g = goal.strip().rstrip(".")
    return [
        f"Hi {{name}}, your cart's been quiet lately. {g} — want a hand picking "
        "up where you left off?",
        f"Hi {{name}}, quick one: {g.lower()}. Tap through whenever you're ready.",
        f"Hi {{name}}, we set something aside with you in mind. {g}.",
    ]


def draft_message(
    goal: str,
    channel: str,
    segment_summary: str,
    brand_voice: Optional[str] = None,
) -> AIResult:
    """Draft THREE distinct, channel-appropriate message variants, each with a
    {name} placeholder, in the configured (or overridden) brand voice.

    Returns AIResult where `data["messages"]` is the list of variants. On failure
    we fall back to distinct deterministic drafts so the marketer is never blocked.
    """
    client = _get_client()
    voice = (brand_voice or settings.BRAND_VOICE).strip()
    fallbacks = _draft_fallbacks(goal)
    if client is None:
        return AIResult(ok=True, data={"messages": fallbacks},
                        error="AI unavailable — using fallback drafts.")

    hint = _CHANNEL_HINTS.get(channel.upper(), "Keep it short and on-brand.")
    system = (
        f"You are the copywriter for {voice}.\n"
        f"Write EXACTLY {_VARIANT_COUNT} alternative messages for ONE marketing "
        "campaign, each a different creative angle the marketer can choose between.\n"
        "Use the literal placeholder {name} for the recipient's first name in "
        "every variant.\n\n"
        f"Rules:\n{_ANTI_CLICHE_RULES}\n\n"
        "Return ONLY a JSON object of the shape "
        '{"messages": ["...", "...", "..."]} and nothing else.'
    )
    user = (
        f"Channel: {channel}\nChannel guidance: {hint}\n"
        f"Campaign goal: {goal}\nAudience: {segment_summary or 'the selected segment'}\n"
        f"Write the {_VARIANT_COUNT} variants now."
    )
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "system", "content": system},
                     {"role": "user", "content": user}],
            response_format={"type": "json_object"},  # force parseable variants
            temperature=0.9,  # higher: we WANT spread across the three angles
            max_tokens=500,
        )
        raw = resp.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        messages = parsed.get("messages")
        if not isinstance(messages, list) or not messages:
            raise ValueError("model did not return a non-empty messages list")
        # Normalise: strings only, ensure {name} is present, drop blanks.
        cleaned: list[str] = []
        for m in messages:
            if not isinstance(m, str) or not m.strip():
                continue
            text = m.strip()
            if "{name}" not in text:
                text = "Hi {name}, " + text
            cleaned.append(text)
        if not cleaned:
            raise ValueError("no usable variants after cleaning")
        return AIResult(ok=True, data={"messages": cleaned})
    except Exception:
        return AIResult(ok=True, data={"messages": fallbacks},
                        error="AI unavailable — using fallback drafts.")


# --------------------------------------------------------------------------- #
#  3) generate_title
# --------------------------------------------------------------------------- #
# Hard cap on the title length. Short enough to never wrap/truncate in the
# dashboard's "Recent campaigns" rows or the campaign-detail heading.
_TITLE_MAX_CHARS = 42


def _title_fallback(goal: str) -> str:
    """Deterministic short title when the LLM is unavailable.

    Truncates on a WORD boundary (never mid-word) and appends an ellipsis, so
    even the fallback reads as a complete-looking label rather than the blunt
    character chop that produced "Send discount of 20% off for people not".
    """
    g = " ".join(goal.split()).strip()  # collapse whitespace
    if len(g) <= _TITLE_MAX_CHARS:
        return g or "Untitled campaign"
    cut = g[:_TITLE_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",.;:- ")
    return f"{cut}…" if cut else g[:_TITLE_MAX_CHARS].rstrip() + "…"


def generate_title(goal: str) -> AIResult:
    """Turn a plain-English campaign goal into a SHORT, complete title.

    e.g. "Send discount of 20% off for people not bought T-shirts in 1 month"
         → "20% Off Lapsed T-Shirt Buyers"

    Always succeeds for the caller: on any LLM failure we fall back to a clean
    word-boundary truncation so a campaign is never left with a half-sentence
    name. `text` holds the title.
    """
    client = _get_client()
    fallback = _title_fallback(goal)
    if client is None:
        return AIResult(ok=True, text=fallback,
                        error="AI unavailable — using a trimmed title.")

    system = (
        "You name marketing campaigns. Given the marketer's goal, return a SHORT, "
        "punchy campaign title: a NOUN PHRASE of at most 6 words and "
        f"{_TITLE_MAX_CHARS} characters. Title Case. No quotes, no trailing "
        "punctuation, no emojis, no preamble — output ONLY the title text. "
        "It must read as a complete label, never a cut-off sentence."
    )
    try:
        resp = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "system", "content": system},
                     {"role": "user", "content": goal}],
            temperature=0.5,
            max_tokens=24,
        )
        title = (resp.choices[0].message.content or "").strip().strip('"').strip()
        # Guard against a chatty or over-long model response: if it blew the
        # budget, fall back to the clean truncation rather than ship a long line.
        if not title or len(title) > _TITLE_MAX_CHARS + 8:
            return AIResult(ok=True, text=fallback,
                            error="AI title too long — using a trimmed title.")
        return AIResult(ok=True, text=title)
    except Exception:
        return AIResult(ok=True, text=fallback,
                        error="AI unavailable — using a trimmed title.")


# --------------------------------------------------------------------------- #
#  4) summarize_campaign
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
