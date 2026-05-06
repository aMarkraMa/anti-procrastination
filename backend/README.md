# Anti-Procrastination · Backend

Minimal FastAPI service for the demo. The frontend keeps task state in
local storage; the backend only does two things:

1. Call OpenAI to generate / regenerate plan steps.
2. Pretend to charge a bank account.

## Setup

```bash
cd backend
uv sync
cp .env.example .env.local  # then add OPENAI_API_KEY=...
uv run uvicorn app.main:app --reload
```

The server listens on `http://localhost:8000`.

## Endpoints

- `POST /api/v1/plan/generate` — generate the initial multi-step plan.
- `POST /api/v1/plan/regenerate-step` — rewrite a single step in place.
- `POST /api/v1/payments/charge` — mock bank charge (always succeeds).
- `GET  /health` — liveness probe.
