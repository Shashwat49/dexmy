from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.classroom import ClassSession, PermissionEvent, PermissionType
from app.models.user import User
from app.schemas.classroom import JoinTokenRequest, JoinTokenResponse, ClassSessionRead, ClassNotesRead
from app.services.livekit_service import create_join_token
import uuid
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot
from app.services.storage_service import save_bytes_file, get_presigned_url
from app.services.session_lifecycle import end_class_session
from app.services.pdf_render_service import render_pdf_to_images
from app.websockets.connection_manager import manager
from pydantic import BaseModel
from sqlalchemy import desc

router = APIRouter()

class FileUploadResponse(BaseModel):
    file_url: str
    file_name: str

def _student_publish_sources(session_id: uuid.UUID, student_id: uuid.UUID, db: Session) -> list[str]:
    """Return the student's currently granted LiveKit publish sources.

    Camera and microphone are the classroom baseline. Any persisted teacher
    permission decisions override those defaults; this keeps a newly issued
    LiveKit token aligned with the classroom WebSocket permission state.
    """
    sources = {"camera", "microphone"}
    events = (
        db.query(PermissionEvent)
        .filter(PermissionEvent.session_id == session_id, PermissionEvent.target_user_id == student_id)
        .order_by(desc(PermissionEvent.created_at))
        .all()
    )
    latest = {}
    for event in events:
        if event.permission not in latest:
            latest[event.permission] = event.granted
    mapping = {
        PermissionType.camera: "camera",
        PermissionType.mic: "microphone",
        PermissionType.screen_share: "screen_share",
    }
    for permission, granted in latest.items():
        source = mapping.get(permission)
        if source:
            if granted:
                sources.add(source)
            else:
                sources.discard(source)
    return sorted(sources)

@router.post("/join-token", response_model=JoinTokenResponse)
def get_join_token(payload: JoinTokenRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ClassSession, payload.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, session.booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Booking not found")
    is_teacher = current_user.id == booking.teacher_id
    is_student = current_user.id == booking.student_id
    if not (is_teacher or is_student):
        raise HTTPException(status_code=403, detail="You are not part of this classroom")
    sources = None if is_teacher else _student_publish_sources(payload.session_id, current_user.id, db)
    token = create_join_token(room_name=session.livekit_room_name, identity=str(current_user.id), name=current_user.full_name, can_publish=is_teacher or bool(sources), publish_sources=sources)
    return JoinTokenResponse(livekit_token=token, livekit_url=settings.LIVEKIT_URL, room_name=session.livekit_room_name)

@router.post("/sessions/{session_id}/end", response_model=ClassNotesRead)
async def end_session(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can end the session")
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
    return ClassNotesRead(session_id=notes.session_id, pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600), generated_at=notes.generated_at)

@router.get("/sessions/{session_id}/notes", response_model=ClassNotesRead)
def get_notes(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=403, detail="Not part of this classroom")
    notes = db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    if notes is None:
        raise HTTPException(status_code=404, detail="Notes not generated yet")
    return ClassNotesRead(session_id=notes.session_id, pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600), generated_at=notes.generated_at)

@router.post("/sessions/{session_id}/chat-file", response_model=FileUploadResponse)
async def upload_chat_file(session_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=403, detail="Not part of this classroom")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (20MB max)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    key = save_bytes_file(contents, f"chat_{session_id}", ext)
    return FileUploadResponse(file_url=get_presigned_url(key, expires_in=86400), file_name=file.filename)

@router.post("/sessions/{session_id}/whiteboard-pdf", response_model=list[FileUploadResponse])
async def upload_whiteboard_pdf(session_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can upload annotation PDFs")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    contents = await file.read()
    if len(contents) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large (30MB max)")
    try:
        pages_raw = render_pdf_to_images(contents)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")
    if len(pages_raw) > 50:
        raise HTTPException(status_code=400, detail="PDF too long (50 pages max)")
    pages = []
    stored_pages = []
    for i, img in enumerate(pages_raw, 1):
        key = save_bytes_file(img, f"annotate_{session_id}_p{i}", "png")
        stored_pages.append((i, key))
        pages.append(FileUploadResponse(file_url=get_presigned_url(key, expires_in=86400), file_name=f"page_{i}.png"))
    for i, key in stored_pages:
        db.add(WhiteboardSnapshot(session_id=session_id, snapshot_data={"strokes": []}, image_url=key, page_number=i))
    db.commit()
    payload = {"type": "pdf_pages_ready", "pages": [{"page_number": i, "image_url": get_presigned_url(key, expires_in=86400)} for i, key in stored_pages]}
    room = manager.get_room(session_id)
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                pass
    return pages

@router.get("/sessions/{session_id}", response_model=ClassSessionRead)
def get_session_status(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id):
        raise HTTPException(status_code=403, detail="Not part of this classroom")
    return cs
