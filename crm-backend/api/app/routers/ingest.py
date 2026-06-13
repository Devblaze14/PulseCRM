"""
/api/customers and /api/orders (POST) — ingest data into the system.

Thin HTTP layer: accept one record or a bulk array, normalize to a list, delegate
to ingest_service, return the {created, skipped, errors} summary. No business
logic here.

Why a separate router from customers.py: that file owns the READ side
(`GET /api/customers`). FastAPI dispatches GET and POST on the same path
independently, so the POST handlers below live here under the bare `/api` prefix
and coexist cleanly, keeping each file focused on one concern.
"""

from typing import Union

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.lib.db import get_session
from app.schemas import CustomerIn, IngestResult, OrderIn
from app.services import ingest_service

router = APIRouter(prefix="/api", tags=["ingest"])


@router.post("/customers", response_model=IngestResult, status_code=201)
def ingest_customers(
    body: Union[CustomerIn, list[CustomerIn]],
    session: Session = Depends(get_session),
) -> IngestResult:
    """Ingest one customer or a bulk array. New emails are created; emails that
    already exist are skipped (safe to re-run the same batch)."""
    records = body if isinstance(body, list) else [body]
    return ingest_service.ingest_customers(session, records)


@router.post("/orders", response_model=IngestResult, status_code=201)
def ingest_orders(
    body: Union[OrderIn, list[OrderIn]],
    session: Session = Depends(get_session),
) -> IngestResult:
    """Ingest one order or a bulk array. Orders must reference an existing
    customer_id; invalid records are reported in `errors` and skipped."""
    records = body if isinstance(body, list) else [body]
    return ingest_service.ingest_orders(session, records)
