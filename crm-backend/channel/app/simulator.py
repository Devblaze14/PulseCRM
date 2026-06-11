"""
simulator — turns one outbound message into a realistic sequence of lifecycle
events (DELIVERED → OPENED → READ → CLICKED → CONVERTED, or FAILED).

This is the "fake messaging provider". It does NOT talk to any real network; it
models what a WhatsApp/SMS gateway would report back, with:
  * a probabilistic funnel (most messages deliver; fewer open; fewer click; etc.),
  * a random delay before each event (asyncio.sleep) so events trickle in,
  * deliberate occasional OUT-OF-ORDER emission, so the CRM's ordering logic is
    actually exercised in practice (not just in theory).

Each event carries a uuid4 `event_id` — the CRM uses it as an idempotency key.
"""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# Funnel probabilities. Each is conditional on reaching the previous stage.
P_DELIVERED = 0.95   # ~5% fail outright
P_OPENED = 0.65      # of delivered
P_READ = 0.80        # of opened
P_CLICKED = 0.35     # of read
P_CONVERTED = 0.20   # of clicked

# Per-stage delay range (seconds) — kept short so demos complete quickly.
DELAY_MIN, DELAY_MAX = 0.5, 6.0

# Attributed order value range (INR) for a conversion. The actual amount is
# derived DETERMINISTICALLY from the communication_id (see _conversion_amount)
# so the same conversion always reports the same money — replays don't drift.
CONV_AMOUNT_MIN, CONV_AMOUNT_MAX = 499, 7999

# Probability that we shuffle a generated sequence slightly out of order before
# sending, to stress-test the CRM's rank-based status machine.
P_OUT_OF_ORDER = 0.25


@dataclass
class SimEvent:
    """One lifecycle event to be delivered to the CRM as a callback."""
    event_type: str          # DELIVERED | OPENED | READ | CLICKED | CONVERTED | FAILED
    event_id: str            # uuid4 idempotency key
    delay: float             # seconds to wait (cumulative timeline) before sending
    occurred_at: datetime    # the channel's notion of when it happened
    # Order value attributed to a CONVERTED event (INR). None for non-conversions.
    # Deterministic per communication so a replayed callback carries the SAME
    # amount — the CRM's idempotency guard then makes re-attribution a no-op.
    order_amount: float | None = None


@dataclass
class SimPlan:
    communication_id: int
    events: list[SimEvent] = field(default_factory=list)


def _new_event(event_type: str, occurred_at: datetime, delay: float) -> SimEvent:
    return SimEvent(
        event_type=event_type,
        event_id=str(uuid.uuid4()),
        delay=delay,
        occurred_at=occurred_at,
    )


def _conversion_amount(communication_id: int) -> float:
    """A stable, deterministic order value (INR) for a conversion.

    Derived from communication_id alone — NOT from random.* — so it is identical
    every time this message converts, including on a retried/replayed callback.
    That stability is what lets the CRM treat a duplicate conversion event as a
    true no-op (same event_id, same amount) and never double-count revenue.
    """
    span = CONV_AMOUNT_MAX - CONV_AMOUNT_MIN
    # Simple, stable hash of the id into the [MIN, MAX] band, rounded to whole ₹.
    amount = CONV_AMOUNT_MIN + (communication_id * 2654435761) % (span + 1)
    return float(amount)


def plan_outcomes(communication_id: int) -> SimPlan:
    """Build the full event sequence for one message.

    We assign each event a CUMULATIVE delay along a timeline and an occurred_at
    that matches that timeline. `occurred_at` always reflects the TRUE order even
    when we deliberately send the callbacks out of order; it's carried as an audit
    record of the channel's real timeline. (The CRM keeps status monotonic via the
    rank-based status machine rather than by reading occurred_at.)
    """
    now = datetime.now(timezone.utc)
    events: list[SimEvent] = []
    t = 0.0  # cumulative seconds along the simulated timeline

    def step() -> float:
        nonlocal t
        t += random.uniform(DELAY_MIN, DELAY_MAX)
        return t

    # FAILED branch: terminal, no further events.
    if random.random() > P_DELIVERED:
        d = step()
        events.append(_new_event("FAILED", now + timedelta(seconds=d), d))
        return SimPlan(communication_id, events)

    # DELIVERED
    d = step()
    events.append(_new_event("DELIVERED", now + timedelta(seconds=d), d))

    # OPENED → READ → CLICKED → CONVERTED, each gated by its probability.
    if random.random() < P_OPENED:
        d = step()
        events.append(_new_event("OPENED", now + timedelta(seconds=d), d))

        if random.random() < P_READ:
            d = step()
            events.append(_new_event("READ", now + timedelta(seconds=d), d))

            if random.random() < P_CLICKED:
                d = step()
                events.append(_new_event("CLICKED", now + timedelta(seconds=d), d))

                if random.random() < P_CONVERTED:
                    d = step()
                    conv = _new_event("CONVERTED", now + timedelta(seconds=d), d)
                    # Attach a deterministic order value so the CRM can attribute
                    # revenue to this communication.
                    conv.order_amount = _conversion_amount(communication_id)
                    events.append(conv)

    # Deliberately make callbacks ARRIVE out of order sometimes.
    #
    # Each event is delivered after its own `delay` (asyncio.sleep), so arrival
    # order is governed by delay, NOT list position. To genuinely invert arrival
    # we SWAP THE DELAYS of two adjacent events — now a logically-later event
    # (e.g. READ) physically arrives before an earlier one (e.g. OPENED).
    #
    # We intentionally do NOT touch occurred_at: it keeps encoding the true
    # timeline as an audit record. The CRM's rank-based status machine is what
    # actually prevents status from regressing when callbacks land out of order.
    if len(events) >= 2 and random.random() < P_OUT_OF_ORDER:
        i = random.randint(0, len(events) - 2)
        events[i].delay, events[i + 1].delay = (
            events[i + 1].delay,
            events[i].delay,
        )

    return SimPlan(communication_id, events)
