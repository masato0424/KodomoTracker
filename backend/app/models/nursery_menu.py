from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import Date
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NurseryMenu(Base):
    """保育園・学校献立データ (nursery_menus)"""

    __tablename__ = "nursery_menus"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    target_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
    )
    menu_details: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
