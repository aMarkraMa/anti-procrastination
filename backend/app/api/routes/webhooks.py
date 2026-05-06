from fastapi import APIRouter, Request

router = APIRouter(prefix="/payments/webhooks", tags=["webhooks"])


@router.post("/{provider}")
async def payment_webhook(provider: str, request: Request) -> dict:
    raise NotImplementedError
