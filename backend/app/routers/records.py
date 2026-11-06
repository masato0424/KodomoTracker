import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ActorContext, raise_insufficient_role, require_write_role
from app.models.enums import RecordCategory, UserRole
from app.models.record import Record
from app.models.user import User
from app.schemas.record import (
    RecordCreate,
    RecordRead,
    RecordUpdate,
    validate_record_domain_values,
)

router = APIRouter(prefix="/records", tags=["records"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _check_recorder_not_viewer(db: Session, recorded_by: uuid.UUID | None) -> None:
    if recorded_by is None:
        return
    recorder = db.get(User, recorded_by)
    if recorder is not None and recorder.deleted_at is None and recorder.role == UserRole.VIEWER:
        raise_insufficient_role("Viewer user cannot be recorded_by on write operations.")


@router.post("/", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
def create_record(
    payload: RecordCreate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Record:
    _check_recorder_not_viewer(db, payload.recorded_by)
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    record_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now
    record_metadata = data.pop("metadata", {}) or {}

    existing = db.get(Record, record_id)
    if existing is not None:
        existing_updated = _ensure_utc(existing.updated_at)
        if existing_updated is None or incoming_updated_at >= existing_updated:
            for key, value in data.items():
                setattr(existing, key, value)
            existing.record_metadata = record_metadata
            existing.updated_at = incoming_updated_at
            existing.deleted_at = None
            db.commit()
            db.refresh(existing)
        return existing

    record = Record(
        id=record_id,
        **data,
        record_metadata=record_metadata,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/", response_model=list[RecordRead])
def list_records(
    child_id: uuid.UUID | None = None,
    category: RecordCategory | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Record]:
    stmt = select(Record).where(Record.deleted_at.is_(None))
    if child_id is not None:
        stmt = stmt.where(Record.child_id == child_id)
    if category is not None:
        stmt = stmt.where(Record.category == category)
    stmt = stmt.order_by(Record.start_time.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{record_id}", response_model=RecordRead)
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)) -> Record:
    record = db.get(Record, record_id)
    if not record or record.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    return record


@router.patch("/{record_id}", response_model=RecordRead)
def update_record(
    record_id: uuid.UUID,
    payload: RecordUpdate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Record:
    record = db.get(Record, record_id)
    if not record or record.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    update_data = payload.model_dump(exclude_unset=True)
    if "recorded_by" in update_data:
        _check_recorder_not_viewer(db, update_data["recorded_by"])

    incoming_updated_at = _ensure_utc(update_data.pop("updated_at", None))
    existing_updated = _ensure_utc(record.updated_at)
    if (
        incoming_updated_at is not None
        and existing_updated is not None
        and incoming_updated_at < existing_updated
    ):
        return record

    next_category = update_data.get("category", record.category)
    next_start = _ensure_utc(update_data.get("start_time", record.start_time))
    next_end = _ensure_utc(
        update_data["end_time"] if "end_time" in update_data else record.end_time
    )
    next_amount = (
        update_data["amount"] if "amount" in update_data else record.amount
    )
    next_metadata = dict(
        (update_data.get("metadata") if "metadata" in update_data else record.record_metadata)
        or {}
    )

    try:
        validate_record_domain_values(
            category=next_category,
            start_time=next_start,
            end_time=next_end,
            amount=next_amount,
            metadata=next_metadata,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    update_data.pop("metadata", None)
    for key, value in update_data.items():
        setattr(record, key, value)
    record.record_metadata = next_metadata
    record.updated_at = incoming_updated_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> None:
    record = db.get(Record, record_id)
    if not record or record.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    now = datetime.now(timezone.utc)
    record.deleted_at = now
    record.updated_at = now
    db.commit()
