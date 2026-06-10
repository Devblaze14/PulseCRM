"""
CRM backend FastAPI entrypoint.

Wires the database lifecycle, CORS for the frontend, and all routers
(segments, ai, campaigns, receipts, stats, customers).

Run locally:  uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.lib.db import init_db
from app.routers import ai, campaigns, customers, receipts, segments, stats

logger = logging.getLogger("pulsecrm.startup")


def _warn_on_misconfig() -> None:
    """Emit loud warnings if prod-critical settings are still dev defaults."""
    if settings.DATABASE_URL.startswith("sqlite"):
        logger.warning("DATABASE_URL is still SQLite (%s) — not for production.", settings.DATABASE_URL)
    if "localhost" in settings.CHANNEL_SERVICE_URL or "localhost" in settings.CRM_BASE_URL:
        logger.warning("CHANNEL_SERVICE_URL / CRM_BASE_URL still point at localhost.")
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is empty — AI features will fail.")
    if settings.CALLBACK_SECRET == "dev-secret-change-me":
        logger.warning("CALLBACK_SECRET is still the insecure default — change it in production.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on boot. In production with Supabase you'd typically manage
    # schema via migrations, but create_all is fine for this take-home and is
    # idempotent (won't drop or alter existing tables).
    _warn_on_misconfig()
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
