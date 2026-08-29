from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

# Keep the production domain explicitly allowed so a stale FRONTEND_ORIGIN
# environment variable cannot take the production site offline. The env value
# is still supported for additional environments such as Vercel previews.
allowed_origins = list(dict.fromkeys([
    settings.FRONTEND_ORIGIN,
    "https://dexmyedu.com",
    "https://www.dexmyedu.com",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
