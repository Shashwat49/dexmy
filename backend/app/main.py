from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.csrf import validate_csrf


app = FastAPI(title=settings.APP_NAME)


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# Credentials are required because authentication is cookie-based.
# Keep origins explicit. Never use "*" with credentialed requests.
allowed_origins = {
    settings.FRONTEND_ORIGIN.rstrip("/"),
    "https://dexmyedu.com",
    "https://www.dexmyedu.com",
    "https://dexmy.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
}


app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Accept",
        "Content-Type",
        "X-CSRF-Token",
    ],
)


# ---------------------------------------------------------------------------
# CSRF protection
# ---------------------------------------------------------------------------
# Authentication is cookie-based, so browser-sent cookies must not be
# sufficient to authorize state-changing requests.
#
# Third-party webhooks use their own signature verification and therefore
# are explicitly excluded from CSRF validation.
#
# Login/signup are unauthenticated public actions and do not require CSRF.
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/signup",
    "/api/v1/payments/stripe/webhook",
    "/api/v1/payments/packages/stripe/webhook",
    "/api/v1/payments/packages/razorpay/webhook",
    "/api/v1/whatsapp/webhook",
}


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"

    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and path not in CSRF_EXEMPT_PATHS
    ):
        try:
            validate_csrf(request)
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )

    return await call_next(request)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
from app.api.v1.router import api_router

app.include_router(
    api_router,
    prefix="/api/v1",
)


# ---------------------------------------------------------------------------
# Classroom WebSocket
# ---------------------------------------------------------------------------
from app.websockets.classroom_ws import router as classroom_ws_router

app.include_router(classroom_ws_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}