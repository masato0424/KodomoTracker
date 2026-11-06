import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.child import Child
from app.schemas.child import ChildCreate, ChildRead, ChildUpdate

router = APIRouter(prefix="/children", tags=["children"])


@router.post("/", response_model=ChildRead, status_code=status.HTTP_201_CREATED)
def create_child(payload: ChildCreate, db: Session = Depends(get_db)) -> Child:
    child = Child(**payload.model_dump())
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.get("/", response_model=list[ChildRead])
def list_children(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
) -> list[Child]:
    stmt = select(Child).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


@router.get("/{child_id}", response_model=ChildRead)
def get_child(child_id: uuid.UUID, db: Session = Depends(get_db)) -> Child:
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    return child


@router.patch("/{child_id}", response_model=ChildRead)
def update_child(
    child_id: uuid.UUID, payload: ChildUpdate, db: Session = Depends(get_db)
) -> Child:
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(child, key, value)
    db.commit()
    db.refresh(child)
    return child


@router.delete("/{child_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_child(child_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    child = db.get(Child, child_id)
    if not child:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Child not found"
        )
    db.delete(child)
    db.commit()
