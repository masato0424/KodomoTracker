import uuid
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class NurseryMenuBase(BaseModel):
    target_date: date
    menu_details: dict[str, Any] = Field(default_factory=dict)


class NurseryMenuCreate(NurseryMenuBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None


class NurseryMenuUpdate(BaseModel):
    target_date: date | None = None
    menu_details: dict[str, Any] | None = None
    updated_at: datetime | None = None


class NurseryMenuRead(NurseryMenuBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
