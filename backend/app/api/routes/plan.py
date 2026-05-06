"""Stateless plan-generation endpoint.

The frontend currently keeps the draft task in local storage and just needs the
LLM to break it into verifiable steps. We expose a single POST that takes the
same shape the frontend already builds and returns the generated steps.
"""

from fastapi import APIRouter, HTTPException, status

from app.schemas.plan import PlanRequest, PlanResponse
from app.services.llm_service import LLMUnavailableError, generate_plan

router = APIRouter(prefix="/plan", tags=["plan"])


@router.post(
    "/generate",
    response_model=PlanResponse,
    response_model_by_alias=True,
)
async def generate(payload: PlanRequest) -> PlanResponse:
    try:
        return await generate_plan(payload)
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "llm_unavailable", "message": str(exc)},
        ) from exc
