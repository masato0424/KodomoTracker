import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ActorContext, require_admin_role, require_write_role
from app.models.camera_event import CameraEvent
from app.models.child import Child
from app.models.prescription import Prescription
from app.models.record import Record
from app.schemas.child import ChildCreate, ChildRead, ChildUpdate

router = APIRouter(prefix="/children", tags=["children"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post("/", response_model=ChildRead, status_code=status.HTTP_201_CREATED)
def create_child(
    payload: ChildCreate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Child:
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    child_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now

    existing = db.get(Child, child_id)
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

    child = Child(
        id=child_id,
        **data,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.get("/", response_model=list[ChildRead])
def list_children(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[Child]:
    stmt = (
        select(Child)
        .where(Child.deleted_at.is_(None))
        .order_by(Child.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


@router.get("/{child_id}", response_model=ChildRead)
def get_child(child_id: uuid.UUID, db: Session = Depends(get_db)) -> Child:
    child = db.get(Child, child_id)
    if not child or child.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    return child


@router.patch("/{child_id}", response_model=ChildRead)
def update_child(
    child_id: uuid.UUID,
    payload: ChildUpdate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> Child:
    child = db.get(Child, child_id)
    if not child or child.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    update_data = payload.model_dump(exclude_unset=True)
    incoming_updated_at = _ensure_utc(update_data.pop("updated_at", None))
    existing_updated = _ensure_utc(child.updated_at)
    if (
        incoming_updated_at is not None
        and existing_updated is not None
        and incoming_updated_at < existing_updated
    ):
        return child

    for key, value in update_data.items():
        setattr(child, key, value)
    child.updated_at = incoming_updated_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(child)
    return child


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(
    child_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_admin_role),
) -> None:
    child = db.get(Child, child_id)
    if not child or child.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    now = datetime.now(timezone.utc)
    child.deleted_at = now
    child.updated_at = now
    # Cascade soft-delete child's records, prescriptions, and camera_events
    for model_cls in (Record, Prescription, CameraEvent):
        db.execute(
            update(model_cls)
            .where(model_cls.child_id == child_id, model_cls.deleted_at.is_(None))
            .values(deleted_at=now, updated_at=now)
        )
    db.commit()
