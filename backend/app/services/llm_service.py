"""LLM-powered task decomposition with provider fallback.

Two operations are exposed to the API layer:

- `generate_plan` asks the model for a list of weighted sub-steps, then
  deterministically distributes the user's total duration and commitment
  amount across those steps (largest-remainder rounding).
- `regenerate_step` rewrites a single step in an existing plan while keeping
  its time and credit allocation untouched.

Each LLM call is tried against a configurable provider chain (default:
`openai,gemini`). If the first provider raises, the next one is tried, and
only when all configured providers fail do we surface `LLMUnavailableError`.
"""

from __future__ import annotations

import logging
from typing import TypeVar

from openai import APIError, AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schemas.plan import (
    GeneratedStep,
    PlanRequest,
    PlanResponse,
    RegenerateStepRequest,
    RegenerateStepResponse,
)

try:
    from google import genai as google_genai
    from google.genai import types as google_genai_types

    _GENAI_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    google_genai = None  # type: ignore[assignment]
    google_genai_types = None  # type: ignore[assignment]
    _GENAI_AVAILABLE = False

logger = logging.getLogger(__name__)


class LLMUnavailableError(RuntimeError):
    """Raised when every configured LLM provider failed."""


_UNIT_TO_MINUTES: dict[str, float] = {
    "seconds": 1.0 / 60.0,
    "minutes": 1.0,
    "hours": 60.0,
    "days": 24.0 * 60.0,
}

# Smallest currency unit we round to (1 cent) and minimum credit per step.
_CENTS_PER_EURO = 100
_MIN_CENTS_PER_STEP = 1


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


class _LLMSingleStep(BaseModel):
    title: str
    description: str
    expected_output: str


_SYSTEM_PROMPT = """You are a coach helping a user beat procrastination by signing a commitment contract.
The user gives you a concrete task plus constraints. You break it into 3-8 small, sequential, *verifiable*
steps with realistic time and effort weights.

Hard rules:
- Every step must be concrete enough that a third party can tell when it is done.
- No vague verbs like "research", "think about", "improve". Prefer "draft", "write", "send", "build", "test".
- Steps must be executable in order; later steps depend on earlier ones.
- Use the user's language for `title`, `description`, and `expected_output`.
- Keep `expected_output` to one short clause - what tangible artefact proves it.
- Every step must have a non-zero `credit_weight` and `duration_weight` (no skipped or "free" steps).
- `duration_weight` and `credit_weight` are relative numbers (weights), not percentages or absolute values.
  Heavier / more uncertain steps should get larger weights. The backend normalises them.

You receive a `work_style` and `difficulty_level` hint:
- Fast: shorter steps, fewer checks.
- Steady: balanced.
- HighQuality: include a verification or review step.
- Easy/Medium/Hard adjusts how aggressive the time weighting is.
"""


_REGENERATE_SYSTEM_PROMPT = """You are a coach helping a user fix one step of a commitment contract.
The user has a multi-step plan but is unhappy with a specific step. Rewrite ONLY that step.

Hard rules:
- Keep the step focused and verifiable; prefer concrete verbs (draft, write, send, build, test).
- Stay aligned with the user's overall task and the surrounding steps' direction.
- Use the user's language for title, description, and expected_output.
- Do NOT change the step's order or timing - only its content.
- expected_output must be one short clause naming a tangible artefact / signal.
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


def _ensure_min(values: list[int], floor: int) -> list[int]:
    """Make sure every slot is at least `floor` while preserving the total sum."""
    if not values:
        return values
    total = sum(values)
    if total < floor * len(values):
        # Caller should guarantee this; bail out to even distribution.
        base, rem = divmod(total, len(values))
        return [base + (1 if i < rem else 0) for i in range(len(values))]
    out = values[:]
    while min(out) < floor:
        i_min = out.index(min(out))
        i_max = out.index(max(out))
        if out[i_max] <= floor:
            break
        out[i_max] -= 1
        out[i_min] += 1
    return out


def _distribute_currency(total: float, weights: list[float]) -> list[float]:
    """Distribute a euro amount across slots in 2-decimal precision.

    Every slot is guaranteed to receive at least 0.01 €, provided the total
    in cents is >= number of slots (which is enforced upstream by the
    schema's minimum commitment amount).
    """
    n = len(weights)
    if n == 0:
        return []
    cents_total = round(total * _CENTS_PER_EURO)
    safe_weights = [max(w, 0.0) for w in weights]
    if sum(safe_weights) <= 0:
        safe_weights = [1.0] * n

    cents = _ensure_min(
        _largest_remainder(cents_total, safe_weights),
        _MIN_CENTS_PER_STEP,
    )
    # Re-balance any floor adjustments back to the original total.
    drift = cents_total - sum(cents)
    if drift != 0:
        order = sorted(range(n), key=lambda i: -cents[i])
        i = 0
        while drift > 0 and i < n:
            cents[order[i]] += 1
            drift -= 1
            i += 1
        i = 0
        while drift < 0 and i < n:
            if cents[order[-(i + 1)]] > _MIN_CENTS_PER_STEP:
                cents[order[-(i + 1)]] -= 1
                drift += 1
            i += 1
    return [round(c / _CENTS_PER_EURO, 2) for c in cents]


def _build_user_prompt(req: PlanRequest, total_minutes: int) -> str:
    return (
        f"Task title: {req.title}\n"
        f"Task description: {req.description}\n"
        f"Total duration available: {total_minutes} minutes "
        f"(user entered {req.duration_value} {req.duration_unit}).\n"
        f"Total commitment amount: {req.commitment_amount:.2f} EUR.\n"
        f"Preferred step count: {req.preferred_step_count} (must be between 3 and 8).\n"
        f"Difficulty level: {req.difficulty_level}.\n"
        f"Work style: {req.work_style}.\n\n"
        "Generate the plan now. Every step must have a non-zero credit_weight."
    )


def _build_regenerate_prompt(req: RegenerateStepRequest) -> str:
    other = "\n".join(
        f"- Step {s.order}: {s.title} | {s.description} | output: {s.expected_output}"
        for s in req.other_steps
    ) or "(none provided)"
    hint = req.user_hint.strip() if req.user_hint else ""
    hint_block = f"\nUser hint for the rewrite: {hint}\n" if hint else ""
    return (
        f"Task title: {req.title}\n"
        f"Task description: {req.description}\n"
        f"Difficulty level: {req.difficulty_level}.\n"
        f"Work style: {req.work_style}.\n\n"
        f"Existing plan (do not change these, just keep them in mind):\n{other}\n\n"
        f"You must rewrite ONLY step {req.target_order}. "
        f"It currently has a time budget of {req.time_limit_minutes} minutes and "
        f"{req.assigned_credit:.2f} EUR of credit. Keep it consistent with the surrounding steps."
        f"{hint_block}"
    )


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

T = TypeVar("T", bound=BaseModel)


async def _call_openai(
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    *,
    extra_temperature: float = 0.0,
) -> tuple[T, str]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise LLMUnavailableError("OPENAI_API_KEY is not configured.")
    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.llm_request_timeout_seconds,
    )
    completion = await client.chat.completions.parse(
        model=settings.llm_model,
        temperature=min(settings.llm_temperature + extra_temperature, 1.0),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=schema,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise LLMUnavailableError("OpenAI returned no parsed result.")
    return parsed, settings.llm_model


async def _call_gemini(
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    *,
    extra_temperature: float = 0.0,
) -> tuple[T, str]:
    settings = get_settings()
    if not _GENAI_AVAILABLE:
        raise LLMUnavailableError("google-genai is not installed.")
    if not settings.gemini_api_key:
        raise LLMUnavailableError("GEMINI_API_KEY is not configured.")
    client = google_genai.Client(api_key=settings.gemini_api_key)
    config = google_genai_types.GenerateContentConfig(
        system_instruction=system_prompt,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=min(settings.llm_temperature + extra_temperature, 1.0),
    )
    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=user_prompt,
        config=config,
    )
    parsed = response.parsed
    if parsed is None:
        # Fallback: parse JSON text manually.
        text = (response.text or "").strip()
        if not text:
            raise LLMUnavailableError("Gemini returned no text.")
        try:
            parsed = schema.model_validate_json(text)
        except Exception as exc:
            raise LLMUnavailableError(f"Gemini returned invalid JSON: {exc}") from exc
    return parsed, settings.gemini_model


_PROVIDERS = {
    "openai": _call_openai,
    "gemini": _call_gemini,
}


async def _call_with_fallback(
    system_prompt: str,
    user_prompt: str,
    schema: type[T],
    *,
    extra_temperature: float = 0.0,
) -> tuple[T, str]:
    settings = get_settings()
    chain = settings.provider_chain or ["openai", "gemini"]

    errors: list[str] = []
    tried: list[str] = []

    for provider in chain:
        fn = _PROVIDERS.get(provider)
        if fn is None:
            continue
        # Skip providers without their key configured.
        if provider == "openai" and not settings.openai_api_key:
            continue
        if provider == "gemini" and not settings.gemini_api_key:
            continue

        tried.append(provider)
        try:
            return await fn(
                system_prompt,
                user_prompt,
                schema,
                extra_temperature=extra_temperature,
            )
        except (APIError, OpenAIError) as exc:
            logger.warning("Provider %s failed: %s", provider, exc)
            errors.append(f"{provider}: {exc}")
        except LLMUnavailableError as exc:
            logger.warning("Provider %s unavailable: %s", provider, exc)
            errors.append(f"{provider}: {exc}")
        except Exception as exc:  # noqa: BLE001 - any provider error should fall through
            logger.warning("Provider %s raised %s: %s", provider, type(exc).__name__, exc)
            errors.append(f"{provider}: {exc}")

    if not tried:
        raise LLMUnavailableError(
            "No LLM provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in backend/.env.local.",
        )
    raise LLMUnavailableError(
        f"All LLM providers failed. Tried {tried}. Errors: {' | '.join(errors)}",
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def generate_plan(req: PlanRequest) -> PlanResponse:
    settings = get_settings()
    total_minutes = _to_minutes(req.duration_value, req.duration_unit)

    parsed, model_used = await _call_with_fallback(
        _SYSTEM_PROMPT,
        _build_user_prompt(req, total_minutes),
        _LLMPlan,
    )
    if not parsed.steps:
        raise LLMUnavailableError("Model returned no steps.")

    raw_steps = parsed.steps[: settings.llm_max_steps]
    duration_weights = [s.duration_weight for s in raw_steps]
    credit_weights = [s.credit_weight for s in raw_steps]

    minutes_per_step = _ensure_min(
        _largest_remainder(total_minutes, duration_weights),
        floor=1,
    )
    credit_per_step = _distribute_currency(req.commitment_amount, credit_weights)

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
        total_credit=round(sum(credit_per_step), 2),
        model=model_used,
    )


async def regenerate_step(req: RegenerateStepRequest) -> RegenerateStepResponse:
    parsed, model_used = await _call_with_fallback(
        _REGENERATE_SYSTEM_PROMPT,
        _build_regenerate_prompt(req),
        _LLMSingleStep,
        extra_temperature=0.2,
    )

    new_step = GeneratedStep(
        order=req.target_order,
        title=parsed.title,
        description=parsed.description,
        expected_output=parsed.expected_output,
        time_limit_minutes=req.time_limit_minutes,
        assigned_credit=req.assigned_credit,
    )
    return RegenerateStepResponse(step=new_step, model=model_used)
