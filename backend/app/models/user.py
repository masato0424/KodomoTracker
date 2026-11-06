from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SQLEnum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import RelationshipType, ThemeMode, UserRole

if TYPE_CHECKING:
    from app.models.record import Record


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """家族・関係者アカウント (users)"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    relationship: Mapped[RelationshipType] = mapped_column(
        SQLEnum(
            RelationshipType,
            name="relationship_type_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=RelationshipType.OTHER,
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(
            UserRole,
            name="user_role_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=UserRole.EDITOR,
    )
    theme_mode: Mapped[ThemeMode] = mapped_column(
        SQLEnum(
            ThemeMode,
            name="theme_mode_type",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=ThemeMode.LIGHT,
        server_default=ThemeMode.LIGHT.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utc_now,
        onupdate=_utc_now,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    records: Mapped[list[Record]] = orm_relationship(
        "Record",
        back_populates="recorder",
    )
