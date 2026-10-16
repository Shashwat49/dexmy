from __future__ import annotations

import hashlib
import logging
import secrets
import smtplib
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from html import escape

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.account_action_token import AccountActionToken

logger = logging.getLogger(__name__)


def hash_action_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_action_token(
    db: Session,
    *,
    user_id,
    purpose: str,
    target_email: str | None = None,
    lifetime_minutes: int = 60,
) -> str:
    now = datetime.now(timezone.utc)
    db.query(AccountActionToken).filter(
        AccountActionToken.user_id == user_id,
        AccountActionToken.purpose == purpose,
        AccountActionToken.used_at.is_(None),
    ).update({"used_at": now}, synchronize_session=False)
    token = secrets.token_urlsafe(32)
    db.add(AccountActionToken(
        user_id=user_id,
        token_hash=hash_action_token(token),
        purpose=purpose,
        target_email=target_email,
        expires_at=now + timedelta(minutes=lifetime_minutes),
    ))
    db.flush()
    return token


def find_valid_action_token(db: Session, token: str, purpose: str):
    now = datetime.now(timezone.utc)
    return (
        db.query(AccountActionToken)
        .filter(
            AccountActionToken.token_hash == hash_action_token(token),
            AccountActionToken.purpose == purpose,
            AccountActionToken.used_at.is_(None),
            AccountActionToken.expires_at > now,
        )
        .with_for_update()
        .first()
    )


def send_account_email(recipient: str, subject: str, plain_text: str, html_body: str) -> None:
    # Railway Hobby/Trial/Free blocks outbound SMTP. Prefer Resend's HTTPS API
    # whenever configured; HTTPS egress works without upgrading Railway.
    if settings.RESEND_API_KEY:
        sender = settings.RESEND_FROM_EMAIL.strip() or formataddr(
            (settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL)
        )
        payload = json.dumps({
            "from": sender, "to": [recipient], "subject": subject,
            "text": plain_text, "html": html_body,
        }).encode("utf-8")
        request = UrlRequest(
            "https://api.resend.com/emails", data=payload,
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json", "User-Agent": "Dexmy/1.0",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=20) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"Resend email API returned HTTP {response.status}")
                return
        except HTTPError as exc:
            detail = exc.read(1000).decode("utf-8", errors="replace")
            logger.error("Resend email API rejected delivery (HTTP %s): %s", exc.code, detail)
            raise RuntimeError(f"Resend email API rejected delivery (HTTP {exc.code})") from exc
        except URLError as exc:
            logger.error("Unable to reach the Resend email API: %s", exc.reason)
            raise RuntimeError("Unable to reach the Resend email API") from exc

    if not settings.SMTP_PASSWORD:
        raise RuntimeError("Configure RESEND_API_KEY for Railway email delivery; SMTP_PASSWORD alone cannot bypass Railway SMTP restrictions")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
    message["To"] = recipient
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")

    if settings.SMTP_PORT == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=25) as smtp:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=25) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)


def send_password_reset_email(recipient: str, name: str, token: str) -> None:
    url = f"{settings.FRONTEND_ORIGIN.rstrip('/')}/reset-password?token={token}"
    safe_name = escape(name or "there")
    safe_url = escape(url, quote=True)
    send_account_email(
        recipient,
        "Reset your Dexmy password",
        f"Hi {name or 'there'},\n\nUse this link to reset your Dexmy password. It expires in 60 minutes and can be used once:\n{url}\n\nIf you did not request this, you can ignore this email.\n\nTeam Dexmy",
        f"""<!doctype html><html><body style="font-family:Arial,sans-serif;background:#101014;color:#f5f5f5;padding:24px"><div style="max-width:560px;margin:auto;background:#1b1b20;border-radius:14px;padding:28px"><h2>Reset your Dexmy password</h2><p>Hi {safe_name},</p><p>We received a request to reset your password. This link expires in 60 minutes and can be used once.</p><p><a href="{safe_url}" style="display:inline-block;background:#b8323a;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Reset password</a></p><p>If you did not request this, ignore this email.</p><p>Team Dexmy</p></div></body></html>""",
    )


def send_email_change_email(recipient: str, name: str, token: str) -> None:
    url = f"{settings.FRONTEND_ORIGIN.rstrip('/')}/confirm-email-change?token={token}"
    safe_name = escape(name or "there")
    safe_url = escape(url, quote=True)
    send_account_email(
        recipient,
        "Confirm your new Dexmy email address",
        f"Hi {name or 'there'},\n\nConfirm this email address for your Dexmy account using the link below. It expires in 60 minutes and can be used once:\n{url}\n\nIf you did not request this change, ignore this email and your existing email will remain unchanged.\n\nTeam Dexmy",
        f"""<!doctype html><html><body style="font-family:Arial,sans-serif;background:#101014;color:#f5f5f5;padding:24px"><div style="max-width:560px;margin:auto;background:#1b1b20;border-radius:14px;padding:28px"><h2>Confirm your new email</h2><p>Hi {safe_name},</p><p>Confirm that you control this email address. The link expires in 60 minutes and can be used once.</p><p><a href="{safe_url}" style="display:inline-block;background:#b8323a;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Confirm email address</a></p><p>Your current email remains unchanged until confirmation.</p><p>Team Dexmy</p></div></body></html>""",
    )
