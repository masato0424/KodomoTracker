import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    ActorContext,
    get_actor_context,
    raise_insufficient_role,
    require_admin_role,
    require_write_role,
)
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_write_role),
) -> User:
    now = datetime.now(timezone.utc)
    data = payload.model_dump()
    user_id = data.pop("id", None) or uuid.uuid4()
    incoming_updated_at = _ensure_utc(data.pop("updated_at", None)) or now

    existing = db.get(User, user_id)
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

    user = User(
        id=user_id,
        **data,
        created_at=incoming_updated_at,
        updated_at=incoming_updated_at,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=list[UserRead])
def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[User]:
    stmt = (
        select(User)
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: ActorContext = Depends(get_actor_context),
) -> User:
    update_data = payload.model_dump(exclude_unset=True)
    incoming_updated_at = _ensure_utc(update_data.pop("updated_at", None))

    # Viewer can only toggle their own theme_mode (PRD 5.1)
    if actor.role == UserRole.VIEWER:
        non_theme_keys = set(update_data.keys()) - {"theme_mode"}
        if non_theme_keys or (actor.user_id is not None and actor.user_id != user_id):
            raise_insufficient_role(
                "Viewer role can only switch their own display theme_mode."
            )

    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    existing_updated = _ensure_utc(user.updated_at)
    if (
        incoming_updated_at is not None
        and existing_updated is not None
        and incoming_updated_at < existing_updated
    ):
        return user

    for key, value in update_data.items():
        setattr(user, key, value)
    user.updated_at = incoming_updated_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _actor: ActorContext = Depends(require_admin_role),
) -> None:
    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    now = datetime.now(timezone.utc)
    user.deleted_at = now
    user.updated_at = now
    db.commit()
