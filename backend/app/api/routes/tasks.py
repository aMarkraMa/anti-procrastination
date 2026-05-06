from fastapi import APIRouter

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/")
async def create_task() -> dict:
    raise NotImplementedError


@router.get("/")
async def list_tasks() -> list:
    raise NotImplementedError


@router.get("/{task_id}")
async def get_task(task_id: str) -> dict:
    raise NotImplementedError


@router.patch("/{task_id}")
async def update_task(task_id: str) -> dict:
    raise NotImplementedError


@router.delete("/{task_id}", status_code=204)
async def cancel_task(task_id: str) -> None:
    raise NotImplementedError


@router.get("/{task_id}/transactions")
async def list_transactions(task_id: str) -> list:
    raise NotImplementedError


@router.get("/{task_id}/timeline")
async def task_timeline(task_id: str) -> list:
    raise NotImplementedError
