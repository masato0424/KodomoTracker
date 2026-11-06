import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_camera_webhook_signature
from app.models.camera_event import CameraEvent
from app.models.child import Child
from app.models.enums import CameraEventType, RecordCategory
from app.models.record import Record
from app.schemas.camera_event import CameraEventCreate, CameraEventRead

router = APIRouter(prefix="/camera-events", tags=["camera_events"])
webhook_router = APIRouter(prefix="/webhooks/camera-events", tags=["camera_events"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _handle_create_camera_event(
    payload: CameraEventCreate,
    response: Response,
    db: Session,
) -> CameraEvent:
    now = datetime.now(timezone.utc)
    detected_utc = _ensure_utc(payload.detected_at) or now

    # Validate timestamp drift against replay window (PRD 5.1: 300s) when signature verification is active
    if settings.REQUIRE_WEBHOOK_SIGNATURE:
        drift = abs((now - detected_utc).total_seconds())
        if drift > settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "WEBHOOK_TIMESTAMP_EXPIRED",
                    "message": "detected_at is outside the 300-second replay window",
                },
            )

    data = payload.model_dump()
    event_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now

    existing_by_id = db.get(CameraEvent, event_id)
    if existing_by_id is not None:
        existing_updated = _ensure_utc(existing_by_id.updated_at)
        if existing_updated is None or incoming_updated_at >= existing_updated:
            for key, value in data.items():
                setattr(existing_by_id, key, value)
            existing_by_id.updated_at = incoming_updated_at
            existing_by_id.deleted_at = None
            db.commit()
            db.refresh(existing_by_id)
        return existing_by_id

    # PRD 4.4: 5-minute idempotency / debounce for duplicate Edge AI events
    window_start = detected_utc - timedelta(minutes=5)
    window_end = detected_utc + timedelta(minutes=5)
    dup_stmt = (
        select(CameraEvent)
        .where(
            CameraEvent.child_id == payload.child_id,
            CameraEvent.event_type == payload.event_type,
            CameraEvent.deleted_at.is_(None),
            CameraEvent.detected_at >= window_start,
            CameraEvent.detected_at <= window_end,
        )
        .order_by(CameraEvent.detected_at.desc())
        .limit(1)
    )
    duplicate = db.scalars(dup_stmt).first()
    if duplicate is not None:
        response.status_code = status.HTTP_202_ACCEPTED
        return duplicate

    # PRD 4.3.D: If confidence >= 0.75 and child exists, auto-create linked record
    linked_record_id = data.get("linked_record_id")
    if linked_record_id is None and payload.confidence >= 0.75:
        child = db.get(Child, payload.child_id)
        if child is not None and child.deleted_at is None:
            record_category = (
                RecordCategory.SLEEP
                if payload.event_type
                in {CameraEventType.SLEEPSTART, CameraEventType.SLEEPEND}
                else RecordCategory.CUSTOM
            )
            auto_record = Record(
                id=uuid.uuid4(),
                child_id=payload.child_id,
                category=record_category,
                start_time=detected_utc,
                record_metadata={
                    "is_auto_recorded": True,
                    "source": "edge_ai",
                    "event_type": payload.event_type.value,
                    "confidence": payload.confidence,
                },
                created_at=now,
                updated_at=now,
            )
            db.add(auto_record)
            db.flush()
            data["linked_record_id"] = auto_record.id

    event = CameraEvent(
        id=event_id,
        **data,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.post(
    "/",
    response_model=CameraEventRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_camera_webhook_signature)],
)
def create_camera_event(
    payload: CameraEventCreate,
    response: Response,
    db: Session = Depends(get_db),
) -> CameraEvent:
    return _handle_create_camera_event(payload, response, db)


@webhook_router.post(
    "",
    response_model=CameraEventRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_camera_webhook_signature)],
)
@webhook_router.post(
    "/",
    response_model=CameraEventRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_camera_webhook_signature)],
)
def webhook_camera_event(
    payload: CameraEventCreate,
    response: Response,
    db: Session = Depends(get_db),
) -> CameraEvent:
    return _handle_create_camera_event(payload, response, db)


@router.get("/", response_model=list[CameraEventRead])
def list_camera_events(
    child_id: uuid.UUID | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[CameraEvent]:
    stmt = select(CameraEvent).where(CameraEvent.deleted_at.is_(None))
    if child_id is not None:
        stmt = stmt.where(CameraEvent.child_id == child_id)
    stmt = stmt.order_by(CameraEvent.detected_at.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{event_id}", response_model=CameraEventRead)
def get_camera_event(
    event_id: uuid.UUID, db: Session = Depends(get_db)
) -> CameraEvent:
    event = db.get(CameraEvent, event_id)
    if not event or event.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera event not found",
        )
    return event
