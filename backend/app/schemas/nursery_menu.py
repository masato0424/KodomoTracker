import uuid
from datetime import date
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class NurseryMenuBase(BaseModel):
    target_date: date
    menu_details: dict[str, Any] = Field(default_factory=dict)


class NurseryMenuCreate(NurseryMenuBase):
    pass


class NurseryMenuUpdate(BaseModel):
    target_date: date | None = None
    menu_details: dict[str, Any] | None = None


class NurseryMenuRead(NurseryMenuBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
