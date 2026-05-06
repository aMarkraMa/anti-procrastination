from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "anti-procrastination"
    app_env: str = "development"
    app_port: int = 8000
    app_cors_origins: str = "http://localhost:5173"

    jwt_secret: str = "change-me"
    jwt_access_ttl_minutes: int = 30
    jwt_refresh_ttl_days: int = 14

    database_url: str = "sqlite+aiosqlite:///./app.db"

    llm_provider: str = "openai"
    openai_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_max_steps: int = 8

    payment_provider: str = "mock"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    forfeit_destination: str = "burn"

    scheduler_tick_seconds: int = Field(default=10, ge=1)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.app_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
