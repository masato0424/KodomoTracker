import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_jwt_token, decode_jwt_token
from app.models.enums import UserRole
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenRequest(BaseModel):
    user_id: uuid.UUID
    role: UserRole | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    user_id: uuid.UUID
    role: UserRole


@router.post("/token", response_model=TokenResponse)
def issue_token(
    payload: TokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Issue a 15-minute Access Token and 30-day Refresh Token for a family user."""
    user = db.get(User, payload.user_id)
    if user is not None and user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    resolved_role = user.role if user is not None else (payload.role or UserRole.EDITOR)
    access_token = create_jwt_token(payload.user_id, resolved_role, token_type="access")
    refresh_token = create_jwt_token(
        payload.user_id, resolved_role, token_type="refresh"
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=payload.user_id,
        role=resolved_role,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Verify a 30-day Refresh Token and rotate both Access and Refresh tokens."""
    claims = decode_jwt_token(payload.refresh_token, expected_type="refresh")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Missing subject in refresh token"},
        )
    user_id = uuid.UUID(str(sub))
    user = db.get(User, user_id)
    if user is not None and user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_DELETED", "message": "User has been deleted"},
        )
    resolved_role = (
        user.role
        if user is not None
        else UserRole(claims.get("role", UserRole.EDITOR.value))
    )
    access_token = create_jwt_token(user_id, resolved_role, token_type="access")
    refresh_token = create_jwt_token(user_id, resolved_role, token_type="refresh")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        role=resolved_role,
    )
