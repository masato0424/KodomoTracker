from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import init_db
from app.routers import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler: initializes DB tables on startup."""
    if settings.AUTO_CREATE_TABLES:
        try:
            init_db()
            logger.info("Database tables verified/created via create_all.")
        except OperationalError as exc:
            logger.warning(
                "Could not connect to PostgreSQL on startup (skipping auto create_all): %s",
                exc,
            )
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Health check endpoint for container orchestration (ECS/Fargate)."""
    return {"status": "ok"}
