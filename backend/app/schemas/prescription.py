import uuid
from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import FrequencyType

_LEGACY_FREQUENCY_MAP: dict[str, str] = {
    "after_meal": FrequencyType.AFTERMEAL.value,
    "interval_hours": FrequencyType.INTERVALHOURS.value,
    "specific_time": FrequencyType.SPECIFICTIME.value,
}


class PrescriptionBase(BaseModel):
    child_id: uuid.UUID
    medicine_name: str = Field(..., min_length=1, max_length=200)
    dosage_per_time: float = Field(..., gt=0)
    frequency_type: FrequencyType
    days: int = Field(..., gt=0, le=365)
    start_date: date
    schedule_details: dict[str, Any] = Field(default_factory=dict)

    @field_validator("frequency_type", mode="before")
    @classmethod
    def normalize_frequency_type(cls, v: Any) -> Any:
        if isinstance(v, str) and v in _LEGACY_FREQUENCY_MAP:
            return _LEGACY_FREQUENCY_MAP[v]
        return v


class PrescriptionCreate(PrescriptionBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None


class PrescriptionUpdate(BaseModel):
    medicine_name: str | None = Field(default=None, min_length=1, max_length=200)
    dosage_per_time: float | None = Field(default=None, gt=0)
    frequency_type: FrequencyType | None = None
    days: int | None = Field(default=None, gt=0, le=365)
    start_date: date | None = None
    schedule_details: dict[str, Any] | None = None
    updated_at: datetime | None = None

    @field_validator("frequency_type", mode="before")
    @classmethod
    def normalize_frequency_type(cls, v: Any) -> Any:
        if isinstance(v, str) and v in _LEGACY_FREQUENCY_MAP:
            return _LEGACY_FREQUENCY_MAP[v]
        return v


class PrescriptionRead(PrescriptionBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
