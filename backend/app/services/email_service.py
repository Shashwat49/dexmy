import requests

from app.core.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


def send_verification_email(to_email: str, token: str) -> None:
    verify_link = f"{settings.FRONTEND_ORIGIN}/verify-email?token={token}"

    if not settings.RESEND_API_KEY:
        # No API key yet — fall back to printing the link so local dev
        # keeps working without requiring a Resend account first.
        print(f"[email stub] Send to {to_email}: verify your account -> {verify_link}")
        return

    response = requests.post(
        RESEND_API_URL,
        headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
        json={
            "from": settings.EMAIL_FROM_ADDRESS,
            "to": [to_email],
            "subject": "Verify your Dexmy account",
            "html": f"""
                <p>Welcome to Dexmy!</p>
                <p>Click the link below to verify your account and start booking classes:</p>
                <p><a href="{verify_link}">{verify_link}</a></p>
                <p>This link expires in 24 hours.</p>
            """,
        },
        timeout=10,
    )
    if not response.ok:
        print(f"[email error] Failed to send verification email to {to_email}: {response.status_code} {response.text}")