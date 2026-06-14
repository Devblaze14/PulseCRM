"""
/api/campaigns routes — create, list, read, send, and inspect communications.

Thin HTTP layer: validate inputs, delegate to services, map missing rows to 404.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.lib.db import get_session
from app.lib.segment_validator import SegmentValidationError, validate_segment
from app.schemas import (
    CampaignCreate,
    CampaignRead,
    CampaignStats,
    CommunicationRead,
    SendResponse,
)
from app.services import campaign_service, send_service, stats_service

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignRead, status_code=201)
def create(
    body: CampaignCreate,
    session: Session = Depends(get_session),
) -> CampaignRead:
    """Create a campaign. Validates the segment_definition before persisting so
    we never store a campaign we couldn't later resolve."""
    try:
        validate_segment(body.segment_definition)
    except SegmentValidationError as e:
        raise HTTPException(status_code=400, detail=f"Invalid segment: {e}")
    return campaign_service.create_campaign(session, body)


@router.get("", response_model=list[CampaignRead])
def list_all(session: Session = Depends(get_session)) -> list[CampaignRead]:
    return campaign_service.list_campaigns(session)


@router.post("/backfill-titles")
def backfill_titles(
    force: bool = False,
    session: Session = Depends(get_session),
) -> dict:
    """One-off maintenance: give pre-existing campaigns short AI titles.

    Campaigns created before the title feature still hold the long goal text as
    their name. This regenerates a short title for any over-long name (or all of
    them with ?force=true). Idempotent — re-running only touches names that are
    still long."""
    return campaign_service.backfill_titles(session, force=force)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_one(
    campaign_id: int, session: Session = Depends(get_session)
) -> CampaignRead:
    campaign = campaign_service.get_campaign(session, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return campaign


@router.post("/{campaign_id}/send", response_model=SendResponse)
def send(
    campaign_id: int, session: Session = Depends(get_session)
) -> SendResponse:
    """Kick off the send: create communications + hand the batch to the channel.
    Returns immediately (delivery happens asynchronously via callbacks)."""
    campaign = campaign_service.get_campaign(session, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    result = send_service.send_campaign(session, campaign)
    return SendResponse(**result)


@router.get("/{campaign_id}/communications", response_model=list[CommunicationRead])
def communications(
    campaign_id: int, session: Session = Depends(get_session)
) -> list[CommunicationRead]:
    if campaign_service.get_campaign(session, campaign_id) is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return campaign_service.list_communications(session, campaign_id)


@router.get("/{campaign_id}/stats", response_model=CampaignStats)
def stats(
    campaign_id: int,
    ai: bool = True,
    session: Session = Depends(get_session),
) -> CampaignStats:
    """Funnel counts + rates for a campaign, with an optional AI insight line.

    `ai=false` skips the LLM call (useful for cheap polling from the UI)."""
    if campaign_service.get_campaign(session, campaign_id) is None:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    return stats_service.compute_stats(session, campaign_id, with_ai=ai)
