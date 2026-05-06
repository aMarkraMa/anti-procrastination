from fastapi import APIRouter

router = APIRouter(prefix="/tasks/{task_id}/steps", tags=["steps"])


@router.get("/{step_id}")
async def get_step(task_id: str, step_id: str) -> dict:
    raise NotImplementedError


@router.post("/{step_id}/complete")
async def complete_step(task_id: str, step_id: str) -> dict:
    raise NotImplementedError


@router.post("/{step_id}/extend")
async def extend_step(task_id: str, step_id: str) -> dict:
    raise NotImplementedError
