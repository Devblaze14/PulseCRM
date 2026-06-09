# Channel service — a simulated messaging provider

This is a **separate microservice** (its own URL, called over HTTP by the CRM)
that stands in for a real WhatsApp/SMS/Email gateway. It exists to exercise the
hard parts of an outbound-messaging system without integrating a real provider.

## What it does

`POST /send` accepts a batch of messages plus a `callback_url` and shared
`callback_secret`, returns **`202` immediately**, and then — asynchronously —
simulates the delivery lifecycle for each message, POSTing each event back to the
CRM's `/api/receipts`.

### Outcome simulation (`app/simulator.py`)
A probabilistic funnel, each stage gated on the previous:

```
~95% DELIVERED → 65% OPENED → 80% READ → 35% CLICKED → 20% CONVERTED
~5% FAILED (terminal)
```

- Each event waits a random **0.5–6s** (`asyncio.sleep`) so events trickle in.
- Each event carries a **uuid4 `event_id`** — the CRM uses it as an idempotency key.
- **~25% of sequences are deliberately delivered out of order**, by swapping two
  adjacent events' send delays while keeping their `occurred_at` truthful. This
  forces the CRM's rank-based status machine to prove it never regresses status.

### Callback delivery (`app/callbacks.py`)
- Fires callbacks with `httpx.AsyncClient`.
- **Retries** on non-2xx with **exponential backoff** (3 attempts: 0.5s, 1s, 2s).
- **Concurrency cap** via `asyncio.Semaphore` (default 20 in-flight) so a
  1000-recipient campaign doesn't open 1000 sockets at once.

## Run

```bash
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env     # CALLBACK_SECRET must MATCH the CRM API's value
uvicorn main:app --reload --port 8001
```

## What I'd do at real scale

This service is intentionally simplified. In production I would replace the
in-process `asyncio` task + `Semaphore` with:

- **A durable queue** (AWS SQS, Redis Streams, or QStash) so the `/send` handler
  just _enqueues_ and returns — work survives a process restart.
- **A worker pool** consuming the queue, with horizontal scaling and backpressure
  instead of a single-process semaphore.
- **A dead-letter queue** for callbacks that exhaust their retries, plus alerting.
- **Idempotency on the producer side too** (dedupe keys on enqueue), not only on
  the CRM consumer.
- **Per-tenant rate limiting** and provider-specific adapters (the funnel here
  would be replaced by real provider webhooks, which themselves arrive out of
  order and duplicated — exactly the conditions this simulator reproduces).

The CRM's receipts endpoint is already built for that reality: idempotent and
order-safe, so swapping the simulator for a real provider requires no change on
the consuming side.
