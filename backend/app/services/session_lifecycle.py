import asyncio
import io
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession, SessionStatus
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot, ClassroomPage
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import download_bytes, save_bytes_file


def _generate_notes(session_id: uuid.UUID) -> None:
    # Give the browser a short window to flush its final debounced whiteboard
    # snapshot after the teacher presses "End class". This avoids generating a
    # PDF one stroke behind the final classroom state.
    time.sleep(1.5)
    db = SessionLocal()
    try:
        if db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first():
            return

        image_keys=[]
        for _ in range(5):
            pages=db.query(ClassroomPage).filter(ClassroomPage.session_id==session_id).order_by(ClassroomPage.position.asc()).all()
            image_keys=[]
            for page in pages:
                snap=db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id==session_id,WhiteboardSnapshot.page_id==page.id).order_by(WhiteboardSnapshot.created_at.desc()).first()
                key=snap.image_url if snap and snap.image_url else page.image_url
                if key: image_keys.append(key)
            if image_keys: break
            time.sleep(0.5)

        if not image_keys:
            return

        image_streams = [io.BytesIO(download_bytes(key)) for key in image_keys]
        pdf_bytes = compile_notes_pdf(image_streams)
        pdf_key = save_bytes_file(pdf_bytes, f"notes_{session_id}", "pdf")
        db.add(ClassNotes(session_id=session_id, pdf_url=pdf_key))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _queue_notes_generation(session_id: uuid.UUID) -> None:
    try:
        asyncio.get_running_loop().create_task(asyncio.to_thread(_generate_notes, session_id))
    except RuntimeError:
        pass


def end_class_session(session_id: uuid.UUID, db: Session) -> ClassNotes | None:
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        return None
    if class_session.status == SessionStatus.ended:
        return db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    class_session.status = SessionStatus.ended
    class_session.ended_at = datetime.now(timezone.utc)
    booking = db.get(Booking, class_session.booking_id)
    if booking is not None and booking.status != BookingStatus.cancelled:
        booking.status = BookingStatus.completed
    db.commit()
    existing = db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    if existing:
        return existing
    _queue_notes_generation(session_id)
    return None
