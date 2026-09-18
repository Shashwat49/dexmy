import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt
import bcrypt

from app.core.config import settings


def _truncate_for_bcrypt(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    pwd_bytes = _truncate_for_bcrypt(password)
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = _truncate_for_bcrypt(plain_password)
    return bcrypt.checkpw(
        pwd_bytes,
        hashed_password.encode("utf-8"),
    )


def create_access_token(subject: str, session_id: str) -> str:
    """
    Create a short-lived access JWT.

    The JWT is only delivered through an HttpOnly cookie.
    The frontend must never read or persist this token.
    """
    expire = (
        datetime.now(timezone.utc)
        + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": subject,
        "sid": session_id,
        "type": "access",
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    """
    Decode and validate an access JWT.

    Signature and standard JWT claims such as exp are validated
    by python-jose.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )

    if payload.get("type") != "access":
        raise ValueError("Invalid token type")

    if not payload.get("sub"):
        raise ValueError("Missing token subject")

    if not payload.get("sid"):
        raise ValueError("Missing session id")

    return payload


def create_refresh_token() -> str:
    """
    Generate a cryptographically secure opaque refresh credential.

    The raw credential is returned only to the caller so it can be
    placed in an HttpOnly cookie. It must never be persisted directly.
    """
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """
    Persist only a SHA-256 hash of the refresh credential.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session_id() -> uuid.UUID:
    """
    Generate the server-side session identifier.
    """
    return uuid.uuid4()


def get_refresh_token_expiry() -> datetime:
    return (
        datetime.now(timezone.utc)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


def create_email_verification_token(user_id: str) -> str:
    """
    Email-verification JWT is separate from authentication/session
    credentials and remains intentionally unchanged.
    """
    expire = datetime.now(timezone.utc) + timedelta(hours=24)

    payload = {
        "sub": user_id,
        "purpose": "email_verification",
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )