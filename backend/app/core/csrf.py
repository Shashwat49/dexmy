import secrets

from fastapi import HTTPException, Request, Response, status

from app.core.config import settings
from app.core.cookies import cookie_samesite, cookie_secure

CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_csrf_cookie(response: Response, token: str) -> None:
    same_site = cookie_samesite()
    secure = cookie_secure()
    if same_site == "none" and not secure:
        same_site = "lax"
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite=same_site,
        domain=settings.COOKIE_DOMAIN,
        path="/",
        max_age=24 * 60 * 60,
    )


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

    origin = request.headers.get("origin")
    if origin:
        allowed_origins = {
            settings.FRONTEND_ORIGIN.rstrip("/"),
            "https://dexmyedu.com",
            "https://www.dexmyedu.com",
            "https://dexmy.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
        }
        if origin.rstrip("/") not in allowed_origins:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Untrusted request origin",
            )
