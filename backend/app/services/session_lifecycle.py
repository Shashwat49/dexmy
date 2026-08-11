import io
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.classroom import ClassSession, SessionStatus
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import download_bytes, save_bytes_file


def end_class_session(session_id: uuid.UUID, db: Session) -> ClassNotes | None:
    """Marks the session ended and best-effort compiles whatever whiteboard
    content exists into a notes PDF. The session always ends regardless of
    whether there's anything to compile — returns None (not an error) when
    there's no whiteboard content yet."""
    class_session = db.get(ClassSession, session_id)
    if class_session is None or class_session.status == SessionStatus.ended:
        return None

    class_session.status = SessionStatus.ended
    class_session.ended_at = datetime.now(timezone.utc)
    db.commit()

    snapshots = (
        db.query(WhiteboardSnapshot)
        .filter(WhiteboardSnapshot.session_id == session_id)
        .order_by(WhiteboardSnapshot.page_number, WhiteboardSnapshot.created_at.desc())
        .all()
    )
    latest_by_page = {}
    for snap in snapshots:
        latest_by_page.setdefault(snap.page_number, snap)

    image_keys = [latest_by_page[p].image_url for p in sorted(latest_by_page) if latest_by_page[p].image_url]
    if not image_keys:
        return None

    image_streams = [io.BytesIO(download_bytes(key)) for key in image_keys]
    pdf_bytes = compile_notes_pdf(image_streams)
    pdf_key = save_bytes_file(pdf_bytes, f"notes_{session_id}", "pdf")

    notes = ClassNotes(session_id=session_id, pdf_url=pdf_key)
    db.add(notes)
    db.commit()
    db.refresh(notes)
    return notes