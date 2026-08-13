import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.classroom import SessionStatus

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.classroom import ClassSession, PermissionEvent, PermissionType
from app.models.user import User
from app.websockets.connection_manager import manager

from app.models.classroom_content import WhiteboardSnapshot
from app.services.storage_service import save_base64_file

import asyncio
from datetime import datetime, timedelta, timezone

from app.core.constants import CLASS_DURATION_MINUTES
from app.models.classroom import SessionStatus
from app.services.session_lifecycle import end_class_session

router = APIRouter()


def _authenticate(token: str, db: Session) -> User | None:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    return db.get(User, user_id)


@router.websocket("/ws/classroom/{session_id}")
async def classroom_socket(websocket: WebSocket, session_id: uuid.UUID, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = _authenticate(token, db)
        if user is None:
            await websocket.close(code=4401)
            return

        class_session = db.get(ClassSession, session_id)
        if class_session is None:
            await websocket.close(code=4404)
            return
        if class_session.status == SessionStatus.ended:
            await websocket.close(code=4409)
            return

        booking = db.get(Booking, class_session.booking_id)
        is_teacher = user.id == booking.teacher_id
        is_student = user.id == booking.student_id
        if not (is_teacher or is_student):
            await websocket.close(code=4403)
            return

        await websocket.accept()
        room = manager.get_room(session_id)

        if is_teacher:
            room.teacher_ws = websocket
            if class_session.status == SessionStatus.scheduled:
                class_session.status = SessionStatus.live
                class_session.started_at = func.now()
                db.commit()
            if class_session.status == SessionStatus.scheduled:
                class_session.status = SessionStatus.live
                class_session.started_at = func.now()
                db.commit()

                room.deadline = datetime.now(timezone.utc) + timedelta(minutes=CLASS_DURATION_MINUTES)
                room.timer_task = asyncio.create_task(session_timer(session_id))
            # Admit anyone who was waiting
            if room.pending_student:
                room.student_ws = room.pending_student
                room.pending_student = None
                await room.student_ws.send_json({"type": "admitted"})
        else:
            # Student only gets in once the teacher is present and admits them
            if room.teacher_ws is None:
                room.pending_student = websocket
                await websocket.send_json({"type": "waiting_for_teacher"})
            else:
                room.student_ws = websocket
                await room.teacher_ws.send_json({"type": "student_joined", "user_id": str(user.id)})

        try:
            while True:
                data = await websocket.receive_json()
                await _handle_message(data, user, is_teacher, session_id, room, db)
        except WebSocketDisconnect:
            pass
        finally:
            if room.teacher_ws is websocket:
                room.teacher_ws = None
            if room.student_ws is websocket:
                room.student_ws = None
            if room.pending_student is websocket:
                room.pending_student = None
            manager.drop_room_if_empty(session_id)
    finally:
        db.close()


async def _handle_message(data: dict, user: User, is_teacher: bool, session_id: uuid.UUID, room, db: Session, websocket: WebSocket):
    msg_type = data.get("type")
    peer = room.student_ws if is_teacher else room.teacher_ws

    if msg_type == "chat":
        # Ephemeral — relayed only, never written to the DB
        if peer:
            await peer.send_json({
                "type": "chat",
                "sender_id": str(user.id),
                "message_text": data.get("message_text"),
                "file_url": data.get("file_url"),
                "file_name": data.get("file_name"),
            })

    elif msg_type == "whiteboard_event":
        # Draw/erase/undo/redo/pdf-upload events — broadcast to the other
        # participant so canvases stay in sync. Periodic snapshot persistence
        # happens via a separate "save_snapshot" message, not every stroke.
        if peer:
            await peer.send_json({"type": "whiteboard_event", "payload": data.get("payload")})

    elif msg_type == "permission_update" and is_teacher:
        target_user_id = uuid.UUID(data["target_user_id"])
        permission = PermissionType(data["permission"])
        granted = bool(data["granted"])

        db.add(PermissionEvent(
            session_id=session_id,
            target_user_id=target_user_id,
            permission=permission,
            granted=granted,
            granted_by=user.id,
        ))
        db.commit()

        key = str(target_user_id)
        room.permissions.setdefault(key, set())
        if granted:
            room.permissions[key].add(permission.value)
        else:
            room.permissions[key].discard(permission.value)

        if peer:
            await peer.send_json({
                "type": "permission_update",
                "permission": permission.value,
                "granted": granted,
            })

    elif msg_type == "toggle_av":
        # mic/camera self-toggle — relay only, LiveKit handles the actual
        # media mute; this just tells the peer's UI to update its indicator
        if peer:
            await peer.send_json({"type": "toggle_av", "user_id": str(user.id), "kind": data.get("kind"), "enabled": data.get("enabled")})
    
    elif msg_type == "save_snapshot":
        image_url = None
        if data.get("image_base64"):
            image_url = save_base64_file(
                data["image_base64"], f"wb_{session_id}_p{data.get('page_number', 1)}", "png"
            )

        db.add(WhiteboardSnapshot(
            session_id=session_id,
            snapshot_data=data.get("canvas_json", {}),
            image_url=image_url,
            page_number=data.get("page_number", 1),
        ))
        db.commit()
        await websocket.send_json({"type": "snapshot_saved", "page_number": data.get("page_number", 1)})
    elif msg_type == "extend_class" and is_teacher:
        if room.extended:
            await websocket.send_json({"type": "extend_denied", "reason": "Already extended once"})
        else:
            room.extended = True
            room.deadline = room.deadline + timedelta(minutes=5)
            payload_out = {"type": "class_extended", "new_deadline": room.deadline.isoformat()}
            if room.teacher_ws:
                await room.teacher_ws.send_json(payload_out)
            if room.student_ws:
                await room.student_ws.send_json(payload_out)
async def session_timer(session_id: uuid.UUID):
    while True:
        await asyncio.sleep(5)
        room = manager.rooms.get(session_id)
        if room is None or room.deadline is None:
            return

        db = SessionLocal()
        try:
            class_session = db.get(ClassSession, session_id)
            if class_session is None or class_session.status == SessionStatus.ended:
                return  # already ended manually via the REST endpoint
        finally:
            db.close()

        remaining = (room.deadline - datetime.now(timezone.utc)).total_seconds()

        if not room.warned and remaining <= 120:
            room.warned = True
            if room.teacher_ws:
                await room.teacher_ws.send_json({"type": "extend_prompt", "seconds_remaining": int(remaining)})

        if remaining <= 0:
            await _auto_end_session(session_id, room)
            return

async def _auto_end_session(session_id: uuid.UUID, room):
    db = SessionLocal()
    try:
        end_class_session(session_id, db)
    finally:
        db.close()

    payload_out = {"type": "session_ended", "reason": "time_up"}
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(payload_out)
            except Exception:
                pass
    manager.rooms.pop(session_id, None)