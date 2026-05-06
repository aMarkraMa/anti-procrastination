from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "anti-procrastination"
    app_env: str = "development"
    app_port: int = 8000
    app_cors_origins: str = "http://localhost:4200,http://localhost:5173"

    openai_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_max_steps: int = 8
    llm_temperature: float = 0.4
    llm_request_timeout_seconds: int = 60

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"

    llm_provider_order: str = "openai,gemini"

    @property
    def provider_chain(self) -> list[str]:
        return [p.strip() for p in self.llm_provider_order.split(",") if p.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.app_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
