from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum as SQLEnum, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import ChildColorTheme, Gender

if TYPE_CHECKING:
    from app.models.camera_event import CameraEvent
    from app.models.prescription import Prescription
    from app.models.record import Record


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Child(Base):
    """子ども情報 (children)"""

    __tablename__ = "children"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[Gender] = mapped_column(
        SQLEnum(
            Gender,
            name="gender_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=Gender.UNSPECIFIED,
    )
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    color_theme: Mapped[ChildColorTheme] = mapped_column(
        SQLEnum(
            ChildColorTheme,
            name="child_color_theme",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        default=ChildColorTheme.BLUE,
        server_default=ChildColorTheme.BLUE.value,
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
        back_populates="child",
        cascade="all, delete-orphan",
    )
    prescriptions: Mapped[list[Prescription]] = orm_relationship(
        "Prescription",
        back_populates="child",
        cascade="all, delete-orphan",
    )
    camera_events: Mapped[list[CameraEvent]] = orm_relationship(
        "CameraEvent",
        back_populates="child",
        cascade="all, delete-orphan",
    )
