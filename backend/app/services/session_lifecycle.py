import io
import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession, SessionStatus
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import download_bytes, save_bytes_file

def _generate_notes(session_id: uuid.UUID) -> ClassNotes | None:
    db=SessionLocal()
    try:
        existing=db.query(ClassNotes).filter(ClassNotes.session_id==session_id).first()
        if existing:return existing
        snapshots=db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id==session_id).order_by(WhiteboardSnapshot.page_number,WhiteboardSnapshot.created_at.desc()).all()
        latest={}
        for s in snapshots: latest.setdefault(s.page_number,s)
        keys=[latest[p].image_url for p in sorted(latest) if latest[p].image_url]
        if not keys:return None
        pdf=compile_notes_pdf([io.BytesIO(download_bytes(k)) for k in keys])
        key=save_bytes_file(pdf,f"notes_{session_id}","pdf")
        notes=ClassNotes(session_id=session_id,pdf_url=key);db.add(notes);db.commit();db.refresh(notes);return notes
    except Exception:
        db.rollback();return None
    finally: db.close()

def end_class_session(session_id: uuid.UUID, db: Session) -> ClassNotes | None:
    cs=db.get(ClassSession,session_id)
    if cs is None:return None
    if cs.status==SessionStatus.ended:return db.query(ClassNotes).filter(ClassNotes.session_id==session_id).first() or _generate_notes(session_id)
    cs.status=SessionStatus.ended;cs.ended_at=datetime.now(timezone.utc)
    booking=db.get(Booking,cs.booking_id)
    if booking is not None and booking.status!=BookingStatus.cancelled:booking.status=BookingStatus.completed
    db.commit()
    return db.query(ClassNotes).filter(ClassNotes.session_id==session_id).first() or _generate_notes(session_id)
