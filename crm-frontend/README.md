# crm-frontend

React + Vite + TypeScript dashboard for PulseCRM. Tailwind for styling, Recharts
for the funnel charts. See the [root README](../README.md) for architecture.

## Screens

| Route | Page | What it does |
|---|---|---|
| `/` | **Dashboard** | Overall stat tiles, engagement funnel, recent campaigns. |
| `/chat` | **Campaign Builder** (hero) | Chat → AI segment + live audience preview → editable draft → Launch. |
| `/campaigns` | **Campaigns** | All campaigns with status. |
| `/campaigns/:id` | **Campaign Detail** | Per-campaign funnel, AI insight, live-polling communications table. |
| `/customers` | **Customers** | Searchable table with total_spend, order_count, last_order_at. |

## Layout

```
src/
  pages/        the five screens above
  components/   Sidebar, TopBar, StatTile, Card, MessageBubble, AudiencePreview, StatusBadge
  api/          client.ts (typed fetch wrapper) + index.ts (per-resource calls)
  lib/          types.ts (mirror of backend schemas), format.ts (INR/date/percent helpers)
```

`src/lib/types.ts` mirrors the backend's Pydantic schemas, so the whole app shares
one typed contract with the API — a backend field change surfaces as a TS error.

## Run

```bash
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:8000
npm run dev               # http://localhost:5173
npm run build             # type-check + production build → dist/
```

The campaign builder and detail page hit the CRM API, which needs the database
reachable (run the API with a VPN/hotspot if your network blocks Postgres ports —
see root README).

## Deploy (Vercel)

Set `VITE_API_URL` to the deployed Render API URL. Build command `npm run build`,
output dir `dist`.
