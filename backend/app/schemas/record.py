import uuid
from datetime import datetime
from typing import Any
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models.enums import RecordCategory


class RecordBase(BaseModel):
    child_id: uuid.UUID
    recorded_by: uuid.UUID | None = None
    category: RecordCategory
    start_time: datetime
    end_time: datetime | None = None
    amount: float | None = None
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("metadata", "record_metadata"),
        serialization_alias="metadata",
    )


class RecordCreate(RecordBase):
    pass


class RecordUpdate(BaseModel):
    recorded_by: uuid.UUID | None = None
    category: RecordCategory | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    amount: float | None = None
    metadata: dict[str, Any] | None = None


class RecordRead(RecordBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
