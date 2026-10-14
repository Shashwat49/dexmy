import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_refresh_token, hash_refresh_token
from app.models.user_session import UserSession


class RefreshTokenReuseError(Exception):
    """Raised when a previously rotated refresh token is presented again."""


def create_user_session(db: Session, user_id: uuid.UUID) -> str:
    token = create_refresh_token()
    db.add(UserSession(
        user_id=user_id,
        session_family_id=uuid.uuid4(),
        refresh_token_hash=hash_refresh_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.flush()
    return token


def rotate_user_session(db: Session, refresh_token: str, user_id: uuid.UUID) -> str:
    token_hash = hash_refresh_token(refresh_token)
    session = (
        db.query(UserSession)
        .filter(
            UserSession.refresh_token_hash == token_hash,
            UserSession.user_id == user_id,
        )
        .with_for_update()
        .first()
    )
    now = datetime.now(timezone.utc)
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if session.revoked_at is not None:
        if session.replaced_by_session_id is not None:
            db.query(UserSession).filter(
                UserSession.session_family_id == session.session_family_id,
                UserSession.revoked_at.is_(None),
            ).update({"revoked_at": now}, synchronize_session=False)
            db.flush()
            raise RefreshTokenReuseError()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        session.revoked_at = now
        db.flush()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired")

    new_token = create_refresh_token()
    replacement = UserSession(
        user_id=session.user_id,
        session_family_id=session.session_family_id,
        refresh_token_hash=hash_refresh_token(new_token),
        expires_at=session.expires_at,
    )
    db.add(replacement)
    db.flush()
    session.revoked_at = now
    session.last_used_at = now
    session.replaced_by_session_id = replacement.id
    db.flush()
    return new_token


def revoke_user_session(db: Session, refresh_token: str) -> None:
    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == hash_refresh_token(refresh_token))
        .with_for_update()
        .first()
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.flush()
