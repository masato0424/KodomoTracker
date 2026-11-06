import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.camera_event import CameraEvent
from app.schemas.camera_event import CameraEventCreate, CameraEventRead

router = APIRouter(prefix="/camera-events", tags=["camera_events"])


@router.post(
    "/", response_model=CameraEventRead, status_code=status.HTTP_201_CREATED
)
def create_camera_event(
    payload: CameraEventCreate, db: Session = Depends(get_db)
) -> CameraEvent:
    event = CameraEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/", response_model=list[CameraEventRead])
def list_camera_events(
    child_id: uuid.UUID | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[CameraEvent]:
    stmt = select(CameraEvent)
    if child_id is not None:
        stmt = stmt.where(CameraEvent.child_id == child_id)
    stmt = stmt.order_by(CameraEvent.detected_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{event_id}", response_model=CameraEventRead)
def get_camera_event(
    event_id: uuid.UUID, db: Session = Depends(get_db)
) -> CameraEvent:
    event = db.get(CameraEvent, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera event not found",
        )
    return event
