import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_session_id,
    get_refresh_token_expiry,
    hash_refresh_token,
)
from app.models.session import UserSession
from app.models.user import User


def create_auth_session(
    db: Session,
    user: User,
) -> tuple[str, str, datetime, datetime]:
    """
    Create a new server-side authentication session.

    Returns:
        access_token
        refresh_token
        access_expires_at
        refresh_expires_at
    """

    session_id = create_session_id()
    refresh_token = create_refresh_token()
    refresh_token_hash = hash_refresh_token(refresh_token)

    refresh_expires_at = get_refresh_token_expiry()

    access_expires_at = datetime.now(timezone.utc)

    # The actual access JWT expiration is handled inside
    # create_access_token. We calculate the corresponding time
    # here so it can be used for the cookie expiry.
    from datetime import timedelta
    from app.core.config import settings

    access_expires_at += timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    session = UserSession(
        id=session_id,
        user_id=user.id,
        refresh_token_hash=refresh_token_hash,
        expires_at=refresh_expires_at,
    )

    db.add(session)

    access_token = create_access_token(
        subject=str(user.id),
        session_id=str(session_id),
    )

    return (
        access_token,
        refresh_token,
        access_expires_at,
        refresh_expires_at,
    )


def get_session_by_refresh_token(
    db: Session,
    refresh_token: str,
) -> UserSession | None:
    """
    Find an authentication session using the hash of the supplied
    refresh credential.
    """

    token_hash = hash_refresh_token(refresh_token)

    return db.scalar(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
        )
    )


def revoke_session(
    db: Session,
    session: UserSession,
) -> None:
    """
    Revoke a server-side authentication session.
    """

    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)

    session.last_used_at = datetime.now(timezone.utc)


def revoke_all_user_sessions(
    db: Session,
    user_id: uuid.UUID,
) -> None:
    """
    Revoke all active sessions belonging to a user.

    Useful for security events such as refresh-token replay detection.
    """

    sessions = db.scalars(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
        )
    ).all()

    now = datetime.now(timezone.utc)

    for session in sessions:
        session.revoked_at = now