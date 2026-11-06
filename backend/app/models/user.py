from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SQLEnum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.core.database import Base
from app.models.enums import RelationshipType, UserRole

if TYPE_CHECKING:
    from app.models.record import Record


class User(Base):
    """家族・関係者アカウント (users)"""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship: Mapped[RelationshipType] = mapped_column(
        SQLEnum(
            RelationshipType,
            name="relationship_type_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
        ),
        nullable=False,
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
    theme_mode: Mapped[str] = mapped_column(
        String(16), nullable=False, default="light", server_default="light"
    )

    records: Mapped[list[Record]] = orm_relationship(
        "Record",
        back_populates="recorder",
    )
