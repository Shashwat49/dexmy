import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/webhook", response_class=PlainTextResponse)
async def verify_whatsapp_webhook(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    """
    Meta webhook verification endpoint.

    Meta sends:
        hub.mode
        hub.verify_token
        hub.challenge

    We verify the token and return hub.challenge.
    """

    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verified successfully")
        return hub_challenge or ""

    logger.warning("WhatsApp webhook verification failed")
    raise HTTPException(
        status_code=403,
        detail="Invalid verification token",
    )


@router.post("/webhook")
async def receive_whatsapp_webhook(request: Request):
    """
    Receives WhatsApp Cloud API webhook events.
    """

    body = await request.body()

    # Validate Meta's signature when APP_SECRET is configured.
    signature = request.headers.get("X-Hub-Signature-256")

    if settings.META_APP_SECRET:
        if not signature or not signature.startswith("sha256="):
            raise HTTPException(
                status_code=401,
                detail="Missing webhook signature",
            )

        expected_signature = hmac.new(
            settings.META_APP_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()

        received_signature = signature.replace("sha256=", "", 1)

        if not hmac.compare_digest(
            expected_signature,
            received_signature,
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid webhook signature",
            )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload",
        )

    logger.info(
        "WhatsApp webhook received: %s",
        json.dumps(payload, ensure_ascii=False),
    )

    # WhatsApp Cloud API webhook structure:
    #
    # object
    #   └── entry[]
    #         └── changes[]
    #               └── value
    #
    # We don't process messages yet.
    # For now, simply acknowledge the webhook.

    return {"status": "ok"}