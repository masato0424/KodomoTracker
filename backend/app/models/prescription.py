from __future__ import annotations

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum as SQLEnum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import FrequencyType

if TYPE_CHECKING:
    from app.models.child import Child


class Prescription(Base):
    """処方箋・服薬マスタ (prescriptions)"""

    __tablename__ = "prescriptions"

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
    medicine_name: Mapped[str] = mapped_column(String(255), nullable=False)
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

    child: Mapped[Child] = orm_relationship(
        "Child",
        back_populates="prescriptions",
    )
