from fastapi import APIRouter

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{payment_id}/confirm")
async def confirm_payment(payment_id: str) -> dict:
    raise NotImplementedError


@router.get("/tasks/{task_id}/payment")
async def get_task_payment(task_id: str) -> dict:
    raise NotImplementedError
