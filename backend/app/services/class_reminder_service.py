from __future__ import annotations

import logging
import smtplib
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from zoneinfo import ZoneInfo

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.booking_reminder import BookingReminderDelivery
from app.models.classroom import ClassSession
from app.models.teacher import Subject
from app.models.user import User

logger = logging.getLogger(__name__)
CLASS_TIMEZONE = ZoneInfo("Asia/Kolkata")
MAX_DELIVERY_ATTEMPTS = 5


def _normalise_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _claim_delivery(db, booking_id, recipient_type: str, recipient_email: str):
    """Atomically claim one recipient's reminder across concurrent app workers."""
    now = datetime.now(timezone.utc)
    statement = (
        pg_insert(BookingReminderDelivery)
        .values(
            booking_id=booking_id,
            recipient_type=recipient_type,
            recipient_email=recipient_email,
            status="sending",
            attempts=1,
            created_at=now,
        )
        .on_conflict_do_nothing(
            index_elements=["booking_id", "recipient_type"]
        )
        .returning(BookingReminderDelivery.id)
    )
    delivery_id = db.execute(statement).scalar_one_or_none()
    if delivery_id is not None:
        db.commit()
        return delivery_id

    existing = (
        db.query(BookingReminderDelivery)
        .filter(
            BookingReminderDelivery.booking_id == booking_id,
            BookingReminderDelivery.recipient_type == recipient_type,
        )
        .first()
    )
    if existing is None or existing.status != "failed" or existing.attempts >= MAX_DELIVERY_ATTEMPTS:
        return None

    claimed = db.execute(
        update(BookingReminderDelivery)
        .where(
            BookingReminderDelivery.id == existing.id,
            BookingReminderDelivery.status == "failed",
            BookingReminderDelivery.attempts < MAX_DELIVERY_ATTEMPTS,
        )
        .values(
            status="sending",
            attempts=BookingReminderDelivery.attempts + 1,
            recipient_email=recipient_email,
            last_error=None,
            created_at=now,
        )
    )
    db.commit()
    return existing.id if claimed.rowcount == 1 else None


def _finish_delivery(db, delivery_id, *, sent: bool, error: str | None = None):
    delivery = db.get(BookingReminderDelivery, delivery_id)
    if delivery is None:
        return
    delivery.status = "sent" if sent else "failed"
    delivery.sent_at = datetime.now(timezone.utc) if sent else None
    delivery.last_error = None if sent else (error or "Email delivery failed")[:1000]
    db.commit()


def _send_email(recipient: str, subject: str, plain_text: str, html_body: str):
    # Prefer HTTPS delivery on Railway plans where outbound SMTP is disabled.
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
            logger.error("Resend reminder API rejected delivery (HTTP %s): %s", exc.code, detail)
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
        return

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=25) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


def _render_message(*, recipient_type: str, recipient_name: str, other_name: str,
                    subject_name: str, scheduled_at: datetime, duration: int, classroom_url: str):
    local_time = _normalise_datetime(scheduled_at).astimezone(CLASS_TIMEZONE)
    date_text = local_time.strftime("%A, %B %d, %Y").replace(" 0", " ")
    time_text = local_time.strftime("%I:%M %p IST").lstrip("0")
    safe_name = escape(recipient_name or ("Student" if recipient_type == "student" else "Teacher"))
    safe_other = escape(other_name or "To be confirmed")
    safe_subject = escape(subject_name or "Class")
    safe_date = escape(date_text)
    safe_time = escape(time_text)
    safe_duration = escape(str(duration))
    safe_url = escape(classroom_url, quote=True)

    if recipient_type == "student":
        email_subject = "Your Dexmy class starts in 30 minutes!"
        greeting = f"Hi {recipient_name or 'there'},"
        opening = "Your upcoming class with Dexmy is scheduled to begin in 30 minutes."
        other_label = "Teacher"
        other_line = f"Your teacher is {other_name or 'To be confirmed'}."
        closing = "Please be ready on time, find a quiet place to learn, and check your camera, microphone, and internet connection."
    else:
        email_subject = "Class reminder — your Dexmy session starts in 30 minutes"
        greeting = f"Hi {recipient_name or 'there'},"
        opening = "Your upcoming Dexmy class is scheduled to begin in 30 minutes."
        other_label = "Student"
        other_line = f"Your student is {other_name or 'To be confirmed'}."
        closing = "Please be ready on time and ensure your teaching materials, camera, microphone, and internet connection are ready before the session begins."

    plain_text = (
        f"{greeting}\n\n{opening}\n\n"
        f"Class: {subject_name or 'Class'}\n"
        f"{other_label}: {other_name or 'To be confirmed'}\n"
        f"Date: {date_text}\nTime: {time_text}\nDuration: {duration} minutes\n"
        f"Classroom: {classroom_url}\n\n{closing}\n\n"
        "Best regards,\nTeam Dexmy\nLearn better. Achieve more."
    )
    html_body = f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#0B0B0C;font-family:Arial,Helvetica,sans-serif;color:#F5F5F5;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0B0C;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#151518;border:1px solid #303036;border-radius:18px;overflow:hidden;">
<tr><td style="height:5px;background:#D9AD48;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 30px 18px;text-align:center;">
<img src="https://dexmyedu.com/dexmy-logo-bg-removed.png" alt="Dexmy" width="142" style="display:block;width:142px;max-width:100%;height:auto;margin:0 auto 20px;">
<div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#3A171B;color:#F06A72;font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">Class reminder</div>
<h1 style="margin:18px 0 10px;color:#FFFFFF;font-size:25px;line-height:1.3;">Your class starts in 30 minutes</h1>
<p style="margin:0 0 10px;color:#FFFFFF;font-size:15px;line-height:1.7;">{escape(greeting)}</p>
<p style="margin:0;color:#C4C4CC;font-size:15px;line-height:1.7;">{escape(opening)}</p>
</td></tr>
<tr><td style="padding:8px 30px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0F0F12;border:1px solid #303036;border-radius:12px;">
<tr><td style="padding:20px 22px;">
<p style="margin:0 0 14px;color:#D9AD48;font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">Class details</p>
<p style="margin:0 0 12px;color:#FFFFFF;font-size:17px;font-weight:bold;">{safe_subject}</p>
<p style="margin:0 0 9px;color:#D7D7DE;font-size:14px;line-height:1.6;"><strong style="color:#FFFFFF;">{other_label}:</strong> {safe_other}</p>
<p style="margin:0 0 9px;color:#D7D7DE;font-size:14px;line-height:1.6;"><strong style="color:#FFFFFF;">Date:</strong> {safe_date}</p>
<p style="margin:0 0 9px;color:#D7D7DE;font-size:14px;line-height:1.6;"><strong style="color:#FFFFFF;">Time:</strong> {safe_time}</p>
<p style="margin:0;color:#D7D7DE;font-size:14px;line-height:1.6;"><strong style="color:#FFFFFF;">Duration:</strong> {safe_duration} minutes</p>
</td></tr></table>
<p style="margin:20px 0;color:#C4C4CC;font-size:14px;line-height:1.7;">{escape(closing)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px auto 10px;"><tr><td align="center" bgcolor="#D9AD48" style="border-radius:10px;">
<a href="{safe_url}" style="display:inline-block;padding:14px 24px;color:#201707;text-decoration:none;font-size:14px;font-weight:bold;">Open Dexmy Classroom</a>
</td></tr></table>
<p style="margin:14px 0 0;text-align:center;color:#8F8F9A;font-size:12px;line-height:1.6;">If the button doesn't work, copy this link:<br><a href="{safe_url}" style="color:#D9AD48;word-break:break-all;">{safe_url}</a></p>
</td></tr>
<tr><td style="padding:18px 30px 25px;border-top:1px solid #303036;text-align:center;">
<p style="margin:0;color:#FFFFFF;font-size:14px;font-weight:bold;">Team Dexmy</p>
<p style="margin:6px 0 0;color:#8F8F9A;font-size:12px;">Learn better. Achieve more.</p>
</td></tr></table>
</td></tr></table></body></html>"""
    return email_subject, plain_text, html_body


def process_due_class_reminders():
    """Send each assigned, confirmed booking's student/teacher reminder once."""
    if not settings.CLASS_REMINDERS_ENABLED or not settings.SMTP_PASSWORD:
        return

    now = datetime.now(timezone.utc)
    due_before = now + timedelta(minutes=max(1, settings.CLASS_REMINDER_MINUTES_BEFORE))
    StudentUser = aliased(User)
    TeacherUser = aliased(User)

    with SessionLocal() as db:
        rows = (
            db.query(Booking, StudentUser, TeacherUser, Subject)
            .join(StudentUser, Booking.student_id == StudentUser.id)
            .join(TeacherUser, Booking.teacher_id == TeacherUser.id)
            .join(Subject, Booking.subject_id == Subject.id)
            .filter(
                Booking.status == BookingStatus.confirmed,
                Booking.teacher_id.is_not(None),
                Booking.scheduled_at > now,
                Booking.scheduled_at <= due_before,
            )
            .order_by(Booking.scheduled_at.asc())
            .all()
        )

        for booking, student, teacher, subject in rows:
            session = (
                db.query(ClassSession)
                .filter(ClassSession.booking_id == booking.id)
                .first()
            )
            classroom_url = (
                f"{settings.FRONTEND_ORIGIN.rstrip('/')}/classroom/{session.id}"
                if session is not None
                else f"{settings.FRONTEND_ORIGIN.rstrip('/')}/dashboard"
            )
            recipients = [
                ("student", student, teacher.full_name),
                ("teacher", teacher, student.full_name),
            ]

            for recipient_type, recipient, other_name in recipients:
                if not recipient.email:
                    logger.warning(
                        "Skipping %s reminder for booking %s: recipient has no email",
                        recipient_type, booking.id,
                    )
                    continue

                delivery_id = _claim_delivery(
                    db, booking.id, recipient_type, recipient.email
                )
                if delivery_id is None:
                    continue

                email_subject, plain_text, html_body = _render_message(
                    recipient_type=recipient_type,
                    recipient_name=recipient.full_name,
                    other_name=other_name,
                    subject_name=subject.name,
                    scheduled_at=booking.scheduled_at,
                    duration=booking.duration_minutes,
                    classroom_url=classroom_url,
                )
                try:
                    _send_email(recipient.email, email_subject, plain_text, html_body)
                    _finish_delivery(db, delivery_id, sent=True)
                    logger.info(
                        "Sent %s class reminder for booking %s to %s",
                        recipient_type, booking.id, recipient.email,
                    )
                except Exception as exc:
                    db.rollback()
                    _finish_delivery(db, delivery_id, sent=False, error=str(exc))
                    logger.exception(
                        "Failed %s class reminder for booking %s",
                        recipient_type, booking.id,
                    )
