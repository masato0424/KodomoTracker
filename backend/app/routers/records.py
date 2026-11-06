import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.enums import RecordCategory
from app.models.record import Record
from app.schemas.record import RecordCreate, RecordRead, RecordUpdate

router = APIRouter(prefix="/records", tags=["records"])


@router.post("/", response_model=RecordRead, status_code=status.HTTP_201_CREATED)
def create_record(
    payload: RecordCreate, db: Session = Depends(get_db)
) -> Record:
    data = payload.model_dump()
    record_metadata = data.pop("metadata", {})
    record = Record(**data, record_metadata=record_metadata)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/", response_model=list[RecordRead])
def list_records(
    child_id: uuid.UUID | None = None,
    category: RecordCategory | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[Record]:
    stmt = select(Record)
    if child_id is not None:
        stmt = stmt.where(Record.child_id == child_id)
    if category is not None:
        stmt = stmt.where(Record.category == category)
    stmt = stmt.order_by(Record.start_time.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{record_id}", response_model=RecordRead)
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)) -> Record:
    record = db.get(Record, record_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    return record


@router.patch("/{record_id}", response_model=RecordRead)
def update_record(
    record_id: uuid.UUID, payload: RecordUpdate, db: Session = Depends(get_db)
) -> Record:
    record = db.get(Record, record_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    update_data = payload.model_dump(exclude_unset=True)
    if "metadata" in update_data:
        record.record_metadata = update_data.pop("metadata") or {}
    for key, value in update_data.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_record(record_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    record = db.get(Record, record_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Record not found"
        )
    db.delete(record)
    db.commit()
