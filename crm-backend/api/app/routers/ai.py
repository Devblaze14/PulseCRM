"""
/api/ai routes — expose the three AI capabilities to the frontend.

The hero endpoint is /intent-to-segment: it chains intent → validate → preview
so a single round-trip gives the chat UI a proposed filter AND a live audience
count + sample. We validate the AI's output server-side (never trusting it) and
translate any failure into a friendly ok=False payload.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.lib.db import get_session
from app.lib.segment_validator import SegmentValidationError, validate_segment
from app.schemas import (
    AssistantChatRequest,
    AssistantChatResponse,
    DraftRequest,
    DraftResponse,
    IntentRequest,
    IntentResponse,
    TitleRequest,
    TitleResponse,
)
from app.services import ai_service, segment_service, stats_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/intent-to-segment", response_model=IntentResponse)
def intent_to_segment(
    body: IntentRequest,
    session: Session = Depends(get_session),
) -> IntentResponse:
    """Plain English → validated filter + live audience preview."""
    ai_result = ai_service.intent_to_segment(body.text)
    if not ai_result.ok:
        return IntentResponse(ok=False, error=ai_result.error)

    # Server-side validation: the AI's output is untrusted input. Note we
    # validate ONLY the filter doc — `rationale` was split off in the service and
    # never reaches the validator, so the segment gate is unchanged.
    try:
        validate_segment(ai_result.data)
    except SegmentValidationError as e:
        return IntentResponse(
            ok=False,
            filter=ai_result.data,
            rationale=ai_result.rationale,
            error=f"AI produced an invalid segment: {e}",
        )

    preview = segment_service.preview_segment(session, ai_result.data)
    return IntentResponse(
        ok=True,
        filter=ai_result.data,
        preview=preview,
        rationale=ai_result.rationale,
    )


@router.post("/draft-message", response_model=DraftResponse)
def draft_message(body: DraftRequest) -> DraftResponse:
    """Draft three distinct channel-appropriate variants, each with a {name}
    placeholder, in the configured (or per-request) brand voice."""
    result = ai_service.draft_message(
        body.goal, body.channel, body.segment_summary, body.brand_voice
    )
    messages = (result.data or {}).get("messages", [])
    return DraftResponse(
        ok=result.ok,
        messages=messages,
        message=messages[0] if messages else "",  # first variant, for back-compat
        note=result.error,  # populated only when a fallback was used
    )


@router.post("/title", response_model=TitleResponse)
def title(body: TitleRequest) -> TitleResponse:
    """Plain-English goal → short, complete campaign title (for the name field).

    Always returns a usable title: on any AI failure the service falls back to a
    clean word-boundary trim, so the campaign is never named with a half-sentence."""
    result = ai_service.generate_title(body.goal)
    return TitleResponse(ok=result.ok, title=result.text or "", note=result.error)


@router.post("/chat", response_model=AssistantChatResponse)
def chat(
    body: AssistantChatRequest,
    session: Session = Depends(get_session),
) -> AssistantChatResponse:
    """Free-form marketer question → a concise reply grounded in live funnel stats.

    Reuses the dashboard's own aggregator so the assistant cites real numbers, and
    always returns ok=True (the service degrades to a friendly offline reply rather
    than erroring) so the floating widget never shows a failure wall."""
    stats = stats_service.compute_stats(session)  # overall funnel (no campaign_id)
    history = [m.model_dump() for m in body.history][-6:]  # bound token cost
    result = ai_service.assistant_chat(body.message, history, stats.model_dump())
    return AssistantChatResponse(ok=result.ok, reply=result.text or "", note=result.error)
