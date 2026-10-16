import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.class_reminder_service import process_due_class_reminders

logger = logging.getLogger(__name__)


async def _class_reminder_loop():
    interval = max(15, settings.CLASS_REMINDER_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.to_thread(process_due_class_reminders)
        except Exception:
            logger.exception("Class reminder cycle failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    reminder_task = None
    if settings.CLASS_REMINDERS_ENABLED and settings.SMTP_PASSWORD:
        reminder_task = asyncio.create_task(_class_reminder_loop())
        logger.info("Automatic class reminders enabled (checks every %s seconds)", settings.CLASS_REMINDER_INTERVAL_SECONDS)
    else:
        logger.info("Automatic class reminders are disabled until SMTP credentials and the feature flag are configured")
    try:
        yield
    finally:
        if reminder_task is not None:
            reminder_task.cancel()
            with suppress(asyncio.CancelledError):
                await reminder_task


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

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
