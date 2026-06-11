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
    DraftRequest,
    DraftResponse,
    IntentRequest,
    IntentResponse,
)
from app.services import ai_service, segment_service

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

    # Server-side validation: the AI's output is untrusted input.
    try:
        validate_segment(ai_result.data)
    except SegmentValidationError as e:
        return IntentResponse(
            ok=False,
            filter=ai_result.data,
            error=f"AI produced an invalid segment: {e}",
        )

    preview = segment_service.preview_segment(session, ai_result.data)
    return IntentResponse(ok=True, filter=ai_result.data, preview=preview)


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
