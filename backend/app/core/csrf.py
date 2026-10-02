import secrets

from fastapi import HTTPException, Request, status

from app.core.config import settings


CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def validate_csrf(request: Request) -> None:
    cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)

    if not cookie_token or not header_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )

    if not secrets.compare_digest(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token",
        )