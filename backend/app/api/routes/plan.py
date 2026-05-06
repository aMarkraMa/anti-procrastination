from fastapi import APIRouter

router = APIRouter(prefix="/tasks/{task_id}/plan", tags=["plan"])


@router.post("/generate")
async def generate_plan(task_id: str) -> dict:
    raise NotImplementedError


@router.post("/regenerate")
async def regenerate_plan(task_id: str) -> dict:
    raise NotImplementedError


@router.post("/steps/{step_id}/regenerate")
async def regenerate_step(task_id: str, step_id: str) -> dict:
    raise NotImplementedError


@router.patch("/steps/{step_id}")
async def edit_step(task_id: str, step_id: str) -> dict:
    raise NotImplementedError


@router.delete("/steps/{step_id}", status_code=204)
async def delete_step(task_id: str, step_id: str) -> None:
    raise NotImplementedError


@router.post("/reorder")
async def reorder_steps(task_id: str) -> dict:
    raise NotImplementedError


@router.post("/reset")
async def reset_plan(task_id: str) -> dict:
    raise NotImplementedError


@router.post("/confirm")
async def confirm_plan(task_id: str) -> dict:
    raise NotImplementedError
