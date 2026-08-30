import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import desc, func
from livekit import api

from app.core.config import settings
from app.core.constants import CLASS_DURATION_MINUTES
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.classroom import ClassSession, PermissionEvent, PermissionType, SessionStatus
from app.models.classroom_content import WhiteboardSnapshot
from app.models.user import User
from app.services.session_lifecycle import end_class_session
from app.services.storage_service import save_base64_file, get_presigned_url
from app.websockets.connection_manager import manager

router = APIRouter()


def _authenticate(token: str, db) -> User | None:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError, TypeError):
        return None
    return db.get(User, user_id)


def _default_student_permissions() -> set[str]:
    return {"mic", "camera"}


def _allowed_sources(room, user_id: uuid.UUID) -> list[str]:
    permissions = room.permissions.get(str(user_id), set())
    sources = []
    if "camera" in permissions:
        sources.append("camera")
    if "mic" in permissions:
        sources.append("microphone")
    if "screen_share" in permissions:
        sources.append("screen_share")
    return sources


def _permission_payload(room, user_id: uuid.UUID) -> dict[str, bool]:
    permissions = room.permissions.get(str(user_id), set())
    return {
        "mic": "mic" in permissions,
        "camera": "camera" in permissions,
        "annotate": "annotate" in permissions,
        "screen_share": "screen_share" in permissions,
    }


async def _sync_livekit_permissions(class_session: ClassSession, user_id: uuid.UUID, room) -> None:
    """Synchronize only media permissions with the already-connected LiveKit participant.

    Annotation is an application-level classroom permission and must never call
    LiveKit. The participant is explicitly checked before UpdateParticipant so
    a WebSocket-presence race cannot make the teacher's permission control fail.
    """
    sources = _allowed_sources(room, user_id)
    last_error = None

    for attempt in range(10):
        lkapi = api.LiveKitAPI(
            settings.LIVEKIT_URL,
            settings.LIVEKIT_API_KEY,
            settings.LIVEKIT_API_SECRET,
        )
        try:
            try:
                await lkapi.room.get_participant(
                    api.RoomParticipantIdentity(
                        room=class_session.livekit_room_name,
                        identity=str(user_id),
                    )
                )
            except Exception as exc:
                last_error = exc
                if attempt < 9:
                    await asyncio.sleep(0.35)
                    continue
                raise

            await lkapi.room.update_participant(
                api.UpdateParticipantRequest(
                    room=class_session.livekit_room_name,
                    identity=str(user_id),
                    permission=api.ParticipantPermission(
                        can_subscribe=True,
                        can_publish=bool(sources),
                        can_publish_data=True,
                        can_publish_sources=sources,
                    ),
                )
            )
            return
        except Exception as exc:
            last_error = exc
            if attempt < 9:
                await asyncio.sleep(0.35)
        finally:
            await lkapi.aclose()

    raise last_error or RuntimeError("LiveKit permission synchronization failed")


def _restore_student_permissions(session_id: uuid.UUID, student_id: uuid.UUID, db) -> set[str]:
    permissions = _default_student_permissions()
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
    for permission, granted in latest.items():
        if granted:
            permissions.add(permission.value)
        else:
            permissions.discard(permission.value)
    return permissions


async def _send_latest_whiteboard(session_id: uuid.UUID, websocket: WebSocket, db) -> None:
    snapshots = (
        db.query(WhiteboardSnapshot)
        .filter(WhiteboardSnapshot.session_id == session_id)
        .order_by(WhiteboardSnapshot.page_number.asc(), WhiteboardSnapshot.created_at.desc())
        .all()
    )
    latest_by_page = {}
    for snapshot in snapshots:
        latest_by_page.setdefault(snapshot.page_number, snapshot)
    if not latest_by_page:
        return
    pages = [
        {"page_number": n, "image_url": get_presigned_url(s.image_url, expires_in=3600)}
        for n, s in sorted(latest_by_page.items())
        if s.image_url
    ]
    current_page = max(latest_by_page)
    snapshot = latest_by_page[current_page]
    await websocket.send_json({
        "type": "whiteboard_state",
        "page_number": current_page,
        "canvas_json": snapshot.snapshot_data or {},
        "image_url": get_presigned_url(snapshot.image_url, expires_in=3600) if snapshot.image_url else None,
        "pages": pages,
    })


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
        if class_session.status in (SessionStatus.ended, SessionStatus.cancelled):
            await websocket.close(code=4409)
            return
        booking = db.get(Booking, class_session.booking_id)
        if booking is None:
            await websocket.close(code=4404)
            return
        is_teacher = user.id == booking.teacher_id
        is_student = user.id == booking.student_id
        if not (is_teacher or is_student):
            await websocket.close(code=4403)
            return

        await websocket.accept()
        room = manager.get_room(session_id)

        if is_teacher:
            room.teacher_ws = websocket
            room.permissions[str(user.id)] = {"annotate", "screen_share", "mic", "camera"}
            if class_session.status == SessionStatus.scheduled:
                class_session.status = SessionStatus.live
                class_session.started_at = func.now()
                db.commit()
            if room.deadline is None:
                started = class_session.started_at
                if started is not None:
                    if started.tzinfo is None:
                        started = started.replace(tzinfo=timezone.utc)
                    room.deadline = started + timedelta(minutes=CLASS_DURATION_MINUTES)
                else:
                    room.deadline = datetime.now(timezone.utc) + timedelta(minutes=CLASS_DURATION_MINUTES)
            if room.timer_task is None or room.timer_task.done():
                room.timer_task = asyncio.create_task(session_timer(session_id))

            student_waiting = room.student_ws is not None or room.pending_student is not None
            await websocket.send_json({
                "type": "class_started",
                "deadline": room.deadline.isoformat(),
                "student_present": student_waiting,
                "student_id": str(booking.student_id) if student_waiting else None,
            })

            if room.student_ws:
                student = db.get(User, booking.student_id)
                if student:
                    room.permissions[str(booking.student_id)] = _restore_student_permissions(session_id, booking.student_id, db)
                    await websocket.send_json({"type": "participant_info", "role": "student", "name": student.full_name})
                    await websocket.send_json({"type": "permissions_state", "permissions": _permission_payload(room, booking.student_id)})

            if room.pending_student:
                room.student_ws = room.pending_student
                room.pending_student = None
                student_id = booking.student_id
                room.permissions[str(student_id)] = _restore_student_permissions(session_id, student_id, db)
                permissions_state = _permission_payload(room, student_id)
                await room.student_ws.send_json({"type": "admitted", "deadline": room.deadline.isoformat()})
                await room.student_ws.send_json({"type": "participant_info", "role": "teacher", "name": user.full_name})
                await room.student_ws.send_json({"type": "permissions_state", "permissions": permissions_state})
                await websocket.send_json({"type": "student_joined", "user_id": str(student_id), "name": db.get(User, student_id).full_name if db.get(User, student_id) else "Student"})
                await websocket.send_json({"type": "permissions_state", "permissions": permissions_state})
        else:
            room.permissions[str(user.id)] = _restore_student_permissions(session_id, user.id, db)
            if room.teacher_ws is None:
                room.pending_student = websocket
                await websocket.send_json({"type": "waiting_for_teacher"})
            else:
                room.student_ws = websocket
                permissions_state = _permission_payload(room, user.id)
                await websocket.send_json({"type": "admitted", "deadline": room.deadline.isoformat() if room.deadline else None})
                teacher = db.get(User, booking.teacher_id)
                if teacher:
                    await websocket.send_json({"type": "participant_info", "role": "teacher", "name": teacher.full_name})
                await websocket.send_json({"type": "permissions_state", "permissions": permissions_state})
                await room.teacher_ws.send_json({"type": "student_joined", "user_id": str(user.id), "name": user.full_name})
                await room.teacher_ws.send_json({"type": "permissions_state", "permissions": permissions_state})

        await _send_latest_whiteboard(session_id, websocket, db)
        while True:
            data = await websocket.receive_json()
            await _handle_message(data, user, is_teacher, session_id, room, db, websocket, class_session, booking)
    except WebSocketDisconnect:
        pass
    finally:
        room = manager.rooms.get(session_id)
        if room:
            if room.teacher_ws is websocket:
                room.teacher_ws = None
                if room.student_ws:
                    try:
                        await room.student_ws.send_json({"type": "teacher_disconnected"})
                    except Exception:
                        pass
            if room.student_ws is websocket:
                room.student_ws = None
                if room.teacher_ws:
                    try:
                        await room.teacher_ws.send_json({"type": "student_disconnected"})
                    except Exception:
                        pass
            if room.pending_student is websocket:
                room.pending_student = None
            manager.drop_room_if_empty(session_id)
        db.close()


async def _handle_message(data, user, is_teacher, session_id, room, db, websocket, class_session, booking):
    msg_type = data.get("type")
    peer = room.student_ws if is_teacher else room.teacher_ws
    if msg_type == "chat":
        if peer:
            await peer.send_json({"type": "chat", "sender_id": str(user.id), "message_text": str(data.get("message_text") or "")[:4000], "file_url": data.get("file_url"), "file_name": data.get("file_name")})
    elif msg_type == "whiteboard_live":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        if peer:
            payload = data.get("payload") or {}
            stroke = payload.get("stroke") or {}
            points = stroke.get("points") or []
            if len(points) > 64:
                stroke = {**stroke, "points": points[-64:]}
            payload = {"stroke": stroke, "page_number": max(1, int(payload.get("page_number", 1))), "final": bool(payload.get("final"))}
            await peer.send_json({"type": "whiteboard_live", "payload": payload})
    elif msg_type == "whiteboard_event":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        if peer:
            await peer.send_json({"type": "whiteboard_event", "payload": data.get("payload") or {}})
    elif msg_type == "permission_update" and is_teacher:
        try:
            target_user_id = uuid.UUID(data["target_user_id"])
            permission = PermissionType(data["permission"])
            granted = bool(data["granted"])
        except (KeyError, ValueError, TypeError):
            await websocket.send_json({"type": "permission_denied", "reason": "Invalid permission request"})
            return
        if target_user_id != booking.student_id:
            await websocket.send_json({"type": "permission_denied", "reason": "Invalid classroom participant"})
            return

        db.add(PermissionEvent(session_id=session_id, target_user_id=target_user_id, permission=permission, granted=granted, granted_by=user.id))
        db.commit()

        key = str(target_user_id)
        room.permissions.setdefault(key, _default_student_permissions())
        if granted:
            room.permissions[key].add(permission.value)
        else:
            room.permissions[key].discard(permission.value)

        # The classroom permission state is authoritative independently of LiveKit.
        # Send it immediately so the UI never appears frozen while LiveKit catches up.
        event = {"type": "permission_update", "permission": permission.value, "granted": granted}
        if peer:
            await peer.send_json(event)
        await websocket.send_json(event)

        # Annotation is enforced by our classroom WebSocket, not LiveKit.
        # Calling UpdateParticipant for it was causing the misleading
        # "could not update annotate permission" error.
        if permission == PermissionType.annotate:
            return

        try:
            await _sync_livekit_permissions(class_session, target_user_id, room)
        except Exception as exc:
            await websocket.send_json({
                "type": "permission_sync_failed",
                "permission": permission.value,
                "reason": str(exc)[:300],
            })
    elif msg_type == "toggle_av":
        if peer:
            await peer.send_json({"type": "toggle_av", "user_id": str(user.id), "kind": data.get("kind"), "enabled": bool(data.get("enabled"))})
    elif msg_type == "save_snapshot":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        page_number = max(1, int(data.get("page_number", 1)))
        existing = db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id == session_id, WhiteboardSnapshot.page_number == page_number).order_by(desc(WhiteboardSnapshot.created_at)).first()
        image_url = existing.image_url if existing else None
        if data.get("image_base64"):
            image_url = save_base64_file(data["image_base64"], f"wb_{session_id}_p{page_number}", "png")
        db.add(WhiteboardSnapshot(session_id=session_id, snapshot_data=data.get("canvas_json") or {}, image_url=image_url, page_number=page_number))
        db.commit()
        await websocket.send_json({"type": "snapshot_saved", "page_number": page_number})
    elif msg_type == "extend_class" and is_teacher:
        if room.extended:
            await websocket.send_json({"type": "extend_denied", "reason": "Already extended once"})
            return
        room.extended = True
        room.deadline = (room.deadline or datetime.now(timezone.utc)) + timedelta(minutes=5)
        out = {"type": "class_extended", "new_deadline": room.deadline.isoformat()}
        for ws in (room.teacher_ws, room.student_ws):
            if ws:
                await ws.send_json(out)
    elif msg_type == "leave":
        await websocket.close(code=1000)


async def session_timer(session_id):
    while True:
        await asyncio.sleep(1)
        room = manager.rooms.get(session_id)
        if room is None or room.deadline is None:
            return
        db = SessionLocal()
        try:
            cs = db.get(ClassSession, session_id)
            if cs is None or cs.status == SessionStatus.ended:
                return
        finally:
            db.close()
        remaining = (room.deadline - datetime.now(timezone.utc)).total_seconds()
        if not room.warned and remaining <= 120:
            room.warned = True
            if room.teacher_ws:
                await room.teacher_ws.send_json({"type": "extend_prompt", "seconds_remaining": max(0, int(remaining))})
        if remaining <= 0:
            await _auto_end_session(session_id, room)
            return


async def _auto_end_session(session_id, room):
    db = SessionLocal()
    try:
        end_class_session(session_id, db)
    finally:
        db.close()
    out = {"type": "session_ended", "reason": "time_up"}
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(out)
            except Exception:
                pass
    if room.timer_task and not room.timer_task.done():
        room.timer_task.cancel()
    manager.rooms.pop(session_id, None)
