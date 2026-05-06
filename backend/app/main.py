from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, payment, plan, steps, tasks, webhooks
from app.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    # TODO: start deadline-checker background task here.
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api_prefix = "/api/v1"
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(tasks.router, prefix=api_prefix)
    app.include_router(plan.router, prefix=api_prefix)
    app.include_router(steps.router, prefix=api_prefix)
    app.include_router(payment.router, prefix=api_prefix)
    app.include_router(webhooks.router, prefix=api_prefix)

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok", "env": settings.app_env}

    return app


app = create_app()
