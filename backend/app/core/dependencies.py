import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.admin import AdminPermission, AdminRolePermission
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()

ADMIN_ROLES = {
    UserRole.super_admin,
    UserRole.admin,
    UserRole.academic_manager,
    UserRole.teacher_manager,
    UserRole.finance_manager,
    UserRole.support_agent,
}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*allowed_roles: UserRole):
    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        # Super admins retain access to legacy role-protected admin endpoints
        # while those endpoints are migrated to fine-grained permissions.
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
