from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import FrequencyType

if TYPE_CHECKING:
    from app.models.child import Child


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


JSONBCompat = JSON().with_variant(JSONB(), "postgresql")


class Prescription(Base):
    """処方箋・服薬マスタ (prescriptions)"""

    __tablename__ = "prescriptions"
    __table_args__ = (
        CheckConstraint(
            "days > 0 AND days <= 365",
            name="chk_prescriptions_days_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    child_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("children.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage_per_time: Mapped[float] = mapped_column(Float, nullable=False)
    frequency_type: Mapped[FrequencyType] = mapped_column(
        SQLEnum(
            FrequencyType,
            name="frequency_type_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
    )
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    schedule_details: Mapped[dict[str, Any]] = mapped_column(
        JSONBCompat,
        nullable=False,
        default=dict,
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

    child: Mapped[Child] = orm_relationship(
        "Child",
        back_populates="prescriptions",
    )
