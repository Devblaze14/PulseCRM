"""
callbacks — delivers simulated lifecycle events back to the CRM as HTTP POSTs.

Responsibilities (the system-design test, brief §9):
  * Fire callbacks asynchronously with httpx.AsyncClient.
  * RETRY on non-2xx with exponential backoff (3 attempts).
  * Cap in-flight callbacks with an asyncio.Semaphore so a 1000-recipient
    campaign doesn't open 1000 sockets at once.
  * Respect each event's scheduled delay (asyncio.sleep) so events trickle in,
    and honour the (sometimes scrambled) order the simulator produced.

At real scale this would be a durable queue (SQS/Redis/QStash) with a worker
pool and a dead-letter queue — see channel/README. This in-process version is a
deliberate simplification appropriate to the take-home.
"""

from __future__ import annotations

import asyncio

import httpx

from app.simulator import SimEvent, SimPlan

# Global cap on concurrent outbound callbacks across ALL in-flight sends.
MAX_CONCURRENT_CALLBACKS = 20
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_CALLBACKS)

RETRY_ATTEMPTS = 3
BACKOFF_BASE = 0.5  # seconds; doubles each retry: 0.5, 1.0, 2.0


async def _post_with_retry(
    client: httpx.AsyncClient, url: str, body: dict
) -> bool:
    """POST `body` to `url`, retrying on failure with exponential backoff.

    Returns True if the CRM acknowledged with a 2xx, else False after all
    attempts. The semaphore bounds how many of these run concurrently.
    """
    async with _semaphore:
        for attempt in range(RETRY_ATTEMPTS):
            try:
                resp = await client.post(url, json=body, timeout=10.0)
                if 200 <= resp.status_code < 300:
                    return True
                # Non-2xx (e.g. CRM transiently 500s) → fall through to backoff.
            except httpx.HTTPError:
                # Network error → also retry.
                pass

            if attempt < RETRY_ATTEMPTS - 1:
                await asyncio.sleep(BACKOFF_BASE * (2 ** attempt))
        return False


async def _deliver_event(
    client: httpx.AsyncClient,
    callback_url: str,
    callback_secret: str,
    communication_id: int,
    event: SimEvent,
) -> None:
    """Wait the event's delay, then POST it to the CRM's receipts endpoint."""
    await asyncio.sleep(event.delay)
    body = {
        "communication_id": communication_id,
        "event_type": event.event_type,
        "event_id": event.event_id,                  # idempotency key
        "occurred_at": event.occurred_at.isoformat(),
        "callback_secret": callback_secret,
    }
    # The callback carries only the lifecycle signal — no money. Revenue is
    # attributed CRM-side from the customer's own order history (the channel has
    # no DB access), so a conversion event is just CONVERTED like any other.
    await _post_with_retry(client, callback_url, body)


async def run_plan(
    plan: SimPlan, callback_url: str, callback_secret: str
) -> None:
    """Fire all events for one message concurrently.

    Each event awaits its own delay independently, so they self-schedule along
    the timeline. Because the simulator may have scrambled the event order, the
    callbacks can genuinely arrive out of order at the CRM.
    """
    async with httpx.AsyncClient() as client:
        await asyncio.gather(
            *(
                _deliver_event(
                    client, callback_url, callback_secret, plan.communication_id, ev
                )
                for ev in plan.events
            )
        )


async def run_batch(
    plans: list[SimPlan], callback_url: str, callback_secret: str
) -> None:
    """Run every message's plan concurrently. The semaphore inside the POST layer
    is what actually bounds load — gather() just kicks them all off."""
    await asyncio.gather(
        *(run_plan(p, callback_url, callback_secret) for p in plans)
    )
