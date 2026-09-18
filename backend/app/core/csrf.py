import secrets

from fastapi import HTTPException, Request, status

from app.core.config import settings


CSRF_HEADER_NAME = "X-CSRF-Token"


def create_csrf_token() -> str:
    """
    Generate a random CSRF token.

    This token is intentionally NOT HttpOnly because frontend JavaScript
    needs to read it and send it back in the X-CSRF-Token header.
    """
    return secrets.token_urlsafe(32)


def validate_csrf(request: Request) -> None:
    """
    Validate the double-submit CSRF cookie/header pair.

    Authentication cookies are HttpOnly, while the CSRF cookie is
    readable by the frontend. A state-changing request must send the
    same CSRF value in the custom header.
    """
    cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME)
    header_token = request.headers.get(CSRF_HEADER_NAME)

    if (
        not cookie_token
        or not header_token
        or not secrets.compare_digest(cookie_token, header_token)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation failed",
        )