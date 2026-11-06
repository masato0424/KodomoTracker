from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    JSON,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import RecordCategory

if TYPE_CHECKING:
    from app.models.child import Child
    from app.models.user import User


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


JSONBCompat = JSON().with_variant(JSONB(), "postgresql")


class Record(Base):
    """統合成長・生活ログ (records)"""

    __tablename__ = "records"
    __table_args__ = (
        CheckConstraint(
            "end_time IS NULL OR end_time >= start_time",
            name="chk_records_time_order",
        ),
        Index(
            "idx_records_child_time",
            "child_id",
            text("start_time DESC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "idx_records_child_category_time",
            "child_id",
            "category",
            text("start_time ASC"),
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "idx_records_metadata_gin",
            "metadata",
            postgresql_using="gin",
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
        back_populates="records",
    )
    recorder: Mapped[User | None] = orm_relationship(
        "User",
        back_populates="records",
    )
