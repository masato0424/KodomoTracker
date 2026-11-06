from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    PROJECT_NAME: str = "KodomoTracker API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/kodomo_tracker"
    )
    DB_ECHO: bool = False
    # Alembic migration (`alembic upgrade head`) is the source of truth;
    # keep create_all disabled by default and enable only as an explicit dev flag.
    AUTO_CREATE_TABLES: bool = False

    # Explicit CORS origins (avoid wildcard "*" with allow_credentials=True)
    CORS_ORIGINS: list[str] = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:3000",
    ]

    # JWT & RBAC security settings (PRD 5.1: Access 15 min, Refresh 30 days)
    JWT_SECRET_KEY: str = "kodomo-tracker-dev-jwt-secret-key-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REQUIRE_AUTH: bool = False

    # Edge AI Webhook HMAC-SHA256 & replay protection (PRD 5.1: 300s tolerance)
    WEBHOOK_SECRET: str = "kodomo-tracker-edge-webhook-secret"
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: int = 300
    REQUIRE_WEBHOOK_SIGNATURE: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
