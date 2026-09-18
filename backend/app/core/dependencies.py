import uuid
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin import AdminPermission, AdminRolePermission
from app.models.session import UserSession
from app.models.user import User, UserRole


ADMIN_ROLES = {
    UserRole.super_admin,
    UserRole.admin,
    UserRole.academic_manager,
    UserRole.teacher_manager,
    UserRole.finance_manager,
    UserRole.support_agent,
}


def get_current_user(
    access_token: str | None = Cookie(
        default=None,
        alias=settings.ACCESS_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate the request using the HttpOnly access cookie.

    The frontend cannot read this cookie. The server validates both:
    1. the short-lived access JWT
    2. the server-side session referenced by the JWT
    """

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_access_token(access_token)

        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])

    except (JWTError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication",
        )

    session = db.scalar(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    now = datetime.now(timezone.utc)

    if session.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked",
        )

    if session.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired",
        )

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


def require_role(*allowed_roles: UserRole):
    def _dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        # Super admins retain access to legacy role-protected admin
        # endpoints while those endpoints are migrated to permissions.
        if current_user.role == UserRole.super_admin:
            return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return _dependency


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def require_permission(permission: str):
    def _dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if current_user.role not in ADMIN_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )

        if current_user.role == UserRole.super_admin:
            return current_user

        has_permission = db.scalar(
            select(AdminRolePermission.id)
            .join(
                AdminPermission,
                AdminPermission.id == AdminRolePermission.permission_id,
            )
            .where(
                AdminRolePermission.role == current_user.role.value,
                AdminPermission.key == permission,
            )
            .limit(1)
        )

        if has_permission is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )

        return current_user

    return _dependency