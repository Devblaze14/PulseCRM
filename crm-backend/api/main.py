"""
CRM backend FastAPI entrypoint.

Wires the database lifecycle, CORS for the frontend, and all routers
(segments, ai, campaigns, receipts, stats, customers).

Run locally:  uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.lib.db import init_db
from app.routers import ai, campaigns, customers, receipts, segments, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on boot. In production with Supabase you'd typically manage
    # schema via migrations, but create_all is fine for this take-home and is
    # idempotent (won't drop or alter existing tables).
    init_db()
    yield


app = FastAPI(title="PulseCRM API", version="0.1.0", lifespan=lifespan)

# CORS so the Vite frontend (different origin) can call the API from the browser.
# We allow the local dev origin and the configured frontend URL. For this
# take-home we keep it permissive; in production you'd lock this to known origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router includes. Each router owns its own /api/... prefix.
app.include_router(segments.router)
app.include_router(ai.router)
app.include_router(campaigns.router)
app.include_router(receipts.router)
app.include_router(stats.router)
app.include_router(customers.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# `settings` imported so config is validated at startup (fail fast on bad env).
_ = settings
