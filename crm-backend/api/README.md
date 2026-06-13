# CRM API

The main backend: segmentation, AI, campaigns, sending, receipts, and stats.
FastAPI + SQLModel over Supabase Postgres. See the [root README](../../README.md)
for the full architecture and the send→callback loop.

## Layout

```
app/
  routers/    HTTP layer only (parse, delegate, map errors). No business logic.
    segments.py   POST /api/segments/preview
    ai.py         POST /api/ai/intent-to-segment, /api/ai/draft-message
    campaigns.py  CRUD + POST /{id}/send, GET /{id}/communications, /{id}/stats
    ingest.py     POST /api/customers, /api/orders   (data ingestion, single or bulk)
    receipts.py   POST /api/receipts   (idempotent, order-safe callback sink)
    stats.py      GET /api/stats/overview
    customers.py  GET /api/customers   (searchable, with derived metrics)
  services/   business logic (segment, campaign, send, receipt, stats, ai, customer, ingest)
  lib/        db, segment_schema, segment_validator, segment_compiler, status_machine
  models.py   SQLModel tables (the schema)
  schemas.py  Pydantic request/response models (the wire contract)
  config.py   pydantic-settings (env)
  seed.py     faker data generator
main.py       app + CORS + router includes
```

**Separation of concerns:** routers → services → lib. Route handlers contain no
business logic; services own it; `lib/` holds the reusable, testable primitives
(the segment pipeline and the status machine).

## Run

```bash
python -m venv .venv && .venv/Scripts/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # fill DATABASE_URL, GROQ_API_KEY, GROQ_MODEL, CALLBACK_SECRET, ...
python -m app.seed         # ~500 customers, ~2000 orders (personas: vip/lapsed/new/regular)
uvicorn main:app --reload --port 8000
```

Interactive API docs at http://localhost:8000/docs.

## Ingesting data

Two endpoints take customers and orders into the system over JSON. Each accepts a
**single object or a bulk array**, and returns a `{created, skipped, errors}`
summary. The seed CLI is for demos; these are how data gets in through the product.

```bash
# Customers — new emails are created; existing emails are skipped (safe to re-run).
curl -X POST http://localhost:8000/api/customers -H "Content-Type: application/json" \
  -d '[{"name":"Asha Rao","email":"asha@example.com","phone":"+919000000001","city":"Mumbai","tags":["vip"]}]'
# -> {"created":1,"skipped":0,"errors":[]}

# Orders — customer_id must reference an existing customer; bad records are
# reported in `errors` and skipped (never inserted as orphans).
curl -X POST http://localhost:8000/api/orders -H "Content-Type: application/json" \
  -d '[{"customer_id":1,"amount":1200,"status":"DELIVERED","items":[{"sku":"TEE-01","qty":1,"price":1200}]}]'
# -> {"created":1,"skipped":0,"errors":[]}
```

Notes:
- **Skip & report**, not all-or-nothing: a malformed record is reported and excluded; valid records in the same batch still commit (the batch commits once, at the end).
- Ingested orders flow straight into segments and stats — `total_spend`, `order_count`, and `last_order_at` are derived from the orders table at query time, so there is nothing extra to recompute.
- Max 5000 records per request; order `status` ∈ `{PLACED, DELIVERED, RETURNED, CANCELLED}`.

## Tests

```bash
pytest                      # from crm-backend/api
```

`tests/` runs on in-memory SQLite (no DB or Groq key needed) and pins the
engine-portable invariants: conversion replays are counted once (idempotency),
status never regresses on out-of-order callbacks, `attributed_amount` sums into
`attributed_revenue`, a segment proposal with no AI rationale still previews, the
validator still rejects unknown filter fields, and ingestion skips duplicate
emails / rejects orphan orders while ingested data flows into derived metrics.
Postgres-specific behaviour
(JSON operators) is left to the live database rather than approximated on SQLite.

## Seed

`python -m app.seed` wipes and regenerates customers + orders. Personas control
order count, spend, and recency so segments are meaningful:

| Persona | Share | Recency of last order | Use case |
|---|---|---|---|
| vip | ~10% | 0–20 days | high-spend / loyalty |
| lapsed | ~25% | 35–170 days | win-back ("no order in 30d") |
| new | ~15% | 0–14 days | onboarding |
| regular | ~50% | 5–60 days | baseline |

Flags: `--customers N` (default 500), `--keep` (seed only if empty).

## Environment

See `.env.example`. `DATABASE_URL` defaults to local SQLite if unset, so the app
boots without secrets; supply the Supabase `postgresql+psycopg://...` URL for real
data. `CALLBACK_SECRET` **must match** the channel service's value.
