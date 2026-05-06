"""Stateless plan-generation endpoints.

The frontend keeps the draft commitment in local storage. The backend is
responsible only for the LLM-powered shaping of the plan:

- POST /plan/generate     — build the initial multi-step plan.
- POST /plan/regenerate-step — rewrite a single step in place.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.plan import (
    PlanRequest,
    PlanResponse,
    RegenerateStepRequest,
    RegenerateStepResponse,
)
from app.services.llm_service import (
    LLMUnavailableError,
    generate_plan,
    regenerate_step,
)

router = APIRouter(prefix="/plan", tags=["plan"])


def _llm_error(exc: LLMUnavailableError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={"code": "llm_unavailable", "message": str(exc)},
    )


@router.post(
    "/generate",
    response_model=PlanResponse,
    response_model_by_alias=True,
)
async def generate(payload: PlanRequest) -> PlanResponse:
    try:
        return await generate_plan(payload)
    except LLMUnavailableError as exc:
        raise _llm_error(exc) from exc


@router.post(
    "/regenerate-step",
    response_model=RegenerateStepResponse,
    response_model_by_alias=True,
)
async def regenerate(payload: RegenerateStepRequest) -> RegenerateStepResponse:
    try:
        return await regenerate_step(payload)
    except LLMUnavailableError as exc:
        raise _llm_error(exc) from exc
