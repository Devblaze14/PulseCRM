"""
stats_service — aggregate the funnel for a campaign (or across all campaigns).

The funnel is CUMULATIVE: a CONVERTED message was also delivered, opened, read
and clicked, even though its status only holds the furthest stage. So we count
"reached at least stage X" by using the status RANK, not equality. This gives
honest funnel numbers (delivered >= opened >= clicked >= converted).

FAILED is counted separately (it's a side-branch, not a funnel stage).
"""

from __future__ import annotations

from sqlmodel import Session, func, select

from app.lib.status_machine import RANK
from app.models import Campaign, Communication, CommStatus
from app.schemas import CampaignStats
from app.services import ai_service


def _rate(numerator: int, denominator: int) -> float:
    """Safe percentage (0.0 when denominator is 0), rounded to 1 dp."""
    return round(100.0 * numerator / denominator, 1) if denominator else 0.0


def compute_stats(
    session: Session, campaign_id: int | None = None, with_ai: bool = False
) -> CampaignStats:
    """Aggregate funnel counts + rates. If campaign_id is None, aggregate ALL."""
    # Pull a status→count map in one grouped query.
    stmt = select(Communication.status, func.count()).group_by(Communication.status)
    if campaign_id is not None:
        stmt = stmt.where(Communication.campaign_id == campaign_id)
    rows = session.exec(stmt).all()
    counts: dict[CommStatus, int] = {status: n for status, n in rows}

    failed = counts.get(CommStatus.FAILED, 0)

    # "sent" = every message we handed to the channel = all non-FAILED that at
    # least reached SENT, plus FAILED ones (they were attempted). Practically,
    # sent = total communications for the campaign.
    sent = sum(counts.values())

    # Cumulative reach: number of comms whose status rank >= the stage's rank.
    # FAILED has no rank, so it's excluded from funnel reach automatically.
    def reached(stage: CommStatus) -> int:
        target = RANK[stage]
        return sum(
            n for status, n in counts.items()
            if status in RANK and RANK[status] >= target
        )

    delivered = reached(CommStatus.DELIVERED)
    opened = reached(CommStatus.OPENED)
    read = reached(CommStatus.READ)
    clicked = reached(CommStatus.CLICKED)
    converted = reached(CommStatus.CONVERTED)

    stats = CampaignStats(
        campaign_id=campaign_id,
        sent=sent,
        delivered=delivered,
        failed=failed,
        opened=opened,
        read=read,
        clicked=clicked,
        converted=converted,
        # Rates use sensible denominators: delivery over sent; open over
        # delivered; click over delivered; conversion over delivered.
        delivery_rate=_rate(delivered, sent),
        open_rate=_rate(opened, delivered),
        click_rate=_rate(clicked, delivered),
        conversion_rate=_rate(converted, delivered),
    )

    # Optional one-line AI insight (degrades to a templated line on failure).
    if with_ai:
        ai = ai_service.summarize_campaign(stats.model_dump())
        stats.ai_summary = ai.text

    return stats
