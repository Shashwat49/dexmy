from urllib.parse import urlsplit

from app.core.config import settings


DEFAULT_FRONTEND_ORIGINS = {
    "https://dexmyedu.com",
    "https://www.dexmyedu.com",
    "https://dexmy.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
}


def normalize_origin(value: str | None) -> str | None:
    """Normalize a trusted HTTP(S) origin without accepting URL paths or credentials."""
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        parsed = urlsplit(candidate)
        if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
            return None
        if parsed.username or parsed.password or parsed.path not in {"", "/"}:
            return None
        if parsed.query or parsed.fragment:
            return None
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
    except ValueError:
        return None


def get_allowed_frontend_origins() -> set[str]:
    """Return exact trusted origins for both CORS and CSRF validation."""
    configured = {
        normalize_origin(settings.FRONTEND_ORIGIN),
        *(normalize_origin(item) for item in settings.FRONTEND_ORIGINS.split(",")),
    }
    return DEFAULT_FRONTEND_ORIGINS | {origin for origin in configured if origin}
