import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.prescription import Prescription
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionRead,
    PrescriptionUpdate,
)

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post(
    "/", response_model=PrescriptionRead, status_code=status.HTTP_201_CREATED
)
def create_prescription(
    payload: PrescriptionCreate, db: Session = Depends(get_db)
) -> Prescription:
    prescription = Prescription(**payload.model_dump())
    db.add(prescription)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.get("/", response_model=list[PrescriptionRead])
def list_prescriptions(
    child_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[Prescription]:
    stmt = select(Prescription)
    if child_id is not None:
        stmt = stmt.where(Prescription.child_id == child_id)
    stmt = stmt.order_by(Prescription.start_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{prescription_id}", response_model=PrescriptionRead)
def get_prescription(
    prescription_id: uuid.UUID, db: Session = Depends(get_db)
) -> Prescription:
    prescription = db.get(Prescription, prescription_id)
    if not prescription:
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
) -> Prescription:
    prescription = db.get(Prescription, prescription_id)
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(prescription, key, value)
    db.commit()
    db.refresh(prescription)
    return prescription


@router.delete("/{prescription_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prescription(
    prescription_id: uuid.UUID, db: Session = Depends(get_db)
) -> None:
    prescription = db.get(Prescription, prescription_id)
    if not prescription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prescription not found",
        )
    db.delete(prescription)
    db.commit()
