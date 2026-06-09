"""
send_service — kicks off a campaign send.

Steps (per the brief, §8):
  1. Resolve the campaign's segment filter → list of customers.
  2. Create one Communication row per customer (status QUEUED), render {name}.
  3. POST the batch to the channel service with a callback_url back to THIS CRM
     and a shared callback_secret. Do NOT await delivery.
  4. Move campaign SENDING → SENT.

Design choices:
  * We persist the Communications and commit BEFORE calling the channel, so the
    audience is durably recorded even if the channel call fails. The channel
    call is best-effort here: delivery is asynchronous and the channel pushes
    status back via /api/receipts. If the channel is unreachable we still return
    a useful result (channel_accepted=False) rather than crashing — the rows
    exist and could be retried.
  * Message rendering is a simple, safe {name}-style substitution (str.format
    with a guarded mapping) so a template referencing an unknown field can't blow
    up the whole batch.
"""

from __future__ import annotations

import httpx
from sqlmodel import Session

from app.config import settings
from app.models import Campaign, CampaignStatus, Communication, CommStatus
from app.services import segment_service


class _SafeDict(dict):
    """Used with str.format_map so unknown placeholders render as-is instead of
    raising KeyError — a bad template degrades gracefully."""

    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def render_message(template: str, *, name: str) -> str:
    """Substitute {name} (and tolerate other placeholders) safely."""
    first_name = name.split(" ")[0] if name else "there"
    return template.format_map(_SafeDict(name=first_name))


def send_campaign(session: Session, campaign: Campaign) -> dict:
    """Execute steps 1-4. Returns a dict matching SendResponse fields."""
    # Guard: only DRAFT campaigns can be sent (idempotency against double-send).
    if campaign.status != CampaignStatus.DRAFT:
        return {
            "campaign_id": campaign.id,
            "status": campaign.status,
            "queued": 0,
            "channel_accepted": False,
            "note": f"Campaign is already {campaign.status.value}; not re-sending.",
        }

    # Mark SENDING up-front so a concurrent request sees the in-flight state.
    campaign.status = CampaignStatus.SENDING
    session.add(campaign)
    session.commit()

    # 1) Resolve audience.
    customers = segment_service.resolve_segment_customers(
        session, campaign.segment_definition
    )

    # 2) Create one QUEUED Communication per customer with rendered message.
    comms: list[Communication] = []
    for cust in customers:
        comm = Communication(
            campaign_id=campaign.id,
            customer_id=cust.id,
            channel=campaign.channel,
            rendered_message=render_message(campaign.message_template, name=cust.name),
            status=CommStatus.QUEUED,
        )
        session.add(comm)
        comms.append(comm)
    session.commit()
    for comm in comms:
        session.refresh(comm)  # populate ids for the channel batch

    # 3) Build the batch and POST to the channel service (fire-and-forget).
    #    We pick a recipient address appropriate to the channel.
    batch = []
    cust_by_id = {c.id: c for c in customers}
    for comm in comms:
        cust = cust_by_id[comm.customer_id]
        recipient = cust.email if campaign.channel.value == "EMAIL" else cust.phone
        batch.append({
            "communication_id": comm.id,
            "recipient": recipient,
            "channel": comm.channel.value,
            "message": comm.rendered_message,
        })

    payload = {
        "messages": batch,
        "callback_url": f"{settings.CRM_BASE_URL}/api/receipts",
        "callback_secret": settings.CALLBACK_SECRET,
    }

    channel_accepted = False
    note = None
    try:
        # Short timeout: the channel returns 202 immediately and does the slow
        # delivery simulation in the background, so we should never block long.
        resp = httpx.post(
            f"{settings.CHANNEL_SERVICE_URL}/send", json=payload, timeout=10.0
        )
        channel_accepted = resp.status_code == 202
        if not channel_accepted:
            note = f"Channel responded {resp.status_code}."
    except httpx.HTTPError as e:
        # Channel unreachable: rows are already persisted; surface the reason.
        note = f"Channel unreachable ({type(e).__name__}). Communications queued."

    # 4) Move to SENT regardless — the handoff to the channel is complete from
    #    the CRM's perspective; delivery state arrives later via receipts.
    campaign.status = CampaignStatus.SENT
    session.add(campaign)
    session.commit()
    session.refresh(campaign)

    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "queued": len(comms),
        "channel_accepted": channel_accepted,
        "note": note,
    }
