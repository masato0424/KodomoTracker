from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import uuid
from typing import Any

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.enums import UserRole
from app.models.user import User


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_jwt_token(
    subject: str | uuid.UUID,
    role: UserRole | str,
    token_type: str = "access",
    expires_delta: timedelta | None = None,
) -> str:
    """Create an HMAC-SHA256 signed JWT (RFC 7519) without external C dependencies."""
    now = datetime.now(timezone.utc)
    if expires_delta is None:
        if token_type == "refresh":
            expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        else:
            expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    exp = now + expires_delta

    header = {"alg": settings.JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": str(subject),
        "role": str(role.value if isinstance(role, UserRole) else role),
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": str(uuid.uuid4()),
    }
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def decode_jwt_token(token: str, expected_type: str | None = "access") -> dict[str, Any]:
    """Verify and decode an HMAC-SHA256 JWT token."""
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Malformed JWT token"},
        )
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid token encoding"},
        ) from exc

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid JWT signature"},
        )

    try:
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid JWT payload"},
        ) from exc

    now_ts = int(datetime.now(timezone.utc).timestamp())
    if payload.get("exp") is not None and int(payload["exp"]) < now_ts:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_EXPIRED", "message": "JWT token has expired"},
        )

    if expected_type and payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN_TYPE",
                "message": f"Expected {expected_type} token",
            },
        )
    return payload


@dataclass
class ActorContext:
    user_id: uuid.UUID | None
    role: UserRole
    is_authenticated: bool


def get_actor_context(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    x_user_role: str | None = Header(default=None, alias="X-User-Role"),
    db: Session = Depends(get_db),
) -> ActorContext:
    """Resolve current actor identity and RBAC role from Bearer JWT or client headers."""
    resolved_user_id: uuid.UUID | None = None
    resolved_role: UserRole | None = None
    is_authenticated = False

    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "INVALID_AUTH_HEADER",
                    "message": "Authorization header must be 'Bearer <token>'",
                },
            )
        claims = decode_jwt_token(token, expected_type="access")
        is_authenticated = True
        sub = claims.get("sub")
        if sub:
            try:
                resolved_user_id = uuid.UUID(str(sub))
            except ValueError:
                resolved_user_id = None
        claim_role = claims.get("role")
        if claim_role in {r.value for r in UserRole}:
            resolved_role = UserRole(claim_role)

    if x_user_id and resolved_user_id is None:
        try:
            resolved_user_id = uuid.UUID(x_user_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_USER_ID", "message": "Invalid X-User-Id UUID"},
            ) from exc

    if resolved_user_id is not None:
        request.state.user_id = str(resolved_user_id)
        db_user = db.get(User, resolved_user_id)
        if db_user is not None and db_user.deleted_at is None:
            is_authenticated = True
            if resolved_role is None:
                resolved_role = db_user.role

    if x_user_role is not None:
        role_str = x_user_role.strip().lower()
        if role_str not in {r.value for r in UserRole}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_ROLE", "message": f"Unknown role: {x_user_role}"},
            )
        header_role = UserRole(role_str)
        # If DB user exists, use the more restrictive of header_role and db_user.role,
        # or if no DB user yet (offline-first before user push), honor header_role.
        if resolved_role is None:
            resolved_role = header_role
            is_authenticated = True
        else:
            role_rank = {UserRole.VIEWER: 0, UserRole.EDITOR: 1, UserRole.ADMIN: 2}
            if role_rank[header_role] < role_rank[resolved_role]:
                resolved_role = header_role

    if settings.REQUIRE_AUTH and not is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTHENTICATION_REQUIRED", "message": "Authentication required"},
        )

    return ActorContext(
        user_id=resolved_user_id,
        role=resolved_role or UserRole.ADMIN,
        is_authenticated=is_authenticated,
    )


def raise_insufficient_role(message: str = "Insufficient role for this operation") -> None:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "INSUFFICIENT_ROLE", "message": message},
    )


def require_write_role(actor: ActorContext = Depends(get_actor_context)) -> ActorContext:
    """Allow only `admin` or `editor` roles to perform write operations (PRD 4.4 / 5.1)."""
    if actor.role == UserRole.VIEWER:
        raise_insufficient_role("Viewer role cannot create, update, or delete records.")
    return actor


def require_admin_role(actor: ActorContext = Depends(get_actor_context)) -> ActorContext:
    """Allow only `admin` role to delete master entities (children / users) (PRD 5.1)."""
    if actor.role != UserRole.ADMIN:
        raise_insufficient_role("Admin role is required for this operation.")
    return actor


def compute_webhook_signature(raw_body: bytes, timestamp: str | None = None) -> str:
    """Compute HMAC-SHA256 signature (`sha256=<hex>`) for Edge AI webhook payloads."""
    secret_bytes = settings.WEBHOOK_SECRET.encode("utf-8")
    if timestamp:
        msg = f"{timestamp}.".encode("utf-8") + raw_body
    else:
        msg = raw_body
    digest = hmac.new(secret_bytes, msg, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def verify_camera_webhook_signature(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_webhook_timestamp: str | None = Header(default=None, alias="X-Webhook-Timestamp"),
) -> None:
    """Verify HMAC-SHA256 signature and 300s timestamp window for Edge AI camera webhooks."""
    if not settings.REQUIRE_WEBHOOK_SIGNATURE and not x_hub_signature_256:
        return

    if not x_hub_signature_256:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "MISSING_WEBHOOK_SIGNATURE",
                "message": "X-Hub-Signature-256 header is required",
            },
        )

    now = datetime.now(timezone.utc)
    if x_webhook_timestamp is not None:
        try:
            ts_val = float(x_webhook_timestamp)
            ts_dt = datetime.fromtimestamp(ts_val, tz=timezone.utc)
        except ValueError:
            try:
                ts_dt = datetime.fromisoformat(
                    x_webhook_timestamp.replace("Z", "+00:00")
                )
                if ts_dt.tzinfo is None:
                    ts_dt = ts_dt.replace(tzinfo=timezone.utc)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "code": "INVALID_WEBHOOK_TIMESTAMP",
                        "message": "Invalid X-Webhook-Timestamp format",
                    },
                ) from exc

        drift = abs((now - ts_dt).total_seconds())
        if drift > settings.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "WEBHOOK_TIMESTAMP_EXPIRED",
                    "message": "Webhook timestamp outside 300s replay window",
                },
            )

    raw_body = await request.body()
    expected_raw = compute_webhook_signature(raw_body, None)
    expected_with_ts = (
        compute_webhook_signature(raw_body, x_webhook_timestamp)
        if x_webhook_timestamp
        else expected_raw
    )

    sig = x_hub_signature_256.strip()
    if not sig.startswith("sha256="):
        sig = f"sha256={sig}"

    if not (
        hmac.compare_digest(sig, expected_raw)
        or hmac.compare_digest(sig, expected_with_ts)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_WEBHOOK_SIGNATURE",
                "message": "Invalid X-Hub-Signature-256 signature",
            },
        )
