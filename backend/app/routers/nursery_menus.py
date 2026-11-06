import uuid
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.nursery_menu import NurseryMenu
from app.schemas.nursery_menu import (
    NurseryMenuCreate,
    NurseryMenuRead,
    NurseryMenuUpdate,
)

router = APIRouter(prefix="/nursery-menus", tags=["nursery_menus"])


@router.post(
    "/", response_model=NurseryMenuRead, status_code=status.HTTP_201_CREATED
)
def create_nursery_menu(
    payload: NurseryMenuCreate, db: Session = Depends(get_db)
) -> NurseryMenu:
    menu = NurseryMenu(**payload.model_dump())
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return menu


@router.get("/", response_model=list[NurseryMenuRead])
def list_nursery_menus(
    target_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[NurseryMenu]:
    stmt = select(NurseryMenu)
    if target_date is not None:
        stmt = stmt.where(NurseryMenu.target_date == target_date)
    stmt = stmt.order_by(NurseryMenu.target_date.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{menu_id}", response_model=NurseryMenuRead)
def get_nursery_menu(
    menu_id: uuid.UUID, db: Session = Depends(get_db)
) -> NurseryMenu:
    menu = db.get(NurseryMenu, menu_id)
    if not menu:
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
) -> NurseryMenu:
    menu = db.get(NurseryMenu, menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nursery menu not found",
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(menu, key, value)
    db.commit()
    db.refresh(menu)
    return menu


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nursery_menu(
    menu_id: uuid.UUID, db: Session = Depends(get_db)
) -> None:
    menu = db.get(NurseryMenu, menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nursery menu not found",
        )
    db.delete(menu)
    db.commit()
