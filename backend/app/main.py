from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

# The frontend is served from the production custom domain, the Vercel
# deployment domain, and localhost during development. Keep the configured
# origin as well so existing deployments remain compatible.
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
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.router import api_router
app.include_router(api_router, prefix="/api/v1")

from app.websockets.classroom_ws import router as classroom_ws_router
app.include_router(classroom_ws_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
