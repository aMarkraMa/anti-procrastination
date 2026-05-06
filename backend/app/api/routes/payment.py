"""Mock bank charge endpoint.

This is intentionally trivial for the demo: there is no real payment
processor, no auth, and no persistence. The frontend POSTs the amount and
gets back a fake charge id after a short artificial delay so the UI can show
a realistic "charging the bank account" state.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

router = APIRouter(prefix="/payments", tags=["payments"])


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ChargeRequest(_CamelModel):
    amount: float = Field(ge=0, le=10_000)
    card_holder: str = Field(min_length=2, max_length=80)
    card_number_last4: str = Field(min_length=4, max_length=4)
    discount_code: str | None = Field(default=None, max_length=32)


class ChargeResponse(_CamelModel):
    charge_id: str
    amount: float
    status: str
    charged_at: str
    discount_code: str | None = None


@router.post(
    "/charge",
    response_model=ChargeResponse,
    response_model_by_alias=True,
)
async def charge(payload: ChargeRequest) -> ChargeResponse:
    if not payload.card_number_last4.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_card", "message": "Last 4 digits must be numeric."},
        )

    await asyncio.sleep(0.6)

    return ChargeResponse(
        charge_id=f"ch_{uuid.uuid4().hex[:16]}",
        amount=round(payload.amount, 2),
        status="succeeded",
        charged_at=datetime.now(tz=timezone.utc).isoformat(),
        discount_code=payload.discount_code,
    )
