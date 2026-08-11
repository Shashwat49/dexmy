from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.classroom import ClassSession
from app.models.user import User
from app.schemas.classroom import JoinTokenRequest, JoinTokenResponse, ClassSessionRead
from app.services.livekit_service import create_join_token

import io
from app.services.storage_service import save_bytes_file, download_bytes, get_presigned_url

import uuid
from sqlalchemy import func
from app.models.classroom import SessionStatus
from app.models.classroom_content import WhiteboardSnapshot, ClassNotes
from app.schemas.classroom import ClassNotesRead
from app.services.notes_service import compile_notes_pdf
from app.services.storage_service import save_bytes_file, BUCKET
import os

from fastapi import File, UploadFile

from app.services.session_lifecycle import end_class_session
from app.services.pdf_render_service import render_pdf_to_images
from app.websockets.connection_manager import manager
from pydantic import BaseModel

router = APIRouter()

class FileUploadResponse(BaseModel):
    file_url: str
    file_name: str

@router.post("/join-token", response_model=JoinTokenResponse)
def get_join_token(
    payload: JoinTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.get(ClassSession, payload.session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, session.booking_id)

    is_teacher = current_user.id == booking.teacher_id
    is_student = current_user.id == booking.student_id
    if not (is_teacher or is_student):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not part of this classroom")

    # Teacher can always publish camera/mic. Student's camera/mic is allowed
    # by default too (both toggle their own audio/video per the spec) — but
    # screen-share/annotate specifically are gated inside the classroom
    # WebSocket via permission_events, not here.
    token = create_join_token(
        room_name=session.livekit_room_name,
        identity=str(current_user.id),
        name=current_user.full_name,
        can_publish=True,
    )

    return JoinTokenResponse(
        livekit_token=token,
        livekit_url=settings.LIVEKIT_URL,
        room_name=session.livekit_room_name,
    )

@router.post("/sessions/{session_id}/end", response_model=ClassNotesRead)
async def end_session(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, class_session.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the teacher can end the session")

    notes = end_class_session(session_id, db)

    room = manager.rooms.pop(session_id, None)
    if room:
        for ws in (room.teacher_ws, room.student_ws):
            if ws:
                try:
                    await ws.send_json({"type": "session_ended", "reason": "teacher_ended"})
                except Exception:
                    pass

    if notes is None:
        return ClassNotesRead(session_id=session_id, pdf_url=None, generated_at=None)

    return ClassNotesRead(
        session_id=notes.session_id,
        pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600),
        generated_at=notes.generated_at,
    )

@router.get("/sessions/{session_id}/notes", response_model=ClassNotesRead)
def get_notes(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, class_session.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this classroom")

    notes = db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    if notes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notes not generated yet")

    return ClassNotesRead(
        session_id=notes.session_id,
        pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600),
        generated_at=notes.generated_at,
    )

@router.post("/sessions/{session_id}/chat-file", response_model=FileUploadResponse)
async def upload_chat_file(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, class_session.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this classroom")

    MAX_SIZE = 20 * 1024 * 1024  # 20 MB cap on chat attachments
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (20MB max)")

    extension = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin"
    key = save_bytes_file(contents, f"chat_{session_id}", extension)

    return FileUploadResponse(
        file_url=get_presigned_url(key, expires_in=86400),
        file_name=file.filename,
    )


@router.post("/sessions/{session_id}/whiteboard-pdf", response_model=list[FileUploadResponse])
async def upload_whiteboard_pdf(
    session_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    booking = db.get(Booking, class_session.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the teacher can upload annotation PDFs")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be a PDF")

    MAX_SIZE = 30 * 1024 * 1024  # 30MB
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="PDF too large (30MB max)")

    try:
        page_images = render_pdf_to_images(contents)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read PDF")

    if len(page_images) > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF too long (50 pages max)")

    pages = []
    for i, img_bytes in enumerate(page_images, start=1):
        key = save_bytes_file(img_bytes, f"annotate_{session_id}_p{i}", "png")
        pages.append(FileUploadResponse(file_url=get_presigned_url(key, expires_in=86400), file_name=f"page_{i}.png"))

    # Push to the other participant live, if they're already connected
    room = manager.get_room(session_id)
    peer = room.student_ws  # only the teacher can call this endpoint, so peer is always the student
    if peer:
        await peer.send_json({
            "type": "pdf_pages_ready",
            "pages": [{"page_number": i, "image_url": p.file_url} for i, p in enumerate(pages, start=1)],
        })

    return pages

@router.get("/sessions/{session_id}", response_model=ClassSessionRead)
def get_session_status(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    class_session = db.get(ClassSession, session_id)
    if class_session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    booking = db.get(Booking, class_session.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not part of this classroom")
    return class_session