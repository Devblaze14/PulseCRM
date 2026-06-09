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
    receipts.py   POST /api/receipts   (idempotent, order-safe callback sink)
    stats.py      GET /api/stats/overview
    customers.py  GET /api/customers   (searchable, with derived metrics)
  services/   business logic (segment, campaign, send, receipt, stats, ai, customer)
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
