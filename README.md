# PulseCRM — an AI-native marketing assistant for D2C brands

A **chat-first marketing CRM**. A marketer types intent in plain English —
_"win back customers who haven't ordered in 30 days, offer 15% off"_ — and the
assistant:

1. translates it into a **structured audience segment** (via an LLM, never raw SQL),
2. shows a **live audience preview** (count + sample customers),
3. **drafts a channel-appropriate message** with a `{name}` placeholder,
4. lets the marketer **review, edit, and confirm**, then **launches** the campaign,
5. and a **dashboard** shows how the campaign performed as delivery events stream back.

AI is woven into the two places it adds the most leverage — **segmenting** and
**drafting** — not bolted on. A human always confirms before anything "sends".

> This is a marketing/engagement CRM for **reaching shoppers**. It is deliberately
> **not** a sales/support CRM — there are no deals, pipelines, leads, tickets, or
> kanban boards.

---

## Architecture

Three independently-deployable pieces:

```
┌──────────────────┐     HTTP      ┌──────────────────────┐    HTTP/send    ┌────────────────────┐
│  crm-frontend    │  ───────────▶ │   CRM API (api/)     │ ──────────────▶ │  Channel service   │
│  React + Vite    │   fetch/JSON  │   FastAPI + SQLModel │                 │  (channel/)        │
│  Tailwind/Recharts│ ◀───────────  │   Postgres (Supabase)│ ◀────────────── │  FastAPI, async    │
└──────────────────┘               └──────────────────────┘   callbacks      └────────────────────┘
                                         │   ▲                /api/receipts
                                         ▼   │
                                    ┌─────────────┐
                                    │ Groq LLM    │  intent→segment, draft, summarize
                                    └─────────────┘
```

| Service | Stack | Role | Deploy target |
|---|---|---|---|
| **crm-frontend** | React + Vite + TS, Tailwind, Recharts | Dashboard + chat campaign builder | Vercel |
| **CRM API** (`crm-backend/api`) | Python, FastAPI, SQLModel, Groq SDK | Segmentation, AI, campaigns, send, receipts, stats | Render (web service) |
| **Channel** (`crm-backend/channel`) | Python, FastAPI, httpx, asyncio | A **simulated** messaging provider with its own URL | Render (web service) |
| **Database** | Supabase Postgres | All persistence | Supabase |

The channel is a **genuinely separate service** with its own URL, called over
HTTP — never an in-process function. This is the system-design centrepiece.

---

## The send → callback loop (the core flow)

```
1. POST /api/campaigns/{id}/send
   ├─ resolve the campaign's segment filter → list of customers
   ├─ create one Communication row per customer (status QUEUED), render {name}
   ├─ POST the batch to {CHANNEL_SERVICE_URL}/send  (callback_url + shared secret)
   │     └─ channel returns 202 IMMEDIATELY; CRM does NOT await delivery
   └─ campaign status SENDING → SENT, return at once

2. Channel simulates outcomes asynchronously (asyncio)
   ├─ funnel: ~95% DELIVERED → OPENED → READ → CLICKED → small % CONVERTED; ~5% FAILED
   ├─ each stage after a random 0.5–6s delay (asyncio.sleep)
   ├─ each event is a separate callback with a uuid4 event_id
   ├─ deliberately emits SOME events out of order (to stress the CRM)
   ├─ retries on non-2xx with exponential backoff (3 attempts)
   └─ caps in-flight callbacks with an asyncio.Semaphore

3. POST /api/receipts (CRM)  — idempotent + order-safe
   ├─ verify callback_secret
   ├─ insert CommunicationEvent with UNIQUE event_id  → duplicate = no-op (idempotency)
   ├─ advance Communication.status only if rank(incoming) > rank(current)  → never regress
   └─ return 2xx fast so the channel doesn't needlessly retry

4. GET /api/campaigns/{id}/stats  → cumulative funnel + rates + one-line AI insight
```

**Why these choices matter (and were verified end-to-end against real Supabase):**

- **Idempotency** — the channel retries, so the same `event_id` can arrive twice.
  A `UNIQUE` constraint on `CommunicationEvent.event_id` makes the second insert a
  no-op. _Verified: 77 events received = 77 unique ids → zero double-counting._
- **Out-of-order safety** — callbacks can arrive in any order. A rank-based status
  machine only ever advances status; a late `OPENED` after `CLICKED` is logged but
  never pulls status backward. _Verified: scrambled callbacks, status stayed monotonic._
- **Persist-before-channel** — Communications are committed before the channel call,
  so the audience is durable even if the channel is unreachable.

---

## The AI showpiece: intent → structured segment (no raw SQL)

The LLM **never writes SQL**. It outputs a small, fixed-schema JSON filter:

```json
{ "all": [
    { "field": "last_order_at", "op": "before", "value": "30d_ago" },
    { "field": "total_spend",   "op": "gte",    "value": 5000 }
] }
```

This passes through three layers (`crm-backend/api/app/lib/`):

1. **`segment_schema.py`** — the allowed fields, types, and operators (single
   source of truth; the AI's system prompt is generated _from_ this so they can't drift).
2. **`segment_validator.py`** — a strict whitelist gate. Unknown field/operator/value
   shape → rejected with a user-safe message. _This is what makes AI output safe to run._
3. **`segment_compiler.py`** — compiles the validated filter into a **parameterized
   SQLAlchemy query**. Every value is a bound parameter — **SQL injection is impossible
   by construction**, even though an LLM produced the input.

Derived fields (`total_spend`, `order_count`, `last_order_at`) are **computed at
query time** from the `Order` table (grouped subquery + LEFT JOIN), never stored —
so they can't drift out of sync.

---

## Data model (SQLModel)

| Table | Purpose |
|---|---|
| **Customer** | name, email, phone, city, tags (JSON). Spend/recency derived in queries. |
| **Order** | customer_id, amount, items (JSON), status, created_at. |
| **Campaign** | name, goal, channel, segment_definition (JSON), message_template, status. |
| **Communication** | one row per (campaign, customer): rendered_message, status, converted_order_id. |
| **CommunicationEvent** | append-only callback log. `event_id` is UNIQUE (idempotency key). |

---

## Running locally

### Prerequisites
- Python 3.11+, Node 18+, a Supabase Postgres URL, a Groq API key.
- **Network note:** some ISPs/routers block outbound Postgres ports (5432/6543).
  If the API can't reach Supabase, use a VPN (Cloudflare WARP works) or a mobile
  hotspot. This only affects local dev — Render is unrestricted.

### 1. CRM API
```bash
cd crm-backend/api
python -m venv .venv && .venv/Scripts/activate      # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env      # then fill in DATABASE_URL, GROQ_API_KEY, etc.
python -m app.seed        # seed ~500 customers + ~2000 orders
uvicorn main:app --reload --port 8000
```

### 2. Channel service
```bash
cd crm-backend/channel
python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env      # set CALLBACK_SECRET to MATCH the api's CALLBACK_SECRET
uvicorn main:app --reload --port 8001
```

### 3. Frontend
```bash
cd crm-frontend
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm run dev               # http://localhost:5173
```

Open http://localhost:5173 → **Campaign Builder** → type an intent → launch → watch
the funnel fill on the campaign detail page.

---

## Deployment

- **Frontend → Vercel**: set `VITE_API_URL` to the Render API URL.
- **CRM API → Render** (web service): root `crm-backend/api`, start
  `uvicorn main:app --host 0.0.0.0 --port $PORT`. Set all `api/.env` vars.
- **Channel → Render** (web service): root `crm-backend/channel`, start
  `uvicorn main:app --host 0.0.0.0 --port $PORT`. `CALLBACK_SECRET` must match the API.
  Point the API's `CHANNEL_SERVICE_URL` and `CRM_BASE_URL` at the deployed URLs.

---

## What I chose **NOT** to build (and why)

- **A real messaging integration.** The channel is a faithful _simulator_ — the
  assignment explicitly asks not to integrate a real provider, and the interesting
  engineering (async funnel, retries, idempotency, ordering) is all exercised without one.
- **A durable queue.** The channel fires callbacks from in-process `asyncio` tasks
  bounded by a `Semaphore`. **At real scale** this would be a queue (SQS / Redis /
  QStash) feeding a worker pool, with a dead-letter queue for exhausted retries — see
  `crm-backend/channel/README.md`. This is an intentional, documented simplification.
- **Auth / multi-tenancy.** Out of scope for a single-marketer take-home.
- **Sales/support CRM features** (deals, pipelines, tickets) — explicitly excluded by the brief.
- **Arbitrary nested segment logic.** The filter supports one level of `all`/`any`
  (AND/OR), which covers real marketing segments while keeping the validator and
  compiler trivially auditable and injection-safe.
- **Migrations.** Tables are created via SQLModel `create_all` on boot (idempotent).
  A production app would use Alembic.

---

## Repo layout

```
crm-frontend/                 → Vercel
  src/{pages,components,api,lib}
crm-backend/                  → Render (two services from one repo)
  api/      app/{routers,services,lib}, models.py, schemas.py, seed.py, main.py
  channel/  app/{simulator,callbacks}, main.py
```

Each service has its own `requirements.txt` / `package.json`, `.env.example`, and
its own start command. See each folder for details; `crm-backend/channel/README.md`
covers the scale story for the messaging layer.
