import asyncio
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.classroom import ClassSession, PermissionEvent, PermissionType
from app.models.user import User
from app.models.teacher import Subject
from app.schemas.classroom import JoinTokenRequest, JoinTokenResponse, ClassSessionRead, ClassNotesRead
from app.services.livekit_service import create_join_token
from app.models.classroom_content import ClassNotes, WhiteboardSnapshot, ClassroomPage
from app.services.storage_service import save_bytes_file, get_presigned_url, delete_file
from app.services.session_lifecycle import end_class_session
from app.services.pdf_render_service import render_pdf_to_images
from app.websockets.connection_manager import manager
from pydantic import BaseModel
from sqlalchemy import desc

router = APIRouter()

class FileUploadResponse(BaseModel):
    file_url: str
    file_name: str

class WhiteboardPageResponse(BaseModel):
    page_id: str
    page_number: int
    page_type: str
    image_url: str | None = None

class WhiteboardPdfUploadResponse(BaseModel):
    pages: list[WhiteboardPageResponse]
    inserted_count: int
    inserted_page_ids: list[str]

def _student_publish_sources(session_id: uuid.UUID, student_id: uuid.UUID, db: Session) -> list[str]:
    sources = {"camera", "microphone", "screen_share"}
    events = (db.query(PermissionEvent).filter(PermissionEvent.session_id == session_id, PermissionEvent.target_user_id == student_id).order_by(desc(PermissionEvent.created_at)).all())
    latest = {}
    for event in events:
        if event.permission not in latest:
            latest[event.permission] = event.granted
    mapping = {PermissionType.camera: "camera", PermissionType.mic: "microphone", PermissionType.screen_share: "screen_share"}
    for permission, granted in latest.items():
        source = mapping.get(permission)
        if source:
            if granted: sources.add(source)
            else: sources.discard(source)
    return sorted(sources)

@router.post("/join-token", response_model=JoinTokenResponse)
def get_join_token(payload: JoinTokenRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.get(ClassSession, payload.session_id)
    if session is None: raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, session.booking_id)
    if booking is None: raise HTTPException(status_code=404, detail="Booking not found")
    is_teacher = current_user.id == booking.teacher_id
    is_student = current_user.id == booking.student_id
    if not (is_teacher or is_student): raise HTTPException(status_code=403, detail="You are not part of this classroom")
    sources = None if is_teacher else _student_publish_sources(payload.session_id, current_user.id, db)
    token = create_join_token(room_name=session.livekit_room_name, identity=str(current_user.id), name=current_user.full_name, can_publish=is_teacher or bool(sources), publish_sources=sources)
    return JoinTokenResponse(livekit_token=token, livekit_url=settings.LIVEKIT_URL, room_name=session.livekit_room_name)

@router.post("/sessions/{session_id}/end", response_model=ClassNotesRead)
async def end_session(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None: raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id: raise HTTPException(status_code=403, detail="Only the teacher can end the session")
    notes = end_class_session(session_id, db)
    room = manager.rooms.pop(session_id, None)
    if room:
        for ws in (room.teacher_ws, room.student_ws):
            if ws:
                try: await ws.send_json({"type": "session_ended", "reason": "teacher_ended"})
                except Exception: pass
    if notes is None: return ClassNotesRead(session_id=session_id, pdf_url=None, generated_at=None)
    return ClassNotesRead(session_id=notes.session_id, pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600), generated_at=notes.generated_at)

@router.get("/sessions/{session_id}/notes", response_model=ClassNotesRead)
def get_notes(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None: raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id): raise HTTPException(status_code=403, detail="Not part of this classroom")
    notes = db.query(ClassNotes).filter(ClassNotes.session_id == session_id).first()
    if notes is None: raise HTTPException(status_code=404, detail="Notes not generated yet")
    return ClassNotesRead(session_id=notes.session_id, pdf_url=get_presigned_url(notes.pdf_url, expires_in=3600), generated_at=notes.generated_at)

@router.post("/sessions/{session_id}/chat-file", response_model=FileUploadResponse)
async def upload_chat_file(session_id: uuid.UUID, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None: raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id): raise HTTPException(status_code=403, detail="Not part of this classroom")
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024: raise HTTPException(status_code=413, detail="File too large (20MB max)")
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    key = save_bytes_file(contents, f"chat_{session_id}", ext)
    return FileUploadResponse(file_url=get_presigned_url(key, expires_in=86400), file_name=file.filename)

def _page_payload(pages, db):
    payload = []
    pdf_page_ids = [page.id for page in pages if page.page_type == "pdf"]
    original_images = {}
    if pdf_page_ids:
        # Fetch original PDF images in one query instead of one query per slide.
        snapshots = db.query(WhiteboardSnapshot).filter(
            WhiteboardSnapshot.page_id.in_(pdf_page_ids),
            WhiteboardSnapshot.image_url.isnot(None),
        ).order_by(WhiteboardSnapshot.created_at.asc()).all()
        for snapshot in snapshots:
            original_images.setdefault(snapshot.page_id, snapshot.image_url)

    for index, page in enumerate(pages, 1):
        image_key = page.image_url
        # Preserve the original PDF image if a canvas snapshot was saved later.
        if page.page_type == "pdf":
            image_key = original_images.get(page.id) or image_key
        payload.append({
            "page_id": str(page.id),
            "page_number": index,
            "page_type": page.page_type,
            "image_url": get_presigned_url(image_key, expires_in=86400) if image_key else None,
        })
    return payload


def _reorder_pages_without_unique_conflicts(pages):
    # Move every existing row out of the positive position range before assigning
    # the final contiguous order; this avoids transient UNIQUE(session_id, position) collisions.
    for index, page in enumerate(pages, 1):
        page.position = -index
    return pages


async def _notify_page_change(session_id, payload):
    room = manager.get_room(session_id)
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                pass


@router.post("/sessions/{session_id}/whiteboard-pdf", response_model=WhiteboardPdfUploadResponse)
async def upload_whiteboard_pdf(session_id: uuid.UUID, file: UploadFile = File(...), after_page_id: str | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can upload annotation PDFs")
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = await file.read()
    if len(contents) > 30 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large (30MB max)")
    try:
        # Render outside the event loop and reject oversized page counts before
        # rasterizing every page.
        pages_raw = await asyncio.to_thread(render_pdf_to_images, contents)
    except ValueError as exc:
        if "PDF too long" in str(exc):
            raise HTTPException(status_code=400, detail="PDF too long (50 pages max)")
        raise HTTPException(status_code=400, detail="Could not read PDF")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF")

    existing_pages = db.query(ClassroomPage).filter(ClassroomPage.session_id == session_id).order_by(ClassroomPage.position.asc()).all()
    after_index = len(existing_pages) - 1
    if after_page_id:
        try:
            target_id = uuid.UUID(after_page_id)
            after_index = next((i for i, page in enumerate(existing_pages) if page.id == target_id), after_index)
        except (ValueError, TypeError):
            pass
    insert_at = max(0, after_index + 1)

    # JPEG at moderate resolution greatly reduces rendering and upload time and
    # storage/network payload size while remaining legible on the 1600x900 board.
    semaphore = asyncio.Semaphore(5)
    async def store_page(index, image_bytes):
        async with semaphore:
            key = await asyncio.to_thread(save_bytes_file, image_bytes, f"annotate_{session_id}_p{index}", "jpg")
            return index, key
    stored = await asyncio.gather(*(store_page(i, image) for i, image in enumerate(pages_raw, 1)))

    _reorder_pages_without_unique_conflicts(existing_pages)
    db.flush()
    inserted = []
    for offset, (original_index, key) in enumerate(stored):
        page = ClassroomPage(session_id=session_id, position=-(len(existing_pages) + offset + 1), page_type="pdf", image_url=key)
        db.add(page)
        db.flush()
        inserted.append(page)
    ordered = existing_pages[:insert_at] + inserted + existing_pages[insert_at:]
    for position, page in enumerate(ordered, 1):
        page.position = position
    db.flush()
    for position, page in enumerate(ordered, 1):
        if page in inserted:
            db.add(WhiteboardSnapshot(session_id=session_id, snapshot_data={"strokes": []}, image_url=page.image_url, page_number=position, page_id=page.id))
    db.commit()

    payload_pages = _page_payload(ordered, db)
    inserted_ids = [str(page.id) for page in inserted]
    inserted_first_index = next((i for i, page in enumerate(ordered, 1) if str(page.id) in inserted_ids), insert_at + 1)
    await _notify_page_change(session_id, {
        "type": "pdf_pages_ready",
        "pages": payload_pages,
        "inserted_page_ids": inserted_ids,
        "page_number": inserted_first_index,
        "page_id": inserted_ids[0] if inserted_ids else None,
    })
    return WhiteboardPdfUploadResponse(pages=[WhiteboardPageResponse(**page) for page in payload_pages], inserted_count=len(inserted), inserted_page_ids=inserted_ids)


@router.post("/sessions/{session_id}/whiteboard-pages")
async def create_whiteboard_page(session_id: uuid.UUID, after_page_id: str | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can add slides")

    pages = db.query(ClassroomPage).filter(ClassroomPage.session_id == session_id).order_by(ClassroomPage.position.asc()).all()
    after_index = len(pages) - 1
    if after_page_id:
        try:
            target_id = uuid.UUID(after_page_id)
            after_index = next((i for i, page in enumerate(pages) if page.id == target_id), after_index)
        except (ValueError, TypeError):
            pass
    insert_at = max(0, after_index + 1)
    _reorder_pages_without_unique_conflicts(pages)
    db.flush()
    page = ClassroomPage(session_id=session_id, position=-(len(pages) + 1), page_type="whiteboard")
    db.add(page)
    db.flush()
    ordered = pages[:insert_at] + [page] + pages[insert_at:]
    for position, item in enumerate(ordered, 1):
        item.position = position
    db.add(WhiteboardSnapshot(session_id=session_id, snapshot_data={"strokes": []}, image_url=None, page_number=insert_at + 1, page_id=page.id))
    db.commit()
    payload_pages = _page_payload(ordered, db)
    payload = {"type": "whiteboard_pages_updated", "pages": payload_pages, "page_number": insert_at + 1, "page_id": str(page.id)}
    await _notify_page_change(session_id, payload)
    return {"pages": payload_pages, "page_id": str(page.id), "page_number": insert_at + 1}


@router.delete("/sessions/{session_id}/whiteboard-pages/{page_id}")
async def delete_whiteboard_page(session_id: uuid.UUID, page_id: uuid.UUID, background_tasks: BackgroundTasks, active_page_id: str | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None:
        raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id != booking.teacher_id:
        raise HTTPException(status_code=403, detail="Only the teacher can delete slides")

    pages = db.query(ClassroomPage).filter(ClassroomPage.session_id == session_id).order_by(ClassroomPage.position.asc()).all()
    target = next((page for page in pages if page.id == page_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Slide not found")
    if len(pages) <= 1:
        raise HTTPException(status_code=409, detail="A classroom must keep at least one slide")

    target_index = pages.index(target)
    snapshots = db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id == session_id, WhiteboardSnapshot.page_id == target.id).all()
    object_keys = {key for key in [target.image_url, *(snapshot.image_url for snapshot in snapshots)] if key}
    active_id = None
    try:
        active_id = uuid.UUID(active_page_id) if active_page_id else None
    except (ValueError, TypeError):
        pass
    remaining = [page for page in pages if page.id != target.id]
    active_page = next((page for page in remaining if page.id == active_id), None)
    if active_page is None:
        active_page = remaining[min(target_index, len(remaining) - 1)]

    db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.page_id == target.id).delete(synchronize_session=False)
    db.delete(target)
    db.flush()
    _reorder_pages_without_unique_conflicts(remaining)
    db.flush()
    for position, page in enumerate(remaining, 1):
        page.position = position
    db.commit()

    # Return the updated slide list immediately; object-storage cleanup runs
    # after the response so deleting a slide does not wait on network I/O.
    for key in object_keys:
        background_tasks.add_task(delete_file, key)
    payload_pages = _page_payload(remaining, db)
    active_position = next(i for i, page in enumerate(remaining, 1) if page.id == active_page.id)
    payload = {"type": "whiteboard_pages_updated", "pages": payload_pages, "page_number": active_position, "page_id": str(active_page.id), "deleted_page_id": str(target.id)}
    await _notify_page_change(session_id, payload)
    return {"pages": payload_pages, "page_number": active_position, "page_id": str(active_page.id), "deleted_page_id": str(target.id)}

@router.get("/sessions/{session_id}", response_model=None)
def get_session_status(session_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cs = db.get(ClassSession, session_id)
    if cs is None: raise HTTPException(status_code=404, detail="Session not found")
    booking = db.get(Booking, cs.booking_id)
    if current_user.id not in (booking.teacher_id, booking.student_id): raise HTTPException(status_code=403, detail="Not part of this classroom")
    subject = db.get(Subject, booking.subject_id)
    return {"id": cs.id, "booking_id": cs.booking_id, "livekit_room_name": cs.livekit_room_name, "status": cs.status, "started_at": cs.started_at, "ended_at": cs.ended_at, "subject_name": subject.name if subject else "Class"}
