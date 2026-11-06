from collections.abc import AsyncGenerator, Generator
from typing import Any
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def get_async_database_url(url: str) -> str:
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

_async_session_factory: Any = None


def get_async_session_factory() -> Any:
    global _async_session_factory
    if _async_session_factory is None:
        from sqlalchemy.ext.asyncio import (
            AsyncSession,
            async_sessionmaker,
            create_async_engine,
        )

        async_engine = create_async_engine(
            get_async_database_url(settings.DATABASE_URL),
            echo=settings.DB_ECHO,
            pool_pre_ping=True,
        )
        _async_session_factory = async_sessionmaker(
            bind=async_engine,
            class_=AsyncSession,
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _async_session_factory


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 Declarative Base for all ORM models."""

    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a synchronous database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db() -> AsyncGenerator[Any, None]:
    """FastAPI dependency that provides an AsyncIO SQLAlchemy 2.0 session (asyncpg)."""
    factory = get_async_session_factory()
    async with factory() as session:
        yield session


def init_db() -> None:
    """Create all database tables defined in SQLAlchemy 2.0 ORM models."""
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
