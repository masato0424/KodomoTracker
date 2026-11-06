import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import RelationshipType, UserRole


class UserBase(BaseModel):
    name: str = Field(..., max_length=255)
    relationship: RelationshipType
    role: UserRole = UserRole.EDITOR
    theme_mode: str = Field(default="light", max_length=16)


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    relationship: RelationshipType | None = None
    role: UserRole | None = None
    theme_mode: str | None = Field(default=None, max_length=16)


class UserRead(UserBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
