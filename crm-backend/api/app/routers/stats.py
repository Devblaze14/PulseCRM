"""
/api/stats — account-wide aggregates for the dashboard's top stat tiles.

Per-campaign stats live under /api/campaigns/{id}/stats; this is the "overall"
roll-up across every campaign.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.lib.db import get_session
from app.schemas import CampaignStats
from app.services import stats_service

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/overview", response_model=CampaignStats)
def overview(
    ai: bool = False, session: Session = Depends(get_session)
) -> CampaignStats:
    """Funnel totals across all campaigns (campaign_id is null in the response)."""
    return stats_service.compute_stats(session, campaign_id=None, with_ai=ai)
