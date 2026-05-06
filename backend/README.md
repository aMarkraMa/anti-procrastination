# Anti-Procrastination · Backend

FastAPI service that powers the "commitment contract" anti-procrastination flow.

---

## 1. Tech Stack

| Concern              | Choice                                                |
|----------------------|-------------------------------------------------------|
| Runtime              | Python 3.11+                                          |
| Web framework        | FastAPI (async)                                       |
| Validation           | Pydantic v2 / `pydantic-settings`                     |
| ORM                  | SQLAlchemy 2.0 (async) + Alembic                      |
| DB (dev)             | SQLite via `aiosqlite`                                |
| DB (prod)            | PostgreSQL via `asyncpg`                              |
| Auth                 | JWT (access + refresh) via `python-jose` + `passlib`  |
| LLM                  | OpenAI-compatible (configurable provider)             |
| Payments             | Stripe-style provider abstraction (mock in dev)       |
| Background scheduler | `asyncio` deadline-checker task in app lifespan       |
| HTTP client          | `httpx`                                               |

---

## 2. Folder Structure

```text
backend/
├── app/
│   ├── main.py                # FastAPI app + lifespan
│   ├── config.py              # Settings (env-driven)
│   ├── database.py            # Async engine + session
│   ├── deps.py                # DI: db, current_user
│   ├── core/
│   │   ├── security.py        # JWT, password hashing
│   │   ├── exceptions.py      # Domain errors
│   │   └── enums.py           # Status enums
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py
│   │   ├── task.py
│   │   ├── step.py
│   │   ├── extension.py
│   │   ├── payment.py
│   │   └── transaction.py
│   ├── schemas/               # Pydantic request/response DTOs
│   │   ├── auth.py
│   │   ├── task.py
│   │   ├── step.py
│   │   ├── plan.py
│   │   └── payment.py
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py
│   │       ├── tasks.py
│   │       ├── plan.py
│   │       ├── steps.py
│   │       ├── payment.py
│   │       └── webhooks.py
│   └── services/              # Business logic
│       ├── auth_service.py
│       ├── task_service.py
│       ├── plan_service.py
│       ├── step_service.py
│       ├── payment_service.py
│       ├── llm_service.py     # Plan generation
│       ├── settlement.py      # Reward / forfeit math
│       └── scheduler.py       # Deadline watchdog
├── alembic/                   # Migrations
├── tests/
├── requirements.txt
├── env.example
└── README.md
```

---

## 3. Domain Model

All money is stored as integer **cents** (`amount_cents`) to avoid float issues.

### 3.1 Entities

**User**
- `id`, `email` (unique), `name`, `password_hash`, `created_at`

**Task** (the commitment contract)
- `id`, `user_id`, `title`, `description`
- `total_reward_cents` — what the user pledged
- `status` — see state machine below
- `created_at`, `started_at`, `completed_at`, `failed_at`
- relations: `steps[]`, `payment`, `transactions[]`

**Step**
- `id`, `task_id`, `order_index`
- `title`, `description`
- `reward_cents` — share of total reward
- `original_duration_seconds` — base time limit
- `extensions_used` (0..3)
- `current_deadline` (UTC datetime, nullable until step becomes ACTIVE)
- `status` — see state machine
- `started_at`, `completed_at`, `failed_at`

**Extension** (audit log)
- `id`, `step_id`, `extension_number` (1..3)
- `added_seconds`, `created_at`

**Payment**
- `id`, `task_id`, `user_id`, `amount_cents`
- `provider`, `provider_intent_id`, `client_secret`
- `status` — `pending | succeeded | failed | refunded | partially_refunded`
- `created_at`, `completed_at`

**Transaction** (settlement ledger)
- `id`, `task_id`, `step_id` (nullable)
- `type` — `payout | forfeit | refund`
- `amount_cents`, `created_at`

### 3.2 Reward Distribution

When the LLM generates a plan, it returns each step's `reward_share` (a percentage that sums to 100). The backend converts shares to cents using **largest-remainder** rounding so the per-step amounts sum exactly to `total_reward_cents`.

If the user manually edits step rewards, the backend validates `sum(reward_cents) == total_reward_cents`. Otherwise it rejects with `422`.

---

## 4. State Machines

### 4.1 Task

```
            ┌──────────────► CANCELLED
            │
DRAFT ──► PLANNING ──► AWAITING_PAYMENT ──► ACTIVE ──► COMPLETED
                                                  │
                                                  └──► FAILED
```

| From               | Event                          | To                |
|--------------------|--------------------------------|-------------------|
| (none)             | `POST /tasks`                  | `DRAFT`           |
| `DRAFT`            | first plan generated           | `PLANNING`        |
| `PLANNING`         | user confirms plan             | `AWAITING_PAYMENT`|
| `AWAITING_PAYMENT` | payment webhook success        | `ACTIVE`          |
| `ACTIVE`           | last step completed            | `COMPLETED`       |
| `ACTIVE`           | any step expired/failed        | `FAILED`          |
| `DRAFT/PLANNING`   | user cancels                   | `CANCELLED`       |

### 4.2 Step

```
PENDING ──► ACTIVE ──► COMPLETED
                  │
                  └──► FAILED ──► (subsequent steps become FORFEITED)
```

Only **one** step is `ACTIVE` per task at a time. Activating step _N_ sets `current_deadline = now + original_duration_seconds`.

---

## 5. API Surface

All authenticated endpoints require `Authorization: Bearer <jwt>`.
Responses are JSON; errors follow `{ "detail": "...", "code": "..." }`.

### 5.1 Auth — `/api/v1/auth`

| Method | Path        | Body                              | Returns                           |
|--------|-------------|-----------------------------------|-----------------------------------|
| POST   | `/register` | `{email, password, name}`         | `{user, access_token, refresh}`   |
| POST   | `/login`    | `{email, password}`               | `{user, access_token, refresh}`   |
| POST   | `/refresh`  | `{refresh_token}`                 | `{access_token, refresh}`         |
| GET    | `/me`       | —                                 | `User`                            |

### 5.2 Tasks — `/api/v1/tasks`

| Method | Path          | Body / Notes                                              | Returns        |
|--------|---------------|-----------------------------------------------------------|----------------|
| POST   | `/`           | `{title, description, total_reward_cents}`                | `Task` (DRAFT) |
| GET    | `/`           | optional `?status=`                                       | `Task[]`       |
| GET    | `/{id}`       | full task w/ steps, current step, remaining time          | `TaskDetail`   |
| PATCH  | `/{id}`       | edit `title/description/total_reward_cents` (DRAFT only)  | `Task`         |
| DELETE | `/{id}`       | only DRAFT or PLANNING → CANCELLED                        | `204`          |

### 5.3 Plan generation — `/api/v1/tasks/{id}/plan`

These are only allowed when task is `DRAFT` or `PLANNING`.

| Method | Path                          | Body                                         | Effect                                          |
|--------|-------------------------------|----------------------------------------------|-------------------------------------------------|
| POST   | `/generate`                   | `{}` (uses task fields)                      | LLM creates initial plan; task → PLANNING       |
| POST   | `/regenerate`                 | `{feedback?: string}`                        | Replaces all steps with a new LLM plan          |
| POST   | `/steps/{step_id}/regenerate` | `{feedback?: string}`                        | Replaces just one step (keeps others)           |
| PATCH  | `/steps/{step_id}`            | `{title?, description?, reward_cents?, original_duration_seconds?}` | Manual edit (one step) |
| POST   | `/reorder`                    | `{step_ids: [uuid, …]}`                      | Reorder steps                                   |
| DELETE | `/steps/{step_id}`            | —                                            | Remove a step (rebalances rewards if requested) |
| POST   | `/reset`                      | —                                            | "Go back": clears plan, task → DRAFT            |
| POST   | `/confirm`                    | —                                            | Locks plan, creates payment intent              |

`POST /confirm` response:
```json
{
  "task": { ... "status": "AWAITING_PAYMENT" },
  "payment": {
    "id": "pay_...",
    "amount_cents": 50000,
    "client_secret": "pi_...",
    "provider": "stripe"
  }
}
```

### 5.4 Payment — `/api/v1/payments`

| Method | Path                        | Body                                        | Notes                                            |
|--------|-----------------------------|---------------------------------------------|--------------------------------------------------|
| POST   | `/{payment_id}/confirm`     | `{provider_payload}`                        | Manual confirmation path (dev/mock)              |
| POST   | `/webhooks/{provider}`      | provider payload                            | Provider webhook → triggers task ACTIVE          |
| GET    | `/tasks/{task_id}/payment`  | —                                           | Current payment record                           |

On `payment.succeeded`:
1. `Payment.status = succeeded`
2. `Task.status = ACTIVE`, `started_at = now`
3. First step → `ACTIVE`, sets `current_deadline`

### 5.5 Execution — `/api/v1/tasks/{id}/steps`

| Method | Path                  | Body         | Effect                                            |
|--------|-----------------------|--------------|---------------------------------------------------|
| GET    | `/{step_id}`          | —            | Step status incl. `remaining_seconds`             |
| POST   | `/{step_id}/complete` | `{note?}`    | Marks complete; activates next step or finishes   |
| POST   | `/{step_id}/extend`   | —            | Adds 30% of `original_duration_seconds` to deadline (max 3 times) |

`POST /extend` errors:
- `409 already_expired` — deadline already passed
- `409 max_extensions_reached` — already used 3
- `409 not_active` — step not currently active

### 5.6 Settlement / History — `/api/v1/tasks/{id}`

| Method | Path             | Returns                              |
|--------|------------------|--------------------------------------|
| GET    | `/transactions`  | ledger of payouts / forfeits         |
| GET    | `/timeline`      | combined event feed (audit / UI)     |

---

## 6. Key Business Rules

### 6.1 Extension math
```
added_seconds = round(step.original_duration_seconds * 0.30)
new_deadline   = step.current_deadline + added_seconds
extensions_used += 1   # max 3
```
Extensions are only allowed while `now < current_deadline` and `step.status == ACTIVE`.

### 6.2 Failure cascade
When a step expires (deadline passes with no completion and `extensions_used == 3`, or user simply runs out of time):
1. That step → `FAILED`.
2. All subsequent `PENDING` steps → `FORFEITED`.
3. `Task.status = FAILED`.
4. `Settlement` runs:
   - `payout_cents = sum(reward_cents of COMPLETED steps)`
   - `forfeit_cents = total_reward_cents - payout_cents`
   - Issue partial refund + record `transaction` rows.

### 6.3 Success
When the last step is completed:
1. `Task.status = COMPLETED`.
2. Full deposit refunded; one `payout` transaction equal to `total_reward_cents`.

### 6.4 Forfeit destination
`SETTINGS.forfeit_destination` controls where forfeited money goes:
- `platform` — kept by service
- `charity` — forwarded to a configured payee
- `burn` — held in escrow indefinitely (dev default)

### 6.5 Authorisation
Every task-scoped endpoint checks `task.user_id == current_user.id`; otherwise `404` (don't leak existence).

---

## 7. Background Scheduler

A single async task is started in FastAPI's `lifespan`. Every `SCHEDULER_TICK_SECONDS` (default `10`) it:

1. Selects all `Step` rows where `status = ACTIVE` and `current_deadline <= now()`.
2. For each, runs the failure cascade in a transaction.
3. Emits a structured log line per failed task.

This keeps the design simple (no Celery/Redis) and good enough for the hackathon. A production version would schedule per-deadline jobs via APScheduler with a DB jobstore or use Cloud Tasks.

---

## 8. LLM Integration (`services/llm_service.py`)

Single function:

```python
async def generate_plan(
    title: str,
    description: str,
    total_reward_cents: int,
    feedback: str | None = None,
    previous_plan: list[StepDraft] | None = None,
) -> list[StepDraft]: ...
```

Returns a list of `StepDraft(title, description, reward_share, suggested_duration_minutes)`.

Prompting principles:
- Force concrete, **verifiable** sub-tasks (no vague "research").
- Time estimates are realistic for a focused human, not a machine.
- Reward shares sum to 100, weighted by effort.
- Hard cap on number of steps (`MAX_STEPS = 8`) to keep UX reasonable.
- Output is a strict JSON schema; we validate with Pydantic before persisting.

Single-step regeneration uses a similar prompt but pinned to the step's slot.

---

## 9. Payments

`services/payment_service.py` exposes a provider-agnostic interface:

```python
class PaymentProvider(Protocol):
    async def create_intent(self, amount_cents: int, metadata: dict) -> Intent: ...
    async def refund(self, intent_id: str, amount_cents: int) -> Refund: ...
    def verify_webhook(self, payload: bytes, signature: str) -> Event: ...
```

Implementations:
- `StripeProvider` (real)
- `MockProvider` (dev) — auto-confirms after a 2s sleep so the front-end flow can be exercised without a real bank link.

Webhooks are signed; the route lives at `POST /api/v1/payments/webhooks/{provider}`.

---

## 10. Error Codes (excerpt)

| Code                       | HTTP | Meaning                                    |
|----------------------------|------|--------------------------------------------|
| `task_not_found`           | 404  | task missing or not owned by user          |
| `invalid_state_transition` | 409  | action illegal for current task/step state |
| `reward_sum_mismatch`      | 422  | edited steps don't sum to total            |
| `max_extensions_reached`   | 409  | already used 3 extensions                  |
| `step_already_expired`     | 409  | deadline passed                            |
| `payment_required`         | 402  | trying to start ACTIVE without payment     |
| `llm_unavailable`          | 503  | upstream LLM error                         |

---

## 11. Setup

```bash
cd backend
uv sync
source .venv/bin/activate
cp env.example .env
echo 'OPENAI_API_KEY=sk-...' > .env.local   # secrets only, git-ignored
alembic upgrade head
uv run uvicorn app.main:app --reload
```

`.env.local` is loaded **after** `.env` and overrides it. Put your API keys
there so they never end up committed.

OpenAPI is auto-generated at `http://localhost:8000/docs`.

---

## 12. Implemented endpoints

### `POST /api/v1/plan/generate` — task decomposition (stateless)

Mirrors the frontend `CommitmentTaskInput` shape; returns steps that match
`CommitmentStep` so the Angular Review page can render them directly.

Request:
```json
{
  "title": "完成 React 项目首页",
  "description": "...",
  "durationValue": 90,
  "durationUnit": "minutes",
  "commitmentAmount": 30,
  "difficultyLevel": "Medium",
  "preferredStepCount": 4,
  "workStyle": "Steady"
}
```

Response (sums are guaranteed exact):
```json
{
  "steps": [
    {
      "order": 1,
      "title": "...",
      "description": "...",
      "expectedOutput": "...",
      "timeLimitMinutes": 20,
      "assignedCredit": 6
    }
  ],
  "totalDurationMinutes": 90,
  "totalCredit": 30,
  "model": "gpt-4o-mini"
}
```

Errors: `503 llm_unavailable` if `OPENAI_API_KEY` is missing or the upstream
call fails.
