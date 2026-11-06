from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ActorContext, raise_insufficient_role, require_write_role
from app.models.camera_event import CameraEvent
from app.models.child import Child
from app.models.enums import UserRole
from app.models.nursery_menu import NurseryMenu
from app.models.prescription import Prescription
from app.models.record import Record
from app.models.user import User
from app.schemas.camera_event import CameraEventCreate, CameraEventRead
from app.schemas.child import ChildCreate, ChildRead
from app.schemas.nursery_menu import NurseryMenuCreate, NurseryMenuRead
from app.schemas.prescription import PrescriptionCreate, PrescriptionRead
from app.schemas.record import RecordCreate, RecordRead
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/sync", tags=["sync"])

SYNC_TABLES = (
    "users",
    "children",
    "records",
    "prescriptions",
    "camera_events",
    "nursery_menus",
)


class TableSyncChanges(BaseModel):
    created: list[dict[str, Any]] = Field(default_factory=list)
    updated: list[dict[str, Any]] = Field(default_factory=list)
    deleted: list[str] = Field(default_factory=list)


class SyncPullResponse(BaseModel):
    changes: dict[str, TableSyncChanges]
    timestamp: int


class SyncPushRequest(BaseModel):
    changes: dict[str, TableSyncChanges]
    last_pulled_at: int | None = None


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _parse_epoch_ms_or_iso(val: Any) -> datetime | None:
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return _ensure_utc(val)
    if isinstance(val, (int, float)):
        # Support both milliseconds and seconds
        ts_sec = val / 1000.0 if val > 1e11 else float(val)
        return datetime.fromtimestamp(ts_sec, tz=timezone.utc)
    if isinstance(val, str):
        try:
            num = float(val)
            ts_sec = num / 1000.0 if num > 1e11 else num
            return datetime.fromtimestamp(ts_sec, tz=timezone.utc)
        except ValueError:
            try:
                parsed = datetime.fromisoformat(val.replace("Z", "+00:00"))
                return _ensure_utc(parsed)
            except ValueError:
                return None
    return None


def _serialize_model(model_obj: Any, schema_cls: type[BaseModel]) -> dict[str, Any]:
    validated = schema_cls.model_validate(model_obj)
    return validated.model_dump(mode="json", by_alias=True)


@router.get("/pull", response_model=SyncPullResponse)
def pull_sync_changes(
    last_pulled_at: int | None = Query(default=None, ge=0),
    child_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> SyncPullResponse:
    """
    Differential Pull Sync API (PRD 4.2 / 5.2):
    - When `last_pulled_at` is omitted or 0: returns active records (`deleted_at IS NULL`) in `created`.
    - When `last_pulled_at > 0`: returns only records modified after `last_pulled_at` in `updated`
      and soft-deleted IDs (`deleted_at > last_pulled_at`) in `deleted`.
    """
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    since_dt = (
        datetime.fromtimestamp(last_pulled_at / 1000.0, tz=timezone.utc)
        if last_pulled_at and last_pulled_at > 0
        else None
    )

    table_configs: list[tuple[str, Any, type[BaseModel], bool]] = [
        ("users", User, UserRead, False),
        ("children", Child, ChildRead, False),
        ("records", Record, RecordRead, True),
        ("prescriptions", Prescription, PrescriptionRead, True),
        ("camera_events", CameraEvent, CameraEventRead, True),
        ("nursery_menus", NurseryMenu, NurseryMenuRead, False),
    ]

    result_changes: dict[str, TableSyncChanges] = {}

    for table_name, model_cls, read_schema, supports_child_filter in table_configs:
        active_stmt = select(model_cls).where(model_cls.deleted_at.is_(None))
        if supports_child_filter and child_id is not None:
            active_stmt = active_stmt.where(model_cls.child_id == child_id)

        if since_dt is None:
            rows = list(db.scalars(active_stmt).all())
            result_changes[table_name] = TableSyncChanges(
                created=[_serialize_model(r, read_schema) for r in rows],
                updated=[],
                deleted=[],
            )
        else:
            updated_stmt = active_stmt.where(model_cls.updated_at > since_dt)
            updated_rows = list(db.scalars(updated_stmt).all())

            deleted_stmt = select(model_cls.id).where(
                model_cls.deleted_at.is_not(None),
                model_cls.deleted_at > since_dt,
            )
            if supports_child_filter and child_id is not None:
                deleted_stmt = deleted_stmt.where(model_cls.child_id == child_id)
            deleted_ids = [str(rid) for rid in db.scalars(deleted_stmt).all()]

            result_changes[table_name] = TableSyncChanges(
                created=[],
                updated=[_serialize_model(r, read_schema) for r in updated_rows],
                deleted=deleted_ids,
            )

    return SyncPullResponse(changes=result_changes, timestamp=now_ms)


def _upsert_entity(
    db: Session,
    table_name: str,
    raw_item: dict[str, Any],
    now: datetime,
) -> None:
    item = dict(raw_item)
    raw_id = item.get("id")
    entity_id = uuid.UUID(str(raw_id)) if raw_id else uuid.uuid4()
    item["id"] = entity_id

    incoming_updated = (
        _parse_epoch_ms_or_iso(item.get("updated_at"))
        or _parse_epoch_ms_or_iso(item.get("_updated_at"))
        or now
    )
    item["updated_at"] = incoming_updated

    try:
        if table_name == "users":
            validated = UserCreate.model_validate(item)
            data = validated.model_dump(exclude={"id", "updated_at"})
            model_cls = User
        elif table_name == "children":
            validated = ChildCreate.model_validate(item)
            data = validated.model_dump(exclude={"id", "updated_at"})
            model_cls = Child
        elif table_name == "records":
            for time_field in ("start_time", "end_time"):
                if time_field in item and isinstance(item[time_field], (int, float)):
                    item[time_field] = _parse_epoch_ms_or_iso(item[time_field])
            if isinstance(item.get("metadata"), str):
                import json

                try:
                    item["metadata"] = json.loads(item["metadata"] or "{}")
                except Exception:
                    item["metadata"] = {}
            validated_rec = RecordCreate.model_validate(item)
            data = validated_rec.model_dump(exclude={"id", "updated_at"})
            data["record_metadata"] = data.pop("metadata", {}) or {}
            model_cls = Record
        elif table_name == "prescriptions":
            if isinstance(item.get("schedule_details"), str):
                import json

                try:
                    item["schedule_details"] = json.loads(
                        item["schedule_details"] or "{}"
                    )
                except Exception:
                    item["schedule_details"] = {}
            validated_presc = PrescriptionCreate.model_validate(item)
            data = validated_presc.model_dump(exclude={"id", "updated_at"})
            model_cls = Prescription
        elif table_name == "camera_events":
            if "detected_at" in item and isinstance(item["detected_at"], (int, float)):
                item["detected_at"] = _parse_epoch_ms_or_iso(item["detected_at"])
            validated_evt = CameraEventCreate.model_validate(item)
            data = validated_evt.model_dump(exclude={"id", "updated_at"})
            model_cls = CameraEvent
        elif table_name == "nursery_menus":
            if isinstance(item.get("menu_details"), str):
                import json

                try:
                    item["menu_details"] = json.loads(item["menu_details"] or "{}")
                except Exception:
                    item["menu_details"] = {}
            validated_menu = NurseryMenuCreate.model_validate(item)
            data = validated_menu.model_dump(exclude={"id", "updated_at"})
            model_cls = NurseryMenu
        else:
            return
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=exc.errors(),
        ) from exc

    existing = db.get(model_cls, entity_id)
    if existing is not None:
        existing_updated = _ensure_utc(existing.updated_at)
        if existing_updated is None or incoming_updated >= existing_updated:
            for k, v in data.items():
                setattr(existing, k, v)
            existing.updated_at = incoming_updated
            existing.deleted_at = None
        return

    new_obj = model_cls(
        id=entity_id,
        **data,
        created_at=incoming_updated,
        updated_at=incoming_updated,
    )
    db.add(new_obj)


@router.post("/push", status_code=status.HTTP_200_OK)
def push_sync_changes(
    payload: SyncPushRequest,
    db: Session = Depends(get_db),
    actor: ActorContext = Depends(require_write_role),
) -> dict[str, Any]:
    """
    Transactional Bulk Push Sync API with Client UUID Preservation & Last-Write-Wins (`updated_at`).
    """
    now = datetime.now(timezone.utc)
    table_model_map: dict[str, Any] = {
        "users": User,
        "children": Child,
        "records": Record,
        "prescriptions": Prescription,
        "camera_events": CameraEvent,
        "nursery_menus": NurseryMenu,
    }

    for table_name in SYNC_TABLES:
        table_changes = payload.changes.get(table_name)
        if not table_changes:
            continue

        for raw in table_changes.created:
            _upsert_entity(db, table_name, raw, now)

        for raw in table_changes.updated:
            _upsert_entity(db, table_name, raw, now)

        model_cls = table_model_map[table_name]
        for deleted_id_str in table_changes.deleted:
            if table_name in {"users", "children"} and actor.role != UserRole.ADMIN:
                raise_insufficient_role(
                    f"Admin role is required to delete {table_name}."
                )
            try:
                del_uuid = uuid.UUID(str(deleted_id_str))
            except ValueError:
                continue
            existing = db.get(model_cls, del_uuid)
            if existing is not None and existing.deleted_at is None:
                existing.deleted_at = now
                existing.updated_at = now
                if table_name == "children":
                    for child_dep_cls in (Record, Prescription, CameraEvent):
                        db.execute(
                            update(child_dep_cls)
                            .where(
                                child_dep_cls.child_id == del_uuid,
                                child_dep_cls.deleted_at.is_(None),
                            )
                            .values(deleted_at=now, updated_at=now)
                        )

    db.commit()
    return {
        "status": "ok",
        "synced_at": int(now.timestamp() * 1000),
    }
