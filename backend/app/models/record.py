from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, Enum as SQLEnum, Float, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import RecordCategory

if TYPE_CHECKING:
    from app.models.child import Child
    from app.models.user import User


class Record(Base):
    """統合成長・生活ログ (records)"""

    __tablename__ = "records"

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
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    category: Mapped[RecordCategory] = mapped_column(
        SQLEnum(
            RecordCategory,
            name="record_category_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
        index=True,
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    amount: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    # SQLAlchemy DeclarativeBase reserves `.metadata` on model classes;
    # map Python attribute `record_metadata` to DB column `"metadata"`.
    record_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
    )

    child: Mapped[Child] = orm_relationship(
        "Child",
        back_populates="records",
    )
    recorder: Mapped[User | None] = orm_relationship(
        "User",
        back_populates="records",
    )
