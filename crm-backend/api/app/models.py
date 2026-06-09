"""
SQLModel table definitions — the single source of truth for the schema.

Design notes (interview-relevant):
  * SQLModel = SQLAlchemy core + Pydantic. Each class below is BOTH an ORM table
    and a validated Pydantic model, so the same definition drives the DB and the
    API serialization layer.
  * Enums are `str, Enum` subclasses so they store as readable strings in the DB
    and serialize to plain JSON strings over the API.
  * JSON columns (tags, items, segment_definition, payload) use an explicit
    `sa_column=Column(JSON)` — SQLAlchemy's JSON type works on both Postgres
    (native jsonb-ish) and SQLite, keeping the code engine-portable.
  * total_spend / order_count / last_order_at are intentionally NOT stored on
    Customer. They are DERIVED at query time by the segment compiler so they can
    never drift out of sync with the Order table.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


# --------------------------------------------------------------------------- #
#  Helpers
# --------------------------------------------------------------------------- #
def utcnow() -> datetime:
    """Timezone-aware UTC now. Used as default_factory so every timestamp is
    consistent and comparable regardless of server locale."""
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
#  Enums
# --------------------------------------------------------------------------- #
class Channel(str, Enum):
    WHATSAPP = "WHATSAPP"
    SMS = "SMS"
    EMAIL = "EMAIL"
    RCS = "RCS"


class CampaignStatus(str, Enum):
    DRAFT = "DRAFT"
    SENDING = "SENDING"
    SENT = "SENT"


class CommStatus(str, Enum):
    """Lifecycle of a single message to a single customer.

    The ordering here mirrors the rank table in the status machine used by the
    receipts endpoint to enforce out-of-order safety (we only ever advance).
    FAILED is a terminal side-branch handled separately.
    """
    QUEUED = "QUEUED"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    OPENED = "OPENED"
    READ = "READ"
    CLICKED = "CLICKED"
    FAILED = "FAILED"
    CONVERTED = "CONVERTED"


# --------------------------------------------------------------------------- #
#  Tables
# --------------------------------------------------------------------------- #
class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True)
    phone: str
    city: str = Field(index=True)
    # JSON list of free-form marketing tags (e.g. ["vip", "discount_lover"]).
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=utcnow)


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    amount: float
    # JSON list of line items, e.g. [{"sku": "TEE-01", "qty": 2, "price": 499}].
    items: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "PLACED"  # PLACED | DELIVERED | RETURNED | CANCELLED
    created_at: datetime = Field(default_factory=utcnow)


class Campaign(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    goal: str  # the marketer's plain-English intent
    channel: Channel
    # The validated structured segment filter (NOT raw SQL). See segment_validator.
    segment_definition: dict = Field(default_factory=dict, sa_column=Column(JSON))
    message_template: str  # contains a {name} placeholder
    status: CampaignStatus = Field(default=CampaignStatus.DRAFT)
    created_at: datetime = Field(default_factory=utcnow)


class Communication(SQLModel, table=True):
    """One row per (campaign, customer) message attempt."""
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id", index=True)
    customer_id: int = Field(foreign_key="customer.id", index=True)
    channel: Channel
    rendered_message: str  # {name} etc. already substituted
    status: CommStatus = Field(default=CommStatus.QUEUED)
    # Set when the customer converts (placed an order attributed to this message).
    converted_order_id: Optional[int] = Field(
        default=None, foreign_key="order.id"
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CommunicationEvent(SQLModel, table=True):
    """Append-only audit log of every callback received from the channel.

    The UNIQUE constraint on event_id is our idempotency guarantee: the channel
    may retry a callback, but the second insert violates the constraint and we
    treat it as a no-op (no double counting). occurred_at vs received_at lets us
    reason about out-of-order delivery: occurred_at is the channel's timeline,
    received_at is ours.
    """
    __table_args__ = (UniqueConstraint("event_id", name="uq_event_id"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    communication_id: int = Field(foreign_key="communication.id", index=True)
    event_type: str  # mirrors a CommStatus value (DELIVERED, OPENED, ...)
    event_id: str = Field(index=True)  # idempotency key (uuid4 from channel)
    occurred_at: datetime  # when the channel says it happened
    received_at: datetime = Field(default_factory=utcnow)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON))
