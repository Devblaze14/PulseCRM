# PulseCRM

An AI-native marketing CRM for online brands.

You describe a campaign in plain English ("win back customers who haven't ordered in 30 days, give them 15% off") and PulseCRM works out who to target, drafts the message, sends it once you approve, and reports back on how it did. It all happens in one chat interface.

You set the goal; the AI handles the tedious parts (building the audience, writing the copy). Nothing goes out until you click Launch.

## How it works

A typical run takes about half a minute:

1. In the Campaign Builder you type a target audience: *"customers in Mumbai who spent over ₹5,000."*
2. PulseCRM resolves the segment live ("312 customers match"), shows a sample list so you can sanity-check the audience, and prints a one-line rationale explaining the segment it chose (*"lapsed high-value: 2+ orders, nothing in 60 days"*) so you understand the AI's reasoning before committing.
3. It drafts a message you can edit, e.g. *"Hi {name}, here's 15% off just for you 🛍️"*.
4. You pick a channel (WhatsApp / SMS / Email) and launch.
5. The campaign page updates live through the funnel — delivered, opened, clicked, converted — alongside the **attributed revenue** each conversion drove (sampled from each customer's own order history), with a short AI summary like *"Strong 28% click rate; next, improve the landing page to lift conversions."* The dashboard rolls the same revenue up across every campaign.

No spreadsheets, SQL, or manual segmentation.

A floating assistant is available on every page from the bottom-right corner. It answers questions about campaign performance, audience targeting, and message drafting, using your live funnel numbers (delivery, open, click and conversion rates, plus attributed revenue in ₹) so its figures match the dashboard. Quick-action buttons cover the common questions.

## Architecture

PulseCRM is three independent services talking over HTTP. Keeping them separate lets each stay focused and deploy on its own.

![PulseCRM service architecture](docs/architecture.png)

```
   User (browser)
        │
        ▼
 ┌──────────────┐     "find these customers,       ┌──────────────┐
 │   Frontend   │      send this message"           │   CRM API    │
 │     (UI)     │ ────────────────────────────────▶ │  (the core)  │
 │              │ ◀──────────────────────────────── │              │
 └──────────────┘     audience counts, stats         └──────┬───────┘
                                                      asks AI │ │ reads/writes
                                                             ▼ │ ▼
                                            ┌─────────┐   ┌──────────────┐
                                            │  Groq   │   │  Supabase    │
                                            │  (LLM)  │   │  (database)  │
                                            └─────────┘   └──────────────┘
                                                             ▲
                             "deliver these messages"        │ delivery updates
                                        │                    │ (callbacks)
                                        ▼                    │
                                  ┌──────────────────────────┴───┐
                                  │   Channel service             │
                                  │  (simulated WhatsApp/SMS)     │
                                  └───────────────────────────────┘
```

### Services

| Service | Responsibility | Stack | Hosted on |
|---|---|---|---|
| Frontend | The web app — dashboard, chat builder, charts. | React, Vite, TypeScript, Tailwind, Recharts | Vercel |
| CRM API | The core. Resolves segments, calls the LLM, persists data, kicks off sends. | Python, FastAPI, SQLModel | Render |
| Channel | A simulated messaging provider standing in for WhatsApp/SMS, modelling the async behaviour of a real gateway. | Python, FastAPI, asyncio | Render |

Two managed services are used but not self-hosted:

- Groq — the LLM that turns natural language into structured data and writes copy.
- Supabase — hosted Postgres for all persistent data.

The Channel is a separate service on purpose. Real messaging providers *are* separate networked services: they're slow, they fail, and they report results asynchronously through callbacks. Modelling that for real (instead of a plain function call) is where most of the interesting engineering lives.

## Core flow: send → results

This is the heart of the system. When you launch a campaign:

**1. The CRM API prepares and sends** (`POST /api/campaigns/{id}/send`)
- Resolves the full customer list for the segment.
- Creates one message record per customer (status `QUEUED`) with the recipient's name.
- Hands the batch to the Channel service, along with a callback address and a shared secret.
- The Channel acknowledges right away (`202`); the CRM doesn't block on delivery. The campaign is marked `SENT` and control returns to the user.

**2. The Channel simulates delivery** (in the background)
- For each message it advances the funnel probabilistically: ~95% delivered, then a subset opened, fewer read, fewer clicked, a few converted; ~5% fail.
- Each step fires after a short random delay and reports back to the CRM as its own callback.
- It deliberately reproduces two realistic headaches: it sends some updates out of order, and it retries when the CRM is briefly unavailable.

**3. The CRM records updates safely** (`POST /api/receipts`)
- Verifies the shared secret.
- Idempotent: every update carries a unique ID, so duplicate deliveries from retries are ignored.
- Monotonic: status only moves forward. A late "opened" arriving after "clicked" won't roll the status back.

**4. Live reporting**
- The campaign page polls for stats; the funnel chart fills in live, with a plain-English AI insight on top.

The flow has been exercised end-to-end locally — seed → AI-proposed segment →
launch → the channel's (out-of-order, retried) callbacks → live stats — and the
awkward cases are covered by an automated test suite (`crm-backend/api/tests/`,
pytest on in-memory SQLite). The suite pins the engine-portable invariants:
- a replayed conversion (same event id) is counted once — no double revenue;
- a higher-rank status arriving before a lower one never rolls status backward;
- per-message `attributed_amount` sums correctly into a campaign's `attributed_revenue`;
- a segment proposal missing its AI rationale still previews fine (no 500);
- the validator still rejects an unknown filter field — the AI→DB gate holds.

Run them with `pytest` from `crm-backend/api`. The tests deliberately stay on
portable logic (status machine, idempotency dedup, revenue aggregation, the
validator); anything that only holds on Postgres (JSON operators) is left to the
live database rather than approximated on SQLite.

## Safety: the AI can't touch the database directly

A fair question when an AI is picking customers: can it run something dangerous? Here it can't, and that's enforced structurally rather than by trust.

The AI never writes SQL. It only emits a small, fixed-shape JSON "recipe":

```json
{ "all": [
    { "field": "last_order_at", "op": "before", "value": "30d_ago" },
    { "field": "total_spend",   "op": "gte",    "value": 5000 }
] }
```

That recipe passes through three gates before it reaches the database:

1. **Schema** (`segment_schema.py`) — the authoritative list of allowed fields and operators. The AI's instructions are generated from this list, so they can't drift apart.
2. **Validator** (`segment_validator.py`) — rejects anything off the allowed list with a clear error. This is what makes the AI's output safe to run.
3. **Compiler** (`segment_compiler.py`) — turns the approved recipe into a real query where every value is a bound parameter. SQL injection isn't possible even though an AI produced the input.

Derived metrics like total spend and last order date are computed live from the orders table, so they're always current.

## Data model

| Table | Description |
|---|---|
| Customer | A shopper: name, email, city, tags. (Spend and recency are computed, not stored.) |
| Order | A purchase: amount, items, date. |
| Campaign | A marketing campaign: goal, audience recipe, message, status. |
| Communication | One message to one customer, with its current status. |
| CommunicationEvent | A log of every delivery update received. Each has a unique ID — that's what prevents double-counting. |

## Getting data in

Two things feed the database:

- **Seed generator** (`python -m app.seed`) — ~500 realistic customers and ~2000 orders, grouped into personas (vip / lapsed / new / regular) so segments are meaningful out of the box. This is what you'd run for a demo.
- **Ingestion API** — `POST /api/customers` and `POST /api/orders`, each accepting a single record or a bulk array and returning a `{created, skipped, errors}` summary. New customers are inserted, duplicate emails are skipped (so re-running a batch is harmless), and orders referencing an unknown customer are reported rather than inserted as orphans. Because spend and recency are *derived* from the orders table at query time, anything ingested here immediately shows up in segments, previews, and campaign stats — there's nothing extra to recompute. See [`crm-backend/api`](crm-backend/api/README.md#ingesting-data) for examples.

## Running locally

Open three terminals, one per service.

**Terminal 1 — CRM API**
```bash
cd crm-backend/api
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
copy .env.example .env            # then fill in DATABASE_URL, GROQ_API_KEY, ...
python -m app.seed                # creates ~500 demo customers + ~2000 orders
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Channel service**
```bash
cd crm-backend/channel
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env            # set CALLBACK_SECRET to the SAME value as the API's
uvicorn main:app --reload --port 8001
```

**Terminal 3 — Frontend**
```bash
cd crm-frontend
npm install
copy .env.example .env            # VITE_API_URL=http://localhost:8000
npm run dev                       # serves http://localhost:5173
```

Then open http://localhost:5173, go to Campaign Builder, type something like *"win back customers who haven't ordered in 30 days,"* and launch it. Watch the campaign page fill in live.

## Deployment

| Service | Platform | Configuration |
|---|---|---|
| Frontend | Vercel | Build `npm run build`, output `dist/`. Set `VITE_API_URL` to the API's URL. |
| CRM API | Render | Root `crm-backend/api`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`. |
| Channel | Render | Root `crm-backend/channel`, same start command on its own URL. |

`crm-backend/render.yaml` describes both backend services so Render can provision them from one repo. After deploying, point the API's `CHANNEL_SERVICE_URL` and `CRM_BASE_URL` at the live URLs, and make sure `CALLBACK_SECRET` matches on both.

## Scope and trade-offs

A few things are deliberately out of scope:

- **No real messaging integration.** The simulator already covers the parts that matter: async delivery, retries, idempotency, and out-of-order handling. You don't need a paid provider account to see those working.
- **No heavy job queue.** The Channel dispatches callbacks with lightweight in-process async tasks under a concurrency cap. At real scale you'd swap in a managed queue (SQS, Redis, or QStash) and a worker pool, as described in [`crm-backend/channel/README.md`](crm-backend/channel/README.md). The CRM side already handles that case.
- **No auth or multi-tenancy.** It's a single-user setup, which is all this needs.
- **No sales-CRM features** (deals, pipelines, support tickets). This is a tool for reaching shoppers, not running a sales team.
- **No deeply nested filters.** One level of AND/OR covers real marketing segments and keeps the safety checks easy to audit.

## Project structure

```
crm-frontend/                        the UI  → Vercel
  src/pages/        Dashboard, Chat (builder), Campaigns, CampaignDetail, Customers
  src/components/   reusable UI (Sidebar, Card, StatTile, charts, AssistantWidget, …)
  src/api/          typed wrappers around the backend
  src/lib/          shared types and formatting helpers

crm-backend/                         → Render (two services, one repo)
  api/        the core
    app/routers/    HTTP endpoints (thin — receive and respond; incl. ingest)
    app/services/   business logic (segment, campaign, send, receipt, stats, ai, ingest)
    app/lib/        the segment pipeline and status rules
    app/models.py   database tables
    app/seed.py     demo-data generator
  channel/    the simulated messaging provider
    app/simulator.py   determines each message's outcome
    app/callbacks.py   sends updates back, with retries and a concurrency limit
  render.yaml        deployment config for both services
```

Each directory has its own README with more detail:
[`crm-backend/api`](crm-backend/api/README.md) ·
[`crm-backend/channel`](crm-backend/channel/README.md) ·
[`crm-frontend`](crm-frontend/README.md)
