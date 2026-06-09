"""
/api/customers — searchable customer list with derived metrics for the table UI.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.lib.db import get_session
from app.schemas import CustomerSummary
from app.services import customer_service

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerSummary])
def list_customers(
    search: str | None = None,
    session: Session = Depends(get_session),
) -> list[CustomerSummary]:
    return customer_service.list_customers(session, search=search)
