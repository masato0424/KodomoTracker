import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Gender


class ChildBase(BaseModel):
    name: str = Field(..., max_length=255)
    gender: Gender = Gender.UNSPECIFIED
    birth_date: date
    color_theme: str = Field(default="blue", max_length=32)


class ChildCreate(ChildBase):
    pass


class ChildUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    gender: Gender | None = None
    birth_date: date | None = None
    color_theme: str | None = Field(default=None, max_length=32)


class ChildRead(ChildBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
