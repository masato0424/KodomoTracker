import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import CameraEventType

_LEGACY_CAMERA_EVENT_MAP: dict[str, str] = {
    "sleep_start": CameraEventType.SLEEPSTART.value,
    "sleep_end": CameraEventType.SLEEPEND.value,
}


class CameraEventBase(BaseModel):
    child_id: uuid.UUID
    event_type: CameraEventType
    confidence: float = Field(..., ge=0.0, le=1.0)
    detected_at: datetime
    linked_record_id: uuid.UUID | None = None

    @field_validator("event_type", mode="before")
    @classmethod
    def normalize_event_type(cls, v: Any) -> Any:
        if isinstance(v, str) and v in _LEGACY_CAMERA_EVENT_MAP:
            return _LEGACY_CAMERA_EVENT_MAP[v]
        return v


class CameraEventCreate(CameraEventBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None


class CameraEventRead(CameraEventBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
