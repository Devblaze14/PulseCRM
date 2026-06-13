"""
Pydantic request/response schemas for the API surface.

These are deliberately SEPARATE from the SQLModel table classes in models.py.
Tables describe storage; schemas describe the wire contract. Keeping them apart
means we can shape API responses (e.g. include derived spend, hide internals)
without leaking ORM details or accidentally exposing columns.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

from app.models import CampaignStatus, Channel, CommStatus


# --------------------------------------------------------------------------- #
#  Segments
# --------------------------------------------------------------------------- #
class SegmentPreviewRequest(BaseModel):
    """A validated-or-raw filter document to preview.

    `filter` is the structured segment JSON (the {all|any: [...]} shape). We
    validate it server-side before compiling, so we accept a free-form dict here
    and reject bad shapes with a 400.
    """
    filter: dict[str, Any]


class CustomerSummary(BaseModel):
    """Customer plus derived metrics, for previews and the customers table."""
    id: int
    name: str
    email: str
    city: str
    tags: list[str]
    total_spend: float
    order_count: int
    last_order_at: Optional[datetime]


# --------------------------------------------------------------------------- #
#  Ingestion (taking customers + orders into the system)
# --------------------------------------------------------------------------- #
class CustomerIn(BaseModel):
    """One customer to ingest. `id`/`created_at` are server-assigned and omitted
    here, exactly like CampaignCreate omits them — the wire contract carries only
    what a caller can legitimately supply."""
    name: str
    email: str
    phone: str
    city: str
    tags: list[str] = []


class OrderIn(BaseModel):
    """One order to ingest. `customer_id` must reference an existing customer;
    ingestion validates that before inserting (no orphan FK rows). Spend/recency
    are NOT supplied — they are derived from these orders at query time."""
    customer_id: int
    amount: float
    items: list[dict[str, Any]] = []
    status: str = "PLACED"  # PLACED | DELIVERED | RETURNED | CANCELLED


class IngestResult(BaseModel):
    """Outcome of a (possibly bulk) ingest. Non-fatal per-record problems are
    reported in `errors` (index-tagged, user-safe) rather than failing the whole
    batch — valid records still commit. Used by both ingest endpoints."""
    created: int
    skipped: int
    errors: list[str] = []


class SegmentPreviewResponse(BaseModel):
    count: int
    sample: list[CustomerSummary]  # up to 10 example customers


# --------------------------------------------------------------------------- #
#  AI
# --------------------------------------------------------------------------- #
class IntentRequest(BaseModel):
    """Marketer's plain-English intent from the chat builder."""
    text: str


class IntentResponse(BaseModel):
    """The AI's proposed segment, already validated and previewed.

    `ok=False` carries a user-safe `error` (e.g. AI down or produced an invalid
    filter) so the chat UI can show a friendly message instead of breaking.
    """
    ok: bool
    filter: Optional[dict[str, Any]] = None
    preview: Optional[SegmentPreviewResponse] = None
    # One-line plain-English explanation of the proposed segment, shown next to
    # the audience preview. Optional: absent when the model omits it or AI fails.
    rationale: Optional[str] = None
    error: Optional[str] = None


class DraftRequest(BaseModel):
    goal: str
    channel: str
    segment_summary: str = ""
    # Optional per-request override of the deployment's default BRAND_VOICE.
    # Lets a marketer steer tone ("playful", "premium") without changing config.
    brand_voice: Optional[str] = None


class DraftResponse(BaseModel):
    ok: bool
    # Three distinct copy variants for the marketer to choose from. `message`
    # is kept as a convenience alias for the first variant so older callers
    # don't break while the frontend migrates to the variant picker.
    messages: list[str]
    message: str
    note: Optional[str] = None  # e.g. "AI unavailable — using a fallback draft."


# --------------------------------------------------------------------------- #
#  Campaigns
# --------------------------------------------------------------------------- #
class CampaignCreate(BaseModel):
    """Payload to create a campaign (typically from the chat builder's confirm)."""
    name: str
    goal: str
    channel: Channel
    segment_definition: dict[str, Any]  # the validated {all|any:[...]} filter
    message_template: str               # must contain a {name} placeholder


class CampaignRead(BaseModel):
    """Campaign as returned by the API."""
    id: int
    name: str
    goal: str
    channel: Channel
    segment_definition: dict[str, Any]
    message_template: str
    status: CampaignStatus
    created_at: datetime


class SendResponse(BaseModel):
    """Result of kicking off a send: how many recipients were queued."""
    campaign_id: int
    status: CampaignStatus
    queued: int           # Communications created
    channel_accepted: bool  # did the channel service accept the batch?
    note: Optional[str] = None  # e.g. why channel_accepted is False


class CommunicationRead(BaseModel):
    """A single message row, for the campaign detail table."""
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    channel: Channel
    rendered_message: str
    status: CommStatus
    converted_order_id: Optional[int] = None
    attributed_amount: Optional[float] = None
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- #
#  Receipts (callbacks from the channel)
# --------------------------------------------------------------------------- #
class ReceiptIn(BaseModel):
    """One lifecycle event posted by the channel to /api/receipts."""
    communication_id: int
    event_type: str          # DELIVERED | OPENED | READ | CLICKED | CONVERTED | FAILED
    event_id: str            # uuid4 idempotency key
    occurred_at: datetime
    callback_secret: str
    converted_order_id: Optional[int] = None
    # Order value attributed to this communication on conversion (INR). Optional
    # so non-conversion events (and older callers) omit it harmlessly.
    order_amount: Optional[float] = None


class ReceiptResult(BaseModel):
    """Fast ack so the channel doesn't retry. `applied` is False for duplicates
    or status no-ops (still 2xx)."""
    accepted: bool
    applied: bool
    status: Optional[CommStatus] = None
    reason: Optional[str] = None


# --------------------------------------------------------------------------- #
#  Stats
# --------------------------------------------------------------------------- #
class CampaignStats(BaseModel):
    """Aggregated funnel + rates for one campaign (or overall)."""
    campaign_id: Optional[int] = None
    sent: int
    delivered: int
    failed: int
    opened: int
    read: int
    clicked: int
    converted: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    conversion_rate: float
    # Total INR attributed to conversions in this scope (campaign or overall).
    # Defaults to 0.0 so zero-conversion / pre-attribution campaigns render fine.
    attributed_revenue: float = 0.0
    ai_summary: Optional[str] = None
