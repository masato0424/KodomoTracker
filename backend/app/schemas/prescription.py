import uuid
from datetime import date
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FrequencyType


class PrescriptionBase(BaseModel):
    child_id: uuid.UUID
    medicine_name: str = Field(..., max_length=255)
    dosage_per_time: float = Field(..., gt=0)
    frequency_type: FrequencyType
    days: int = Field(..., gt=0)
    start_date: date


class PrescriptionCreate(PrescriptionBase):
    pass


class PrescriptionUpdate(BaseModel):
    medicine_name: str | None = Field(default=None, max_length=255)
    dosage_per_time: float | None = Field(default=None, gt=0)
    frequency_type: FrequencyType | None = None
    days: int | None = Field(default=None, gt=0)
    start_date: date | None = None


class PrescriptionRead(PrescriptionBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
