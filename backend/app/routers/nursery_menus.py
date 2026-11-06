import uuid
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ActorContext, require_write_role
from app.models.nursery_menu import NurseryMenu
from app.schemas.nursery_menu import (
    NurseryMenuCreate,
    NurseryMenuRead,
    NurseryMenuUpdate,
)

router = APIRouter(prefix="/nursery-menus", tags=["nursery_menus"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post(
    "/", response_model=NurseryMenuRead, status_code=status.HTTP_201_CREATED
)
def create_nursery_menu(
    payload: NurseryMenuCreate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> NurseryMenu:
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    menu_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now

    existing = db.get(NurseryMenu, menu_id)
    if existing is None:
        existing = db.scalars(
            select(NurseryMenu).where(NurseryMenu.target_date == payload.target_date)
        ).first()

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

    menu = NurseryMenu(
        id=menu_id,
        **data,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


@router.get("/", response_model=list[NurseryMenuRead])
def list_nursery_menus(
    target_date: date | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[NurseryMenu]:
    stmt = select(NurseryMenu).where(NurseryMenu.deleted_at.is_(None))
    if target_date is not None:
        stmt = stmt.where(NurseryMenu.target_date == target_date)
    stmt = stmt.order_by(NurseryMenu.target_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{menu_id}", response_model=NurseryMenuRead)
def get_nursery_menu(
    menu_id: uuid.UUID, db: Session = Depends(get_db)
) -> NurseryMenu:
    menu = db.get(NurseryMenu, menu_id)
    if not menu or menu.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nursery menu not found",
        )
    return menu


@router.patch("/{menu_id}", response_model=NurseryMenuRead)
def update_nursery_menu(
    menu_id: uuid.UUID,
    payload: NurseryMenuUpdate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> NurseryMenu:
    menu = db.get(NurseryMenu, menu_id)
    if not menu or menu.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nursery menu not found",
        )
    update_data = payload.model_dump(exclude_unset=True)
    incoming_updated_at = _ensure_utc(update_data.pop("updated_at", None))
    existing_updated = _ensure_utc(menu.updated_at)
    if (
        incoming_updated_at is not None
        and existing_updated is not None
        and incoming_updated_at < existing_updated
    ):
        return menu

    for key, value in update_data.items():
        setattr(menu, key, value)
    menu.updated_at = incoming_updated_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(menu)
    return menu


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nursery_menu(
    menu_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> None:
    menu = db.get(NurseryMenu, menu_id)
    if not menu or menu.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nursery menu not found",
        )
    now = datetime.now(timezone.utc)
    menu.deleted_at = now
    menu.updated_at = now
    db.commit()
