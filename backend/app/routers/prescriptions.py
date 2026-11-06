import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ActorContext, require_write_role
from app.models.prescription import Prescription
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionRead,
    PrescriptionUpdate,
)

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post(
    "/", response_model=PrescriptionRead, status_code=status.HTTP_201_CREATED
)
def create_prescription(
    payload: PrescriptionCreate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Prescription:
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    prescription_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now

    existing = db.get(Prescription, prescription_id)
    if existing is not None:
        existing_updated = _ensure_utc(existing.updated_at)
        if existing_updated is None or incoming_updated_at >= existing_updated:
            for key, value in data.items():
                setattr(existing, key, value)
            existing.updated_at = incoming_updated_at
            existing.deleted_at = None
            db.commit()
            db.refresh(existing)
        return existing

    prescription = Prescription(
        id=prescription_id,
        **data,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(prescription)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.get("/", response_model=list[PrescriptionRead])
def list_prescriptions(
    child_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Prescription]:
    stmt = select(Prescription).where(Prescription.deleted_at.is_(None))
    if child_id is not None:
        stmt = stmt.where(Prescription.child_id == child_id)
    stmt = stmt.order_by(Prescription.start_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{prescription_id}", response_model=PrescriptionRead)
def get_prescription(
    prescription_id: uuid.UUID, db: Session = Depends(get_db)
) -> Prescription:
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    return prescription


@router.patch("/{prescription_id}", response_model=PrescriptionRead)
def update_prescription(
    prescription_id: uuid.UUID,
    payload: PrescriptionUpdate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Prescription:
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    incoming_updated_at = _ensure_utc(update_data.pop("updated_at", None))
    existing_updated = _ensure_utc(prescription.updated_at)
    if (
        incoming_updated_at is not None
        and existing_updated is not None
        and incoming_updated_at < existing_updated
    ):
        return prescription

    for key, value in update_data.items():
        setattr(prescription, key, value)
    prescription.updated_at = incoming_updated_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prescription(
    prescription_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> None:
    prescription = db.get(Prescription, prescription_id)
    if not prescription or prescription.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    now = datetime.now(timezone.utc)
    prescription.deleted_at = now
    prescription.updated_at = now
    db.commit()
