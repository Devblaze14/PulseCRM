"""
campaign_service — CRUD for campaigns and reading their communications.

Pure persistence/business logic; the router stays thin. Sending lives in its own
send_service because it involves the external channel call and status machine.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import Campaign, Communication, Customer
from app.schemas import CampaignCreate, CommunicationRead
from app.services import ai_service


def create_campaign(session: Session, body: CampaignCreate) -> Campaign:
    """Persist a new campaign in DRAFT status.

    Title safety net: if the name is missing or looks auto-derived from the goal
    (a leading slice, e.g. an old frontend that still sends goal[:40]), we
    generate a short AI title here. This guarantees a campaign is NEVER stored
    with a chopped mid-sentence name, independent of what the client sends —
    so the short-title behaviour holds automatically from now on.
    """
    name = (body.name or "").strip()
    if not name or _looks_auto_derived(name, body.goal):
        name = ai_service.generate_title(body.goal).text or name or body.goal

    campaign = Campaign(
        name=name,
        goal=body.goal,
        channel=body.channel,
        segment_definition=body.segment_definition,
        message_template=body.message_template,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return campaign


def _looks_auto_derived(name: str, goal: str) -> bool:
    """True if `name` looks like the old goal-text chop rather than a real title.

    The pre-feature builder set name = goal[:40], producing names that are a
    leading SLICE of the goal — often cut mid-word ("...for people not",
    "...haven't ordered i"). Character length alone misses these (they're ~40
    chars, not "too long"), so we detect them structurally: a name that is a
    case-insensitive prefix of the goal AND shorter than the goal was almost
    certainly auto-derived. A genuine AI title ("20% Off Lapsed T-Shirt Buyers")
    is not a prefix of the goal, so it's left untouched.
    """
    n = name.strip().lower()
    g = " ".join(goal.split()).strip().lower()
    if not n or not g:
        return False
    return len(n) < len(g) and g.startswith(n)


def backfill_titles(session: Session, force: bool = False) -> dict:
    """Regenerate short AI titles for EXISTING campaigns created before the
    title feature (their `name` is still a chopped slice of the goal text).

    By default only rewrites names that look auto-derived (a truncated prefix of
    the goal); pass force=True to regenerate every campaign's title. Returns a
    summary the caller can surface. Each title uses generate_title, which falls
    back to a clean word-boundary trim if the LLM is unavailable — so this never
    leaves a campaign half-renamed or worse off than before.
    """
    campaigns = list(session.exec(select(Campaign)).all())
    updated: list[dict] = []
    for c in campaigns:
        if not force and not _looks_auto_derived(c.name, c.goal):
            continue
        new_title = ai_service.generate_title(c.goal).text
        if not new_title or new_title == c.name:
            continue
        old = c.name
        c.name = new_title
        session.add(c)
        updated.append({"id": c.id, "old": old, "new": new_title})
    if updated:
        session.commit()
    return {"scanned": len(campaigns), "updated": len(updated), "changes": updated}


def list_campaigns(session: Session) -> list[Campaign]:
    """All campaigns, newest first (for the dashboard + campaigns list)."""
    return list(
        session.exec(select(Campaign).order_by(Campaign.created_at.desc())).all()
    )


def get_campaign(session: Session, campaign_id: int) -> Campaign | None:
    return session.get(Campaign, campaign_id)


def list_communications(
    session: Session, campaign_id: int
) -> list[CommunicationRead]:
    """Communications for a campaign, joined to customer names for the UI table."""
    rows = session.exec(
        select(Communication, Customer.name)
        .join(Customer, Customer.id == Communication.customer_id)
        .where(Communication.campaign_id == campaign_id)
        .order_by(Communication.id)
    ).all()
    return [
        CommunicationRead(
            id=c.id,
            customer_id=c.customer_id,
            customer_name=name,
            channel=c.channel,
            rendered_message=c.rendered_message,
            status=c.status,
            converted_order_id=c.converted_order_id,
            attributed_amount=c.attributed_amount,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, name in rows
    ]
