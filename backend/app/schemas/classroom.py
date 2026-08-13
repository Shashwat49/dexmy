import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.classroom import PermissionType, SessionStatus
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.classroom import SessionStatus
from app.models.classroom_content import WhiteboardSnapshot, ClassNotes
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import save_bytes_file, BUCKET
from app.core.dependencies import get_current_user
from app.db.session import get_db
import os

router = APIRouter()

class ClassSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    booking_id: uuid.UUID
    livekit_room_name: str
    status: SessionStatus
    started_at: datetime | None
    ended_at: datetime | None


class JoinTokenRequest(BaseModel):
    session_id: uuid.UUID


class JoinTokenResponse(BaseModel):
    livekit_token: str
    livekit_url: str
    room_name: str


class PermissionUpdate(BaseModel):
    target_user_id: uuid.UUID
    permission: PermissionType
    granted: bool


class ChatMessagePayload(BaseModel):
    """Shape of a chat message as relayed over the classroom WebSocket.
    Never written to the database — chat is ephemeral by design."""

    message_text: str | None = None
    file_url: str | None = None
    file_name: str | None = None
    sender_id: uuid.UUID
    sent_at: datetime


class ClassNotesRead(BaseModel):
    session_id: uuid.UUID
    pdf_url: str | None
    generated_at: datetime | None

@router.post("/sessions/{session_id}/end", response_model=ClassNotesRead)
def end_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, class_session.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the teacher can end the session")

    class_session.status = SessionStatus.ended
    class_session.ended_at = func.now()
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

    image_paths = [
        os.path.join(BUCKET, snap.image_url.split("/")[-1])
        for snap in (latest_by_page[p] for p in sorted(latest_by_page))
        if snap.image_url
    ]

    if not image_paths:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No whiteboard content to compile into notes")

    pdf_bytes = compile_notes_pdf(image_paths)
    pdf_url = save_bytes_file(pdf_bytes, f"notes_{session_id}", "pdf")

    notes = ClassNotes(session_id=session_id, pdf_url=pdf_url)
    db.add(notes)
    db.commit()
    db.refresh(notes)
    return notes
