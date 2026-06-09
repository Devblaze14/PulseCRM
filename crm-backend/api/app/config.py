"""
Centralised application configuration.

We use pydantic-settings so that every environment variable is:
  * read from the process environment OR an `.env` file,
  * validated / type-coerced once at startup,
  * available as a single importable `settings` object (no scattered os.getenv calls).

Only DATABASE_URL has a dev-friendly default (local SQLite) so the app can boot
with zero secrets during local development. Everything that touches a paid/remote
service (Groq, Supabase) is expected to be supplied via the real `.env`.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database ---------------------------------------------------------
    # Supabase gives a Postgres URL like:
    #   postgresql+psycopg://postgres:<pwd>@<host>:5432/postgres
    # For local smoke-testing we fall back to a file-based SQLite DB so the
    # codebase stays runnable without credentials. The ORM layer (SQLModel)
    # keeps the query code identical across both engines.
    DATABASE_URL: str = "sqlite:///./pulsecrm.db"

    # --- LLM (Groq) -------------------------------------------------------
    # Never hardcode the key; model stays swappable via env.
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # --- Inter-service wiring --------------------------------------------
    # URL of the separate channel microservice the CRM calls over HTTP.
    CHANNEL_SERVICE_URL: str = "http://localhost:8001"
    # Public base URL of THIS CRM, handed to the channel so its callbacks
    # (delivery receipts) can reach us at {CRM_BASE_URL}/api/receipts.
    CRM_BASE_URL: str = "http://localhost:8000"
    # Shared secret echoed in every callback so we can authenticate receipts.
    CALLBACK_SECRET: str = "dev-secret-change-me"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # tolerate unrelated vars in the environment
    )


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so the .env is parsed exactly once per process."""
    return Settings()


# Module-level singleton for convenient `from app.config import settings`.
settings = get_settings()
