from datetime import datetime, timezone

from fastapi import Response

from app.core.config import settings


def _cookie_secure() -> bool:
    return settings.COOKIE_SECURE


def _cookie_samesite() -> str:
    value = settings.COOKIE_SAMESITE.lower()

    if value not in {"lax", "strict", "none"}:
        raise ValueError(
            "COOKIE_SAMESITE must be one of: lax, strict, none"
        )

    if value == "none" and not settings.COOKIE_SECURE:
        raise ValueError(
            "COOKIE_SAMESITE=none requires COOKIE_SECURE=true"
        )

    return value


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
    access_expires_at: datetime,
    refresh_expires_at: datetime,
) -> None:
    """
    Set authentication and CSRF cookies.

    Access and refresh credentials are HttpOnly, so frontend JavaScript
    cannot read them.

    The CSRF token intentionally remains readable by frontend JavaScript
    and must be sent back in the X-CSRF-Token header.
    """

    secure = _cookie_secure()
    samesite = _cookie_samesite()

    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        expires=access_expires_at,
    )

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        expires=refresh_expires_at,
    )

    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=secure,
        samesite=samesite,
        path="/",
        expires=refresh_expires_at,
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Remove all authentication/session cookies from the browser.
    """

    secure = _cookie_secure()
    samesite = _cookie_samesite()

    response.delete_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=samesite,
    )

    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=samesite,
    )

    response.delete_cookie(
        key=settings.CSRF_COOKIE_NAME,
        path="/",
        secure=secure,
        samesite=samesite,
    )