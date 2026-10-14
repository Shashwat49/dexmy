from fastapi import Response

from app.core.config import settings


def cookie_secure() -> bool:
    if settings.COOKIE_SECURE is not None:
        return settings.COOKIE_SECURE
    return settings.ENVIRONMENT.strip().lower() in {"production", "prod"}


def cookie_samesite() -> str:
    configured = (settings.COOKIE_SAMESITE or "").strip().lower()
    if configured in {"lax", "strict", "none"}:
        return configured
    return "none" if cookie_secure() else "lax"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    secure = cookie_secure()
    same_site = cookie_samesite()
    # Browsers reject SameSite=None cookies unless Secure is also enabled.
    if same_site == "none" and not secure:
        same_site = "lax"

    response.set_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        domain=settings.COOKIE_DOMAIN,
        path="/",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=settings.ACCESS_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
        secure=cookie_secure(),
        httponly=True,
        samesite=cookie_samesite(),
    )
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
        secure=cookie_secure(),
        httponly=True,
        samesite=cookie_samesite(),
    )
