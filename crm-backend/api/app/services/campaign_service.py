"""
campaign_service — CRUD for campaigns and reading their communications.

Pure persistence/business logic; the router stays thin. Sending lives in its own
send_service because it involves the external channel call and status machine.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.models import Campaign, Communication, Customer
from app.schemas import CampaignCreate, CommunicationRead


def create_campaign(session: Session, body: CampaignCreate) -> Campaign:
    """Persist a new campaign in DRAFT status."""
    campaign = Campaign(
        name=body.name,
        goal=body.goal,
        channel=body.channel,
        segment_definition=body.segment_definition,
        message_template=body.message_template,
    )
    session.add(campaign)
    session.commit()
    session.refresh(campaign)
    return campaign


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
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c, name in rows
    ]
