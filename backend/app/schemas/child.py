import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ChildColorTheme, Gender


class ChildBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    gender: Gender = Gender.UNSPECIFIED
    birth_date: date
    color_theme: ChildColorTheme = ChildColorTheme.BLUE


class ChildCreate(ChildBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None


class ChildUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    gender: Gender | None = None
    birth_date: date | None = None
    color_theme: ChildColorTheme | None = None
    updated_at: datetime | None = None


class ChildRead(ChildBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
