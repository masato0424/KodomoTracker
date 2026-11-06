from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
import json
import logging
import time
import uuid

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import init_db
from app.routers import api_router

logger = logging.getLogger("kodomo_tracker")
if not logger.handlers:
    handler = logging.StreamHandler()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler: optionally initializes DB tables in local dev."""
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

# Explicit CORS origins (never combine wildcard "*" with allow_credentials=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Request-Id",
        "X-User-Id",
        "X-User-Role",
        "X-Hub-Signature-256",
        "X-Webhook-Timestamp",
    ],
)


@app.middleware("http")
async def structured_logging_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Emit structured JSON observability logs with request_id, user_id, status_code, and latency_ms (PRD 5.3)."""
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    request.state.request_id = request_id
    user_id = request.headers.get("X-User-Id")
    start_ns = time.perf_counter_ns()

    response = await call_next(request)

    latency_ms = round((time.perf_counter_ns() - start_ns) / 1_000_000, 2)
    resolved_user_id = getattr(request.state, "user_id", None) or user_id
    log_payload = {
        "request_id": request_id,
        "user_id": resolved_user_id,
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "latency_ms": latency_ms,
    }
    logger.info(json.dumps(log_payload, ensure_ascii=False))
    response.headers["X-Request-Id"] = request_id
    return response


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Health check endpoint for container orchestration (ECS/Fargate)."""
    return {"status": "ok"}
