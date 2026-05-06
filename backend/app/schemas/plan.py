"""Pydantic schemas for plan generation and step regeneration.

Field names mirror the frontend `CommitmentTaskInput` / `CommitmentStep`
shapes (camelCase over the wire) while staying snake_case in Python via
Pydantic alias generation.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

DurationUnit = Literal["seconds", "minutes", "hours", "days"]
DifficultyLevel = Literal["Easy", "Medium", "Hard"]
WorkStyle = Literal["Fast", "Steady", "HighQuality"]


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class PlanRequest(_CamelModel):
    """Mirrors `CommitmentTaskInput` from the frontend."""

    title: str = Field(min_length=4, max_length=80)
    description: str = Field(min_length=20, max_length=800)
    duration_value: int = Field(ge=1)
    duration_unit: DurationUnit
    commitment_amount: float = Field(gt=0, le=10_000)
    difficulty_level: DifficultyLevel = "Medium"
    preferred_step_count: int = Field(ge=3, le=8, default=4)
    work_style: WorkStyle = "Steady"


class GeneratedStep(_CamelModel):
    """Matches `CommitmentStep` fields the frontend renders today.

    `assigned_credit` is a positive euro amount in 2-decimal precision; every
    step is guaranteed by the backend distribution to be > 0.
    """

    order: int = Field(ge=1)
    title: str
    description: str
    expected_output: str
    time_limit_minutes: int = Field(ge=1)
    assigned_credit: float = Field(gt=0)


class PlanResponse(_CamelModel):
    steps: list[GeneratedStep]
    total_duration_minutes: int
    total_credit: float
    model: str


class StepBrief(_CamelModel):
    """Minimal step info used as context when regenerating one step."""

    order: int
    title: str
    description: str
    expected_output: str


class RegenerateStepRequest(_CamelModel):
    """Ask the LLM to rewrite a single step keeping the rest of the plan as context."""

    title: str
    description: str
    difficulty_level: DifficultyLevel = "Medium"
    work_style: WorkStyle = "Steady"
    target_order: int = Field(ge=1)
    time_limit_minutes: int = Field(ge=1)
    assigned_credit: float = Field(gt=0)
    other_steps: list[StepBrief] = []
    user_hint: str | None = Field(default=None, max_length=400)


class RegenerateStepResponse(_CamelModel):
    step: GeneratedStep
    model: str
