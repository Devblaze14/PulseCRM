"""
/api/receipts — the callback sink the channel posts lifecycle events to.

Kept deliberately thin and FAST: authenticate, delegate to receipt_service,
return 2xx. Returning quickly matters because a slow/erroring response makes the
channel retry (wasted work). Auth failures are the one case we reject (401).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.lib.db import get_session
from app.schemas import ReceiptIn, ReceiptResult
from app.services.receipt_service import ReceiptAuthError, process_receipt

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


@router.post("", response_model=ReceiptResult)
def receive(
    receipt: ReceiptIn,
    session: Session = Depends(get_session),
) -> ReceiptResult:
    try:
        return process_receipt(session, receipt)
    except ReceiptAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
