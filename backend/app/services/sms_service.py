import httpx

from app.core.config import settings


BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/send"


async def send_sms(
    recipient: str,
    message: str,
) -> None:
    if not settings.BREVO_API_KEY:
        raise RuntimeError("BREVO_API_KEY is not configured")

    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json",
    }

    payload = {
        "sender": settings.BREVO_SMS_SENDER,
        "recipient": recipient,
        "content": message,
        "type": "transactional",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            BREVO_SMS_URL,
            headers=headers,
            json=payload,
        )

    if response.status_code >= 400:
        raise RuntimeError(
            f"Brevo SMS request failed: "
            f"{response.status_code} {response.text}"
        )