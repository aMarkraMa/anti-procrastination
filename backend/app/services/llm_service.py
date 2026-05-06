"""LLM-powered task decomposition.

Asks an OpenAI model to produce relative weights for steps, then deterministically
distributes the user's total duration and commitment amount across those steps so
the sums match exactly (largest-remainder rounding).
"""

from __future__ import annotations

import logging

from openai import APIError, AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.plan import GeneratedStep, PlanRequest, PlanResponse

logger = logging.getLogger(__name__)


class LLMUnavailableError(RuntimeError):
    """Raised when the upstream LLM cannot be reached or returns nothing usable."""


_UNIT_TO_MINUTES: dict[str, float] = {
    "seconds": 1.0 / 60.0,
    "minutes": 1.0,
    "hours": 60.0,
    "days": 24.0 * 60.0,
}


class _LLMStep(BaseModel):
    title: str = Field(description="Short imperative title for the step.")
    description: str = Field(description="One or two sentences explaining what to do.")
    expected_output: str = Field(
        description="A concrete, verifiable artefact or signal that proves the step is done.",
    )
    duration_weight: float = Field(
        ge=0.0,
        description="Relative time weight; the backend normalises so weights sum to total duration.",
    )
    credit_weight: float = Field(
        ge=0.0,
        description="Relative credit weight; the backend normalises so weights sum to commitment.",
    )


class _LLMPlan(BaseModel):
    steps: list[_LLMStep]


_SYSTEM_PROMPT = """You are a coach helping a user beat procrastination by signing a commitment contract.
The user gives you a concrete task plus constraints. You break it into 3-8 small, sequential, *verifiable*
steps with realistic time and effort weights.

Hard rules:
- Every step must be concrete enough that a third party can tell when it is done.
- No vague verbs like "research", "think about", "improve". Prefer "draft", "write", "send", "build", "test".
- Steps must be executable in order; later steps depend on earlier ones.
- Use the user's language for `title`, `description`, and `expected_output`.
- Keep `expected_output` to one short clause - what tangible artefact proves it.
- `duration_weight` and `credit_weight` are relative numbers (weights), not percentages or absolute values.
  Heavier / more uncertain steps should get larger weights. The backend normalises them.

You receive a `work_style` and `difficulty_level` hint:
- Fast: shorter steps, fewer checks.
- Steady: balanced.
- HighQuality: include a verification or review step.
- Easy/Medium/Hard adjusts how aggressive the time weighting is.
"""


def _to_minutes(value: int, unit: str) -> int:
    minutes = round(value * _UNIT_TO_MINUTES[unit])
    return max(minutes, 1)


def _largest_remainder(total: int, weights: list[float]) -> list[int]:
    """Distribute `total` across slots proportional to `weights`, exact integer sum."""
    n = len(weights)
    if n == 0:
        return []
    s = sum(weights)
    if s <= 0:
        base, rem = divmod(total, n)
        return [base + (1 if i < rem else 0) for i in range(n)]
    raw = [total * w / s for w in weights]
    floors = [int(r) for r in raw]
    deficit = total - sum(floors)
    remainders = sorted(
        ((raw[i] - floors[i], i) for i in range(n)),
        key=lambda x: (-x[0], x[1]),
    )
    out = floors[:]
    for k in range(deficit):
        out[remainders[k][1]] += 1
    return out


def _ensure_min_one(values: list[int], total: int) -> list[int]:
    """Make sure every slot is at least 1 while preserving the total sum."""
    if not values or total < len(values):
        return values
    out = values[:]
    while min(out) < 1:
        i_min = out.index(min(out))
        i_max = out.index(max(out))
        if out[i_max] <= 1:
            break
        out[i_max] -= 1
        out[i_min] += 1
    return out


def _build_user_prompt(req: PlanRequest, total_minutes: int) -> str:
    return (
        f"Task title: {req.title}\n"
        f"Task description: {req.description}\n"
        f"Total duration available: {total_minutes} minutes "
        f"(user entered {req.duration_value} {req.duration_unit}).\n"
        f"Total commitment amount: {req.commitment_amount} EUR.\n"
        f"Preferred step count: {req.preferred_step_count} (must be between 3 and 8).\n"
        f"Difficulty level: {req.difficulty_level}.\n"
        f"Work style: {req.work_style}.\n\n"
        "Generate the plan now."
    )


async def generate_plan(req: PlanRequest) -> PlanResponse:
    settings = get_settings()
    if not settings.openai_api_key:
        raise LLMUnavailableError(
            "OPENAI_API_KEY is not configured. Add it to backend/.env.local.",
        )

    total_minutes = _to_minutes(req.duration_value, req.duration_unit)
    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.llm_request_timeout_seconds,
    )

    try:
        completion = await client.chat.completions.parse(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(req, total_minutes)},
            ],
            response_format=_LLMPlan,
        )
    except (APIError, OpenAIError) as exc:
        logger.exception("OpenAI call failed")
        raise LLMUnavailableError(str(exc)) from exc

    parsed = completion.choices[0].message.parsed
    if parsed is None or not parsed.steps:
        raise LLMUnavailableError("Model returned no steps.")

    raw_steps = parsed.steps[: settings.llm_max_steps]
    duration_weights = [s.duration_weight for s in raw_steps]
    credit_weights = [s.credit_weight for s in raw_steps]

    minutes_per_step = _ensure_min_one(
        _largest_remainder(total_minutes, duration_weights),
        total_minutes,
    )
    credit_per_step = _largest_remainder(req.commitment_amount, credit_weights)

    steps: list[GeneratedStep] = []
    for index, step in enumerate(raw_steps):
        steps.append(
            GeneratedStep(
                order=index + 1,
                title=step.title,
                description=step.description,
                expected_output=step.expected_output,
                time_limit_minutes=minutes_per_step[index],
                assigned_credit=credit_per_step[index],
            ),
        )

    return PlanResponse(
        steps=steps,
        total_duration_minutes=sum(minutes_per_step),
        total_credit=sum(credit_per_step),
        model=settings.llm_model,
    )
