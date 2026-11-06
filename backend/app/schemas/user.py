import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RelationshipType, ThemeMode, UserRole


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    relationship: RelationshipType = RelationshipType.OTHER
    role: UserRole = UserRole.EDITOR
    theme_mode: ThemeMode = ThemeMode.LIGHT


class UserCreate(UserBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    relationship: RelationshipType | None = None
    role: UserRole | None = None
    theme_mode: ThemeMode | None = None
    updated_at: datetime | None = None


class UserRead(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
