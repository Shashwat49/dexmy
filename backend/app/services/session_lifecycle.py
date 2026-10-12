import asyncio
import io
import logging
import threading
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession, SessionStatus
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot, ClassroomPage
from app.models.package import PackageCreditLedger, StudentPackage
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import download_bytes, save_bytes_file

logger = logging.getLogger(__name__)
_notes_jobs_lock = threading.Lock()
_notes_jobs: set[str] = set()
_NOTES_RETRY_WINDOW_SECONDS = 5 * 60
_NOTES_RETRY_INTERVAL_SECONDS = 10


def _generate_notes(session_id: uuid.UUID) -> None:
    """Retry notes generation for delayed snapshots and transient storage failures."""
    session_key = str(session_id)
    deadline = time.monotonic() + _NOTES_RETRY_WINDOW_SECONDS
    try:
        # Allow final debounced whiteboard snapshots to flush.
        time.sleep(1.5)
        while True:
            db = SessionLocal()
            try:
                if db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first():
                    logger.info("Class notes already exist for session %s", session_key)
                    return

                pages = db.query(ClassroomPage).filter(
                    ClassroomPage.session_id == session_id
                ).order_by(ClassroomPage.position.asc()).all()
                image_keys = []
                for page in pages:
                    snap = db.query(WhiteboardSnapshot).filter(
                        WhiteboardSnapshot.session_id == session_id,
                        WhiteboardSnapshot.page_id == page.id,
                    ).order_by(WhiteboardSnapshot.created_at.desc()).first()
                    key = snap.image_url if snap and snap.image_url else page.image_url
                    if key and key not in image_keys:
                        image_keys.append(key)

                if image_keys:
                    image_streams = [io.BytesIO(download_bytes(key)) for key in image_keys]
                    pdf_bytes = compile_notes_pdf(image_streams)
                    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
                        raise RuntimeError("PDF renderer returned an invalid PDF")
                    pdf_key = save_bytes_file(pdf_bytes, f"notes_{session_id}", "pdf")
                    db.add(ClassNotes(session_id=session_id, pdf_url=pdf_key))
                    db.commit()
                    logger.info("Generated class notes PDF for session %s (%s pages)", session_key, len(image_keys))
                    return

                logger.warning("No saved whiteboard images yet for session %s; retrying", session_key)
            except Exception:
                db.rollback()
                logger.exception("Class notes generation attempt failed for session %s", session_key)
            finally:
                db.close()

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                logger.error("Class notes generation exhausted its five-minute retry window for session %s", session_key)
                return
            time.sleep(min(_NOTES_RETRY_INTERVAL_SECONDS, remaining))
    finally:
        with _notes_jobs_lock:
            _notes_jobs.discard(session_key)


def queue_notes_generation(session_id: uuid.UUID) -> bool:
    """Queue at most one retryable notes job per session in this backend process."""
    session_key = str(session_id)
    with _notes_jobs_lock:
        if session_key in _notes_jobs:
            return False
        _notes_jobs.add(session_key)
    try:
        asyncio.get_running_loop().create_task(asyncio.to_thread(_generate_notes, session_id))
        return True
    except RuntimeError:
        # Also support calls from synchronous API workers with no event loop.
        thread = threading.Thread(target=_generate_notes, args=(session_id,), daemon=True)
        thread.start()
        return True
    except Exception:
        with _notes_jobs_lock:
            _notes_jobs.discard(session_key)
        logger.exception("Unable to queue class notes generation for session %s", session_key)
        return False


def _queue_notes_generation(session_id: uuid.UUID) -> None:
    queue_notes_generation(session_id)


def mark_student_no_show(session_id: uuid.UUID, db: Session) -> bool:
    """End a class when the student never joined, charging their package once.

    A no-show is not a completed teaching session: do not mark the booking
    completed and do not create teacher class/payout credit.
    """
    # Serialize manual-end, timer-end, and no-show transitions for this session.
    # Concurrent lifecycle requests must not race while updating booking/package counters.
    class_session = db.query(ClassSession).filter(
        ClassSession.id == session_id
    ).with_for_update().first()
    if class_session is None or class_session.status == SessionStatus.ended:
        return False

    booking = db.query(Booking).filter(
        Booking.id == class_session.booking_id
    ).with_for_update().first()
    if booking is None or booking.status in (BookingStatus.cancelled, BookingStatus.no_show):
        class_session.status = SessionStatus.ended
        class_session.ended_at = datetime.now(timezone.utc)
        db.commit()
        return False

    class_session.status = SessionStatus.ended
    class_session.ended_at = datetime.now(timezone.utc)
    booking.status = BookingStatus.no_show

    package = db.get(StudentPackage, booking.student_package_id) if booking.student_package_id else None
    if package is not None:
        already_charged = db.query(PackageCreditLedger).filter(
            PackageCreditLedger.booking_id == booking.id,
            PackageCreditLedger.reason == "student_no_show",
        ).first()
        if not already_charged:
            package.classes_used += 1
            db.add(PackageCreditLedger(
                student_package_id=package.id,
                booking_id=booking.id,
                delta=1,
                reason="student_no_show",
            ))

    db.commit()
    return True


def _record_unlimited_completion_once(booking: Booking, db: Session) -> bool:
    """Increment an unlimited package only once per completed booking."""
    if booking.student_package_id is None:
        return False
    package = db.get(StudentPackage, booking.student_package_id)
    if package is None or not package.is_unlimited:
        return False
    existing = db.query(PackageCreditLedger).filter(
        PackageCreditLedger.booking_id == booking.id,
        PackageCreditLedger.reason == "classroom_completed",
    ).first()
    if existing:
        return False
    package.classes_used += 1
    db.add(PackageCreditLedger(
        student_package_id=package.id,
        booking_id=booking.id,
        delta=1,
        reason="classroom_completed",
    ))
    return True


def end_class_session(session_id: uuid.UUID, db: Session) -> ClassNotes | None:
    # Lock the session row so a teacher click and the automatic timer cannot
    # finalize the same class concurrently or double-apply completion accounting.
    class_session = db.query(ClassSession).filter(
        ClassSession.id == session_id
    ).with_for_update().first()
    if class_session is None:
        return None

    booking = db.query(Booking).filter(
        Booking.id == class_session.booking_id
    ).with_for_update().first()
    if class_session.status == SessionStatus.ended:
        # A previous lifecycle path may have ended the session before booking
        # and package counters were reconciled. Repair those fields idempotently.
        changed = False
        if booking is not None and booking.status not in (BookingStatus.cancelled, BookingStatus.no_show):
            if booking.status != BookingStatus.completed:
                booking.status = BookingStatus.completed
                changed = True
            changed = _record_unlimited_completion_once(booking, db) or changed
        if changed:
            db.commit()
        return db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()

    class_session.status = SessionStatus.ended
    class_session.ended_at = datetime.now(timezone.utc)
    if booking is not None and booking.status not in (BookingStatus.cancelled, BookingStatus.no_show):
        booking.status = BookingStatus.completed
        _record_unlimited_completion_once(booking, db)
    db.commit()
    existing = db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    if existing:
        return existing
    _queue_notes_generation(session_id)
    return None
