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


def plan_outcomes(communication_id: int) -> SimPlan:
    """Build the full event sequence for one message.

    We assign each event a CUMULATIVE delay along a timeline and an occurred_at
    that matches that timeline. `occurred_at` always reflects the TRUE order even
    when we deliberately send the callbacks out of order — that's exactly the
    signal the CRM relies on to recover the real sequence.
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
                    events.append(
                        _new_event("CONVERTED", now + timedelta(seconds=d), d)
                    )

    # Deliberately make callbacks ARRIVE out of order sometimes.
    #
    # Each event is delivered after its own `delay` (asyncio.sleep), so arrival
    # order is governed by delay, NOT list position. To genuinely invert arrival
    # we SWAP THE DELAYS of two adjacent events — now a logically-later event
    # (e.g. READ) physically arrives before an earlier one (e.g. OPENED).
    #
    # We intentionally do NOT touch occurred_at: it keeps encoding the true
    # timeline, which is the signal the CRM's status machine uses to avoid
    # regressing status when callbacks land out of order.
    if len(events) >= 2 and random.random() < P_OUT_OF_ORDER:
        i = random.randint(0, len(events) - 2)
        events[i].delay, events[i + 1].delay = (
            events[i + 1].delay,
            events[i].delay,
        )

    return SimPlan(communication_id, events)
