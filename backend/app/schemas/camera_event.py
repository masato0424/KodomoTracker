import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CameraEventType


class CameraEventBase(BaseModel):
    child_id: uuid.UUID
    event_type: CameraEventType
    confidence: float = Field(..., ge=0.0, le=1.0)
    detected_at: datetime


class CameraEventCreate(CameraEventBase):
    pass


class CameraEventRead(CameraEventBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
