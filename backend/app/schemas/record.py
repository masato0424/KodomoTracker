import uuid
from datetime import datetime
from typing import Any
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from app.models.enums import RecordCategory

AMOUNT_RANGES: dict[RecordCategory, tuple[float, float]] = {
    RecordCategory.MILK: (0.0, 2000.0),
    RecordCategory.BABY_FOOD: (0.0, 2000.0),
    RecordCategory.MEAL: (0.0, 2000.0),
    RecordCategory.BODY_TEMP: (32.0, 43.0),
    RecordCategory.HEIGHT: (20.0, 220.0),
    RecordCategory.WEIGHT: (0.3, 150.0),
    RecordCategory.HEAD_CIRCUMFERENCE: (20.0, 120.0),
    RecordCategory.CHEST_CIRCUMFERENCE: (20.0, 120.0),
    RecordCategory.FOOT_SIZE: (5.0, 35.0),
}

ITEM_NAME_CATEGORIES: set[RecordCategory] = {
    RecordCategory.MILK,
    RecordCategory.BABY_FOOD,
    RecordCategory.MEAL,
}


def validate_record_domain_values(
    category: RecordCategory | None,
    start_time: datetime | None,
    end_time: datetime | None,
    amount: float | None,
    metadata: dict[str, Any] | None,
) -> None:
    if start_time is not None and end_time is not None and end_time < start_time:
        raise ValueError("end_time must be >= start_time")
    if amount is not None and category is not None and category in AMOUNT_RANGES:
        low, high = AMOUNT_RANGES[category]
        if not low <= amount <= high:
            raise ValueError(
                f"amount out of range for {category.value}: expected {low}..{high}, got {amount}"
            )
    if (
        category is not None
        and category not in ITEM_NAME_CATEGORIES
        and metadata is not None
    ):
        metadata.pop("item_name", None)


class RecordBase(BaseModel):
    child_id: uuid.UUID
    recorded_by: uuid.UUID | None = None
    category: RecordCategory
    start_time: datetime
    end_time: datetime | None = None
    amount: float | None = None
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("record_metadata", "metadata"),
        serialization_alias="metadata",
    )


class RecordCreate(RecordBase):
    id: uuid.UUID | None = None
    updated_at: datetime | None = None

    @model_validator(mode="after")
    def check_time_and_amount(self) -> "RecordCreate":
        validate_record_domain_values(
            category=self.category,
            start_time=self.start_time,
            end_time=self.end_time,
            amount=self.amount,
            metadata=self.metadata,
        )
        return self


class RecordUpdate(BaseModel):
    recorded_by: uuid.UUID | None = None
    category: RecordCategory | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    amount: float | None = None
    metadata: dict[str, Any] | None = None
    updated_at: datetime | None = None

    @model_validator(mode="after")
    def check_partial_time_and_amount(self) -> "RecordUpdate":
        validate_record_domain_values(
            category=self.category,
            start_time=self.start_time,
            end_time=self.end_time,
            amount=self.amount,
            metadata=self.metadata,
        )
        return self


class RecordRead(RecordBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
