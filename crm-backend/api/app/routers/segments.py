"""
/api/segments routes — thin HTTP layer over segment_service.

The router's only jobs: parse the request, call the service, translate domain
errors (SegmentValidationError) into HTTP 400. No business logic here.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.lib.db import get_session
from app.lib.segment_validator import SegmentValidationError
from app.schemas import SegmentPreviewRequest, SegmentPreviewResponse
from app.services import segment_service

router = APIRouter(prefix="/api/segments", tags=["segments"])


@router.post("/preview", response_model=SegmentPreviewResponse)
def preview(
    body: SegmentPreviewRequest,
    session: Session = Depends(get_session),
) -> SegmentPreviewResponse:
    """Return { count, sample } for a structured segment filter."""
    try:
        return segment_service.preview_segment(session, body.filter)
    except SegmentValidationError as e:
        # The validator's messages are user-safe → surface as a 400.
        raise HTTPException(status_code=400, detail=str(e))
