"""
Channel service — a standalone fake messaging provider (Render service #2).

It is a SEPARATE service from the CRM with its own URL, talked to over HTTP.
Flow:
  CRM  --POST /send (batch + callback_url + secret)-->  channel
  channel  --202 Accepted immediately-->  CRM   (CRM does not await delivery)
  channel  --(async, delayed, retried)-->  POST callback_url for each event

Run locally:  uvicorn main:app --reload --port 8001
"""

from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.callbacks import run_batch
from app.simulator import plan_outcomes

app = FastAPI(title="PulseCRM Channel", version="0.1.0")

# Shared secret this service expects from callers (the CRM). We verify the
# incoming callback_secret against it so a misconfigured CRM is rejected early,
# then echo the same secret back on callbacks so the CRM can authenticate us.
# When unset (e.g. quick local runs) we skip the check.
EXPECTED_SECRET = os.getenv("CALLBACK_SECRET", "")


# --------------------------------------------------------------------------- #
#  Request schema
# --------------------------------------------------------------------------- #
class OutboundMessage(BaseModel):
    communication_id: int
    recipient: str
    channel: str
    message: str


class SendRequest(BaseModel):
    messages: list[OutboundMessage]
    callback_url: str       # where to POST lifecycle events (CRM /api/receipts)
    callback_secret: str    # echoed back so the CRM can authenticate callbacks


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/send", status_code=202)
async def send(req: SendRequest) -> dict:
    """Accept a batch, return 202 immediately, simulate delivery in the background.

    We build a per-message outcome plan synchronously (cheap), then fire the
    delayed/retried callbacks as a detached asyncio task so the HTTP response
    returns at once — the CRM is never blocked on delivery.
    """
    # Reject a caller whose secret doesn't match ours (when one is configured).
    if EXPECTED_SECRET and req.callback_secret != EXPECTED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid callback_secret.")

    plans = [plan_outcomes(m.communication_id) for m in req.messages]

    # Fire-and-forget: schedule the callback delivery without awaiting it.
    # (At real scale this hand-off would be an enqueue onto a durable queue.)
    asyncio.create_task(
        run_batch(plans, req.callback_url, req.callback_secret)
    )

    return {
        "accepted": len(req.messages),
        "events_scheduled": sum(len(p.events) for p in plans),
    }
