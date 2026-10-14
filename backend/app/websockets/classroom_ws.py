import asyncio
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import desc, func
from sqlalchemy.exc import IntegrityError
from livekit import api

from app.core.config import settings
from app.core.constants import CLASS_DURATION_MINUTES
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.booking import Booking
from app.models.classroom import ClassSession, PermissionEvent, PermissionType, SessionStatus
from app.models.classroom_content import ClassroomPage, WhiteboardSnapshot
from app.models.user import User
from app.services.session_lifecycle import end_class_session, mark_student_no_show
from app.services.storage_service import save_base64_file, get_presigned_url
from app.websockets.connection_manager import manager

router = APIRouter()


async def _relay_whiteboard_event(peer, payload):
    if not peer:
        return
    try:
        await peer.send_json({"type": "whiteboard_event", "payload": payload})
    except Exception as exc:
        if os.getenv("DEXMY_WHITEBOARD_DEBUG", "").lower() in {"1", "true", "yes", "on"}:
            logging.getLogger(__name__).debug("Whiteboard relay failed: %r", exc)


async def _heartbeat(websocket: WebSocket) -> None:
    """Keep the classroom WebSocket alive through idle/load-balancing proxies."""
    try:
        while True:
            await asyncio.sleep(20)
            await websocket.send_json({"type": "heartbeat"})
    except (WebSocketDisconnect, RuntimeError, ConnectionError, asyncio.CancelledError):
        return


def _authenticate(token: str | None, db) -> User | None:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError, TypeError):
        return None
    user = db.get(User, user_id)
    return user if user is not None and user.is_active else None


def _default_student_permissions() -> set[str]:
    return {"mic", "camera"}


def _timer_state(room) -> dict:
    return {
        "type": "timer_state",
        "running": room.timer_running,
        "extension_used": room.extended,
        "remaining_seconds": max(0, int(room.remaining_seconds or 0)) if not room.timer_running else max(
            0, int((room.deadline - datetime.now(timezone.utc)).total_seconds())
        ),
        "deadline": room.deadline.isoformat() if room.timer_running and room.deadline else None,
    }


async def _broadcast_timer_state(room) -> None:
    payload = _timer_state(room)
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                logging.getLogger(__name__).debug("Timer state delivery failed", exc_info=True)


async def _update_timer_for_presence(room) -> None:
    # The teaching countdown starts only when both participants are present for
    # the first time. After admission, disconnects must not pause the deadline:
    # the timer task remains responsible for ending the class at that deadline.
    now = datetime.now(timezone.utc)
    if room.student_ever_joined:
        if not room.timer_running and room.timer_started and room.teacher_ws and room.student_ws:
            room.remaining_seconds = max(0, float(room.remaining_seconds or 0))
            room.deadline = now + timedelta(seconds=room.remaining_seconds)
            room.timer_running = True
        # Once the teaching timer has started, preserve its wall-clock deadline
        # across refreshes, transient WebSocket drops, and participant reconnects.
        room.no_show_deadline = None
        room.no_show_remaining_seconds = 0
    else:
        # Before the student joins, only the no-show window runs; do not consume
        # the class duration while the teacher is waiting for the student.
        if room.timer_running:
            if room.deadline:
                room.remaining_seconds = max(0, (room.deadline - now).total_seconds())
            room.deadline = None
            room.timer_running = False
        if room.teacher_ws and not room.no_show_prompted and room.no_show_remaining_seconds > 0:
            if room.no_show_deadline is None:
                room.no_show_deadline = now + timedelta(seconds=room.no_show_remaining_seconds)
        elif room.no_show_deadline:
            room.no_show_remaining_seconds = max(0, (room.no_show_deadline - now).total_seconds())
            room.no_show_deadline = None
    await _broadcast_timer_state(room)


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
    sources = _allowed_sources(room, user_id)
    last_error = None
    for attempt in range(10):
        lkapi = api.LiveKitAPI(settings.LIVEKIT_URL, settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        try:
            try:
                await lkapi.room.get_participant(api.RoomParticipantIdentity(room=class_session.livekit_room_name, identity=str(user_id)))
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
                        # Keep the LiveKit data channel available; annotation writes are
                        # independently authorized by the classroom WebSocket and receiver.
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


async def _finish_screen_share_permission_change(class_session: ClassSession, target_user_id: uuid.UUID, room, session_id: uuid.UUID, granted_by: uuid.UUID, granted: bool) -> None:
    """Apply screen-share grants/revokes in LiveKit without blocking the teacher."""
    key = str(target_user_id)
    try:
        await _sync_livekit_permissions(class_session, target_user_id, room)
        # Permission may have changed again while this request was in flight.
        # Re-apply the latest state to prevent stale tasks from undoing a newer click.
        current_granted = "screen_share" in room.permissions.get(key, set())
        if current_granted != granted:
            await _sync_livekit_permissions(class_session, target_user_id, room)
    except Exception as exc:
        # For a failed grant, fail closed and persist the rollback. For a revoke,
        # keep the app-level denial and keep retrying LiveKit in later permission
        # updates; the student client also stops its active screen-share track.
        if granted and "screen_share" in room.permissions.get(key, set()):
            room.permissions[key].discard("screen_share")
            db = SessionLocal()
            try:
                db.add(PermissionEvent(
                    session_id=session_id,
                    target_user_id=target_user_id,
                    permission=PermissionType.screen_share,
                    granted=False,
                    granted_by=granted_by,
                ))
                db.commit()
            except Exception:
                db.rollback()
                logging.getLogger(__name__).exception("Could not persist screen-share grant rollback")
            finally:
                db.close()
            event = {"type": "permission_update", "permission": "screen_share", "granted": False}
            for ws in (room.teacher_ws, room.student_ws):
                if ws:
                    try:
                        await ws.send_json(event)
                    except Exception:
                        pass
        failure = {
            "type": "permission_sync_failed",
            "permission": "screen_share",
            "granted": granted,
            "reason": str(exc)[:300],
        }
        if room.teacher_ws:
            try:
                await room.teacher_ws.send_json(failure)
            except Exception:
                pass


def _restore_student_permissions(session_id: uuid.UUID, student_id: uuid.UUID, db) -> set[str]:
    permissions = _default_student_permissions()
    events = db.query(PermissionEvent).filter(PermissionEvent.session_id == session_id, PermissionEvent.target_user_id == student_id).order_by(desc(PermissionEvent.created_at)).all()
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
    pages_db = db.query(ClassroomPage).filter(ClassroomPage.session_id == session_id).order_by(ClassroomPage.position.asc()).all()
    if not pages_db:
        page = ClassroomPage(session_id=session_id, position=1, page_type="whiteboard")
        db.add(page)
        try:
            db.commit()
            db.refresh(page)
            pages_db = [page]
        except IntegrityError:
            # Teacher and student can initialize the same classroom concurrently.
            # Recover the page created by the other connection instead of dropping the socket.
            db.rollback()
            pages_db = db.query(ClassroomPage).filter(ClassroomPage.session_id == session_id).order_by(ClassroomPage.position.asc()).all()
            if not pages_db:
                return
    pages=[]
    for position,page in enumerate(pages_db,1):
        snap=db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id==session_id,WhiteboardSnapshot.page_id==page.id).order_by(desc(WhiteboardSnapshot.created_at)).first()
        key = None
        if page.page_type == "pdf":
            # Keep the original PDF page image as the slide background. Older
            # snapshots may contain a canvas-only PNG, so use the earliest
            # non-empty snapshot image as the canonical PDF image key.
            original = db.query(WhiteboardSnapshot).filter(
                WhiteboardSnapshot.session_id == session_id,
                WhiteboardSnapshot.page_id == page.id,
                WhiteboardSnapshot.image_url.isnot(None),
            ).order_by(WhiteboardSnapshot.created_at.asc()).first()
            key = (original.image_url if original else None) or page.image_url
        pages.append({"page_id":str(page.id),"page_number":position,"page_type":page.page_type,"image_url":get_presigned_url(key,expires_in=3600) if key else None,"strokes":(snap.snapshot_data or {}).get("strokes",[]) if snap else []})
    cur=pages[-1]
    await websocket.send_json({"type":"whiteboard_state","page_number":cur["page_number"],"page_id":cur["page_id"],"canvas_json":{"strokes":cur["strokes"]},"image_url":cur["image_url"],"pages":pages})


@router.websocket("/ws/classroom/{session_id}")
async def classroom_socket(websocket: WebSocket, session_id: uuid.UUID, token: str | None = Query(default=None)):
    db = SessionLocal()
    heartbeat_task = None
    try:
        origin = websocket.headers.get("origin")
        allowed_origins = {
            settings.FRONTEND_ORIGIN.rstrip("/"),
            "https://dexmyedu.com",
            "https://www.dexmyedu.com",
            "https://dexmy.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
        }
        if origin and origin.rstrip("/") not in allowed_origins:
            await websocket.close(code=4403)
            return
        # Cookies are the primary auth path. The query token remains temporarily
        # accepted to avoid breaking already-open clients during a staggered deploy.
        access_token = websocket.cookies.get(settings.ACCESS_COOKIE_NAME) or token
        user = _authenticate(access_token, db)
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
        heartbeat_task = asyncio.create_task(_heartbeat(websocket))
        room = manager.get_room(session_id)
        if is_teacher:
            room.teacher_ws = websocket
            room.permissions[str(user.id)] = {"annotate", "screen_share", "mic", "camera"}

            if not room.timer_started:
                now = datetime.now(timezone.utc)
                first_start = class_session.started_at is None
                if class_session.status == SessionStatus.scheduled:
                    class_session.status = SessionStatus.live
                    class_session.started_at = now
                elif first_start:
                    class_session.started_at = now
                db.commit()
                room.timer_started = True
                if first_start:
                    # Initialize the duration only once. If in-memory room state
                    # was lost during a reconnect/reload, recover the elapsed time
                    # from the persisted session start instead of resetting to 55m.
                    room.remaining_seconds = float(CLASS_DURATION_MINUTES * 60)
                    room.no_show_remaining_seconds = 900.0
                else:
                    started_at = class_session.started_at
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    elapsed = max(0.0, (now - started_at).total_seconds())
                    room.remaining_seconds = max(0.0, float(CLASS_DURATION_MINUTES * 60) - elapsed)
                    room.no_show_remaining_seconds = max(0.0, 900.0 - elapsed)

            pending_student = room.pending_student
            if pending_student:
                room.student_ws = pending_student
                room.pending_student = None
                room.student_ever_joined = True
                room.no_show_deadline = None
                room.no_show_remaining_seconds = 0
                if room.no_show_prompted and not room.no_show_decided:
                    room.no_show_decided = True
                    try:
                        await websocket.send_json({"type": "no_show_prompt_dismissed"})
                    except Exception:
                        pass
                student_id = booking.student_id
                room.permissions[str(student_id)] = _restore_student_permissions(session_id, student_id, db)
                permissions_state = _permission_payload(room, student_id)
                try:
                    await pending_student.send_json({"type": "admitted", "deadline": room.deadline.isoformat() if room.deadline else None})
                    await pending_student.send_json({"type": "participant_info", "role": "teacher", "name": user.full_name})
                    await pending_student.send_json({"type": "permissions_state", "permissions": permissions_state})
                except Exception:
                    room.student_ws = None

            if room.student_ws:
                student = db.get(User, booking.student_id)
                if student:
                    room.permissions[str(booking.student_id)] = _restore_student_permissions(session_id, booking.student_id, db)
                    await websocket.send_json({"type": "participant_info", "role": "student", "name": student.full_name})
                    await websocket.send_json({"type": "permissions_state", "permissions": _permission_payload(room, booking.student_id)})

            await _update_timer_for_presence(room)
            if room.timer_task is None or room.timer_task.done():
                room.timer_task = asyncio.create_task(session_timer(session_id))
            await websocket.send_json({
                "type": "class_started",
                "deadline": room.deadline.isoformat() if room.deadline else None,
                "student_present": room.student_ws is not None,
                "student_id": str(booking.student_id) if room.student_ws else None,
            })
            if room.no_show_prompted and not room.no_show_decided and not room.student_ever_joined:
                await websocket.send_json({"type": "student_no_show_prompt"})
            if room.student_ws:
                student = db.get(User, booking.student_id)
                await websocket.send_json({"type": "student_joined", "user_id": str(booking.student_id), "name": student.full_name if student else "Student"})
                await room.student_ws.send_json(_timer_state(room))
                await websocket.send_json({"type": "permissions_state", "permissions": _permission_payload(room, booking.student_id)})
        else:
            room.permissions[str(user.id)] = _restore_student_permissions(session_id, user.id, db)
            if room.teacher_ws is None:
                room.pending_student = websocket
                await websocket.send_json({"type": "waiting_for_teacher"})
            else:
                room.student_ws = websocket
                room.student_ever_joined = True
                room.no_show_deadline = None
                room.no_show_remaining_seconds = 0
                if room.no_show_prompted and not room.no_show_decided:
                    room.no_show_decided = True
                    try:
                        await room.teacher_ws.send_json({"type": "no_show_prompt_dismissed"})
                    except Exception:
                        pass
                permissions_state = _permission_payload(room, user.id)
                await websocket.send_json({"type": "admitted", "deadline": room.deadline.isoformat() if room.deadline else None})
                teacher = db.get(User, booking.teacher_id)
                if teacher:
                    await websocket.send_json({"type": "participant_info", "role": "teacher", "name": teacher.full_name})
                await websocket.send_json({"type": "permissions_state", "permissions": permissions_state})
                await room.teacher_ws.send_json({"type": "student_joined", "user_id": str(user.id), "name": user.full_name})
                await room.teacher_ws.send_json({"type": "permissions_state", "permissions": permissions_state})
                await _update_timer_for_presence(room)
                if room.timer_task is None or room.timer_task.done():
                    room.timer_task = asyncio.create_task(session_timer(session_id))
        await _send_latest_whiteboard(session_id, websocket, db)
        while True:
            data = await websocket.receive_json()
            await _handle_message(data, user, is_teacher, session_id, room, db, websocket, class_session, booking)
    except WebSocketDisconnect:
        pass
    finally:
        if heartbeat_task:
            heartbeat_task.cancel()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass
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
            await _update_timer_for_presence(room)
            manager.drop_room_if_empty(session_id)
        db.close()


async def _handle_message(data, user, is_teacher, session_id, room, db, websocket, class_session, booking):
    msg_type = data.get("type")
    peer = room.student_ws if is_teacher else room.teacher_ws
    if msg_type == "heartbeat":
        return
    if msg_type == "chat":
        if peer:
            try:
                await peer.send_json({"type": "chat", "sender_id": str(user.id), "message_text": str(data.get("message_text") or "")[:4000], "file_url": data.get("file_url"), "file_name": data.get("file_name")})
            except (WebSocketDisconnect, RuntimeError, ConnectionError, OSError):
                if is_teacher and room.student_ws is peer:
                    room.student_ws = None
                elif not is_teacher and room.teacher_ws is peer:
                    room.teacher_ws = None
    elif msg_type == "whiteboard_event":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        payload = data.get("payload") or {}
        kind = payload.get("kind")
        action_id = payload.get("action_id")
        if action_id:
            already_processed = db.query(WhiteboardSnapshot).filter(
                WhiteboardSnapshot.session_id == session_id,
                WhiteboardSnapshot.snapshot_data.contains({"action_id": str(action_id)}),
            ).first()
            if already_processed:
                # A retried move must never relay its old coordinates after a
                # newer move (or delete) has already been committed.
                canonical_payload = dict(payload)
                should_relay = True
                if payload.get("kind") in {"stroke", "stroke_update"} and isinstance(payload.get("stroke"), dict):
                    stroke_id = payload["stroke"].get("id")
                    latest = db.query(WhiteboardSnapshot).filter(
                        WhiteboardSnapshot.session_id == session_id,
                        WhiteboardSnapshot.page_id == already_processed.page_id,
                    ).order_by(desc(WhiteboardSnapshot.created_at)).first() if already_processed.page_id else already_processed
                    latest_strokes = ((latest.snapshot_data or {}).get("strokes") or []) if latest else []
                    current_stroke = next(
                        (item for item in latest_strokes if isinstance(item, dict) and item.get("id") == stroke_id),
                        None,
                    )
                    if current_stroke:
                        canonical_payload["stroke"] = dict(current_stroke)
                        canonical_payload["page_id"] = str(already_processed.page_id)
                        # A retried create can refer to an object that has since
                        # moved; relay it as an update so peers replace geometry.
                        if canonical_payload.get("kind") == "stroke":
                            canonical_payload["kind"] = "stroke_update"
                    else:
                        # The stroke may have been deleted after this action.
                        should_relay = False
                await websocket.send_json({
                    "type": "whiteboard_event_ack",
                    "action_id": str(action_id),
                    "payload": canonical_payload if should_relay else None,
                })
                if should_relay:
                    await _relay_whiteboard_event(peer, canonical_payload)
                return
        if kind in {"stroke", "stroke_update", "stroke_delete", "undo", "clear"}:
            page_number = max(1, int(payload.get("page_number", 1) or 1))
            try:
                page_id = uuid.UUID(str(payload.get("page_id"))) if payload.get("page_id") else None
            except (ValueError, TypeError):
                page_id = None
            page = db.get(ClassroomPage, page_id) if page_id else None
            # The client can briefly hold a stale page_id while slide state is
            # being reconciled. The page number is the canonical ordering key,
            # so recover the current server page instead of silently dropping
            # the committed drawing event. Always send the canonical page_id
            # back to the peer after resolving it.
            if page is None or page.session_id != session_id:
                page = db.query(ClassroomPage).filter(
                    ClassroomPage.session_id == session_id,
                    ClassroomPage.position == page_number,
                ).first()
            if page is None:
                return
            latest = db.query(WhiteboardSnapshot).filter(
                WhiteboardSnapshot.session_id == session_id,
                WhiteboardSnapshot.page_id == page.id,
            ).order_by(desc(WhiteboardSnapshot.created_at)).first()
            # Do not trust a single "latest" snapshot as the complete canvas:
            # rapid strokes can create snapshots with tied timestamps, and the
            # selected row may omit strokes that were already committed. Merge
            # the page's history by stroke ID, preferring the highest server
            # revision for each stroke, while preserving each stroke's first
            # position in the drawing order.
            page_snapshots = db.query(WhiteboardSnapshot).filter(
                WhiteboardSnapshot.session_id == session_id,
                WhiteboardSnapshot.page_id == page.id,
            ).order_by(WhiteboardSnapshot.created_at.asc(), WhiteboardSnapshot.id.asc()).all()
            deleted_stroke_ids = {
                str(stroke_id)
                for snapshot in page_snapshots
                if isinstance(snapshot.snapshot_data, dict)
                for stroke_id in (snapshot.snapshot_data.get("deleted_stroke_ids") or [])
            }
            strokes_by_id = {}
            stroke_order = []
            for snapshot in page_snapshots:
                snapshot_data = snapshot.snapshot_data if isinstance(snapshot.snapshot_data, dict) else {}
                for saved_stroke in snapshot_data.get("strokes") or []:
                    if not isinstance(saved_stroke, dict) or not saved_stroke.get("id"):
                        continue
                    stroke_id = str(saved_stroke["id"])
                    if stroke_id not in strokes_by_id:
                        stroke_order.append(stroke_id)
                        strokes_by_id[stroke_id] = saved_stroke
                        continue
                    try:
                        current_revision = int(strokes_by_id[stroke_id].get("_whiteboard_revision") or 0)
                        incoming_revision = int(saved_stroke.get("_whiteboard_revision") or 0)
                    except (TypeError, ValueError):
                        current_revision = incoming_revision = 0
                    if incoming_revision > current_revision:
                        strokes_by_id[stroke_id] = saved_stroke
            strokes = [
                strokes_by_id[stroke_id]
                for stroke_id in stroke_order
                if stroke_id in strokes_by_id and stroke_id not in deleted_stroke_ids
            ]
            stroke = payload.get("stroke")
            if kind in {"stroke", "stroke_update"} and isinstance(stroke, dict) and stroke.get("id") and str(stroke["id"]) in deleted_stroke_ids:
                if action_id:
                    await websocket.send_json({
                        "type": "whiteboard_event_ack",
                        "action_id": str(action_id),
                        "payload": None,
                    })
                return
            if kind == "stroke" and isinstance(stroke, dict) and stroke.get("id"):
                existing_index = next(
                    (i for i, item in enumerate(strokes) if isinstance(item, dict) and item.get("id") == stroke["id"]),
                    None,
                )
                if existing_index is None:
                    # Revisions are server-owned so both peers can use the
                    # same committed base revision for future live previews.
                    stroke["_whiteboard_revision"] = 1
                    strokes.append(stroke)
                else:
                    # Duplicate creation must return the already committed
                    # object, not a stale client copy.
                    payload["stroke"] = dict(strokes[existing_index])
                    stroke = payload["stroke"]
            elif kind == "stroke_update" and isinstance(stroke, dict) and stroke.get("id"):
                index = next((i for i, item in enumerate(strokes) if isinstance(item, dict) and item.get("id") == stroke["id"]), None)
                previous_revision = strokes[index].get("_whiteboard_revision", 0) if index is not None else 0
                try:
                    previous_revision = int(previous_revision or 0)
                except (TypeError, ValueError):
                    previous_revision = 0

                # WebSocket actions can arrive after a newer drag commit has
                # already been persisted. Server revisions alone cannot detect
                # this: an old payload would otherwise receive a newer revision
                # and overwrite the latest geometry. For the same editor, reject
                # updates whose client edit generation is older than the stored
                # stroke generation.
                if index is not None:
                    current_stroke = strokes[index]
                    try:
                        incoming_generation = int(stroke.get("_whiteboard_edit_generation") or 0)
                        current_generation = int(current_stroke.get("_whiteboard_edit_generation") or 0)
                    except (TypeError, ValueError):
                        incoming_generation = current_generation = 0
                    incoming_editor = str(stroke.get("_whiteboard_editor_id") or "")
                    current_editor = str(current_stroke.get("_whiteboard_editor_id") or "")
                    same_editor_or_legacy_update = (
                        incoming_editor == current_editor
                        or not incoming_editor
                        or not current_editor
                    )
                    incoming_geometry = (
                        stroke.get("tool"),
                        stroke.get("points"),
                        stroke.get("text"),
                    )
                    current_geometry = (
                        current_stroke.get("tool"),
                        current_stroke.get("points"),
                        current_stroke.get("text"),
                    )
                    same_editor_same_generation_conflict = (
                        bool(incoming_editor)
                        and incoming_editor == current_editor
                        and incoming_generation == current_generation
                        and incoming_geometry != current_geometry
                    )
                    if (
                        same_editor_or_legacy_update
                        and (
                            incoming_generation < current_generation
                            or same_editor_same_generation_conflict
                        )
                    ):
                        # Record the action idempotently without changing the
                        # canonical stroke or relaying stale coordinates. Equal
                        # generations from the same editor must also not restore
                        # older geometry after a newer move has been committed.
                        snapshot_data = {
                            "strokes": strokes,
                            "deleted_stroke_ids": sorted(deleted_stroke_ids),
                        }
                        if action_id:
                            snapshot_data["action_id"] = str(action_id)
                        db.add(WhiteboardSnapshot(
                            session_id=session_id,
                            snapshot_data=snapshot_data,
                            image_url=latest.image_url if latest else page.image_url,
                            page_number=page_number,
                            page_id=page.id,
                        ))
                        db.commit()
                        canonical_payload = dict(payload)
                        canonical_payload["stroke"] = dict(current_stroke)
                        canonical_payload["page_id"] = str(page.id)
                        if action_id:
                            await websocket.send_json({
                                "type": "whiteboard_event_ack",
                                "action_id": str(action_id),
                                "payload": canonical_payload,
                            })
                        return

                stroke["_whiteboard_revision"] = previous_revision + 1
                if index is None:
                    strokes.append(stroke)
                else:
                    strokes[index] = stroke
            elif kind == "stroke_delete" and payload.get("stroke_id"):
                deleted_stroke_ids.add(str(payload["stroke_id"]))
                strokes = [item for item in strokes if not isinstance(item, dict) or item.get("id") != payload["stroke_id"]]
            elif kind == "undo":
                if strokes:
                    removed = strokes.pop()
                    if isinstance(removed, dict) and removed.get("id"):
                        deleted_stroke_ids.add(str(removed["id"]))
            elif kind == "clear":
                deleted_stroke_ids.update(
                    str(item["id"]) for item in strokes
                    if isinstance(item, dict) and item.get("id")
                )
                strokes = []
            snapshot_data = {
                "strokes": strokes,
                "deleted_stroke_ids": sorted(deleted_stroke_ids),
            }
            if action_id:
                snapshot_data["action_id"] = str(action_id)
            db.add(WhiteboardSnapshot(
                session_id=session_id,
                snapshot_data=snapshot_data,
                image_url=latest.image_url if latest else page.image_url,
                page_number=page_number,
                page_id=page.id,
            ))
            payload["page_id"] = str(page.id)
            db.commit()
            if action_id:
                # Return the canonical committed object/revision immediately so
                # the sender can base the next live preview on the new revision.
                await websocket.send_json({
                    "type": "whiteboard_event_ack",
                    "action_id": str(action_id),
                    "payload": payload,
                })
            await _relay_whiteboard_event(peer, payload)
    elif msg_type == "whiteboard_live":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        if peer:
            await peer.send_json({"type": "whiteboard_live", "payload": data.get("payload") or {}})
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
        key = str(target_user_id)
        previous_permissions = set(room.permissions.get(key, _default_student_permissions()))
        next_permissions = set(previous_permissions)
        if granted:
            next_permissions.add(permission.value)
        else:
            next_permissions.discard(permission.value)
        room.permissions[key] = next_permissions

        # Annotation is enforced by the classroom WebSocket and receiving client.
        # Screen-share grants and revokes are saved and announced immediately;
        # LiveKit's publish-source permission is applied asynchronously.
        if permission == PermissionType.screen_share:
            try:
                db.add(PermissionEvent(session_id=session_id, target_user_id=target_user_id, permission=permission, granted=granted, granted_by=user.id))
                db.commit()
            except Exception:
                db.rollback()
                room.permissions[key] = previous_permissions
                await websocket.send_json({
                    "type": "permission_sync_failed",
                    "permission": permission.value,
                    "granted": granted,
                    "reason": "Could not save the permission change. Please try again.",
                })
                return
            event = {"type": "permission_update", "permission": permission.value, "granted": granted}
            if peer:
                await peer.send_json(event)
            await websocket.send_json(event)
            asyncio.create_task(_finish_screen_share_permission_change(class_session, target_user_id, room, session_id, user.id, granted))
            return

        if permission != PermissionType.annotate:
            try:
                await _sync_livekit_permissions(class_session, target_user_id, room)
            except Exception as exc:
                room.permissions[key] = previous_permissions
                try:
                    await _sync_livekit_permissions(class_session, target_user_id, room)
                except Exception:
                    logging.getLogger(__name__).warning("Failed to restore LiveKit permissions after sync failure", exc_info=True)
                await websocket.send_json({
                    "type": "permission_sync_failed",
                    "permission": permission.value,
                    "granted": granted,
                    "reason": str(exc)[:300],
                })
                return

        try:
            db.add(PermissionEvent(session_id=session_id, target_user_id=target_user_id, permission=permission, granted=granted, granted_by=user.id))
            db.commit()
        except Exception:
            db.rollback()
            room.permissions[key] = previous_permissions
            if permission != PermissionType.annotate:
                try:
                    await _sync_livekit_permissions(class_session, target_user_id, room)
                except Exception:
                    logging.getLogger(__name__).warning("Failed to restore LiveKit permissions after DB commit failure", exc_info=True)
            await websocket.send_json({
                "type": "permission_sync_failed",
                "permission": permission.value,
                "granted": granted,
                "reason": "Could not save the permission change. Please try again.",
            })
            return

        event = {"type": "permission_update", "permission": permission.value, "granted": granted}
        if peer:
            await peer.send_json(event)
        await websocket.send_json(event)
    elif msg_type == "toggle_av":
        if peer:
            await peer.send_json({"type": "toggle_av", "user_id": str(user.id), "kind": data.get("kind"), "enabled": bool(data.get("enabled"))})
    elif msg_type == "save_snapshot":
        if not is_teacher and "annotate" not in room.permissions.get(str(user.id), set()):
            await websocket.send_json({"type": "permission_denied", "permission": "annotate"})
            return
        page_number=max(1,int(data.get("page_number",1)))
        try: page_id=uuid.UUID(str(data.get("page_id"))) if data.get("page_id") else None
        except (ValueError,TypeError): page_id=None
        page=db.get(ClassroomPage,page_id) if page_id else None
        # An explicitly supplied page ID that no longer exists was deleted or
        # is stale. Do not fall back to its old page number and attach that
        # snapshot to a different slide.
        if page_id and (page is None or page.session_id != session_id):
            return
        if page is None:
            page=db.query(ClassroomPage).filter(ClassroomPage.session_id==session_id,ClassroomPage.position==page_number).first()
        if page is None:
            page=ClassroomPage(session_id=session_id,position=page_number,page_type="whiteboard"); db.add(page); db.flush()
        existing=db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id==session_id,WhiteboardSnapshot.page_id==page.id).order_by(desc(WhiteboardSnapshot.created_at)).first()
        image_url=existing.image_url if existing else page.image_url
        if page.page_type == "pdf":
            # PDF page.image_url must remain the original stored PDF-page image;
            # canvas snapshots contain annotations only and must never replace it.
            original=db.query(WhiteboardSnapshot).filter(
                WhiteboardSnapshot.session_id==session_id,
                WhiteboardSnapshot.page_id==page.id,
                WhiteboardSnapshot.image_url.isnot(None),
            ).order_by(WhiteboardSnapshot.created_at.asc()).first()
            image_url=(original.image_url if original else None) or page.image_url
        elif data.get("image_base64"):
            image_url=save_base64_file(data["image_base64"],f"wb_{session_id}_p{page.id}","png")
            page.image_url=image_url
        snapshot_data = data.get("canvas_json") or {}
        if not isinstance(snapshot_data, dict):
            snapshot_data = {}
        existing_snapshot_data = existing.snapshot_data if existing and isinstance(existing.snapshot_data, dict) else {}
        # Never derive deletion history from only one "latest" row: timestamp
        # ties or a delayed snapshot can otherwise drop tombstones and restore
        # every stroke removed by Undo/Clear.
        page_snapshot_data = db.query(WhiteboardSnapshot.snapshot_data).filter(
            WhiteboardSnapshot.session_id == session_id,
            WhiteboardSnapshot.page_id == page.id,
        ).all()
        deleted_stroke_ids = {
            str(stroke_id)
            for (historical_data,) in page_snapshot_data
            if isinstance(historical_data, dict)
            for stroke_id in (historical_data.get("deleted_stroke_ids") or [])
        }
        incoming_strokes = snapshot_data.get("strokes")
        existing_strokes = existing_snapshot_data.get("strokes") or []
        if isinstance(incoming_strokes, list):
            # Snapshots are debounced and may arrive after Undo. Filter every
            # tombstoned ID before persisting so an old canvas image cannot undo
            # a committed deletion.
            incoming_strokes[:] = [
                stroke for stroke in incoming_strokes
                if not isinstance(stroke, dict)
                or not stroke.get("id")
                or str(stroke["id"]) not in deleted_stroke_ids
            ]
        if isinstance(incoming_strokes, list) and isinstance(existing_strokes, list):
            existing_by_id = {
                item.get("id"): item
                for item in existing_strokes
                if isinstance(item, dict) and item.get("id")
            }
            for stroke in incoming_strokes:
                if not isinstance(stroke, dict) or not stroke.get("id"):
                    continue
                committed = existing_by_id.get(stroke["id"])
                if not committed:
                    continue
                try:
                    committed_revision = int(committed.get("_whiteboard_revision") or 0)
                    incoming_revision = int(stroke.get("_whiteboard_revision") or 0)
                except (TypeError, ValueError):
                    continue
                if committed_revision > 0 and committed_revision >= incoming_revision:
                    # The committed event stream is authoritative for every
                    # stroke type, including freehand pen/highlighter paths.
                    # A snapshot with an equal revision can still carry stale
                    # points, so preserve the complete committed stroke unless
                    # the snapshot explicitly has a newer revision.
                    incoming_strokes[incoming_strokes.index(stroke)] = dict(committed)
        snapshot_data["deleted_stroke_ids"] = sorted(deleted_stroke_ids)
        db.add(WhiteboardSnapshot(session_id=session_id,snapshot_data=snapshot_data,image_url=image_url,page_number=page_number,page_id=page.id))
        db.commit()
        await websocket.send_json({"type":"snapshot_saved","page_number":page_number,"page_id":str(page.id)})
    elif msg_type == "remove_pdf" and is_teacher:
        snapshots = db.query(WhiteboardSnapshot).filter(WhiteboardSnapshot.session_id == session_id).all()
        for snapshot in snapshots:
            snapshot.image_url = None
        db.commit()
        for ws in (room.teacher_ws, room.student_ws):
            if ws:
                try:
                    await ws.send_json({"type": "pdf_removed"})
                except Exception:
                    pass
    elif msg_type == "no_show_decision" and is_teacher:
        if not room.no_show_prompted or room.no_show_decided or room.student_ever_joined:
            return
        room.no_show_decided = True
        if bool(data.get("accepted")):
            try:
                mark_student_no_show(session_id, db)
            except Exception:
                db.rollback()
                room.no_show_decided = False
                logging.getLogger(__name__).exception(
                    "Could not record student no-show for session %s",
                    session_id,
                )
                await websocket.send_json({"type": "no_show_decision_failed"})
                return
            out = {"type": "session_ended", "reason": "student_no_show"}
            for ws in (room.teacher_ws, room.student_ws):
                if ws:
                    try:
                        await ws.send_json(out)
                    except Exception:
                        pass
            if room.timer_task and room.timer_task is not asyncio.current_task() and not room.timer_task.done():
                room.timer_task.cancel()
            manager.rooms.pop(session_id, None)
        else:
            await websocket.send_json({"type": "no_show_prompt_dismissed"})
    elif msg_type == "extend_class" and is_teacher:
        remaining = (room.deadline - datetime.now(timezone.utc)).total_seconds() if room.timer_running and room.deadline else None
        if not room.timer_running or remaining is None or remaining > 300:
            await websocket.send_json({"type": "extend_denied", "reason": "Available only in the last 5 minutes"})
            return
        if room.extended:
            await websocket.send_json({"type": "extend_denied", "reason": "Already extended once"})
            return
        room.extended = True
        room.deadline = room.deadline + timedelta(minutes=5)
        room.remaining_seconds = max(0, (room.deadline - datetime.now(timezone.utc)).total_seconds())
        out = {"type": "class_extended", "new_deadline": room.deadline.isoformat()}
        for ws in (room.teacher_ws, room.student_ws):
            if ws:
                try:
                    await ws.send_json(out)
                except Exception:
                    pass
        await _broadcast_timer_state(room)
    elif msg_type == "leave":
        await websocket.close(code=1000)


async def session_timer(session_id):
    logger = logging.getLogger(__name__)
    logger.info("Class timer task started for session %s", session_id)
    while True:
        await asyncio.sleep(1)
        room = manager.rooms.get(session_id)
        if room is None:
            logger.warning("Class timer stopped because room state is missing for session %s", session_id)
            return
        db = SessionLocal()
        try:
            cs = db.get(ClassSession, session_id)
            if cs is None or cs.status in (SessionStatus.ended, SessionStatus.cancelled):
                return
        except Exception:
            db.rollback()
            logger.exception("Could not check class status in timer loop for session %s; retrying", session_id)
            await asyncio.sleep(2)
            continue
        finally:
            db.close()

        now = datetime.now(timezone.utc)
        if room.no_show_deadline and now >= room.no_show_deadline and not room.student_ever_joined and not room.no_show_prompted:
            room.no_show_deadline = None
            room.no_show_remaining_seconds = 0
            room.no_show_prompted = True
            if room.teacher_ws:
                try:
                    await room.teacher_ws.send_json({"type": "student_no_show_prompt"})
                except Exception:
                    logger.warning("Could not send student no-show prompt for session %s", session_id, exc_info=True)

        if not room.timer_running or room.deadline is None:
            continue

        remaining = (room.deadline - now).total_seconds()
        room.remaining_seconds = max(0, remaining)
        if remaining <= 0:
            logger.info("Class deadline reached for session %s; attempting finalization", session_id)
            if await _auto_end_session(session_id, room):
                logger.info("Class automatically finalized for session %s", session_id)
                return
            await asyncio.sleep(2)
            continue

        if not room.warned and remaining <= 120:
            room.warned = True
            if room.teacher_ws:
                try:
                    await room.teacher_ws.send_json({
                        "type": "extend_prompt",
                        "seconds_remaining": max(0, int(remaining)),
                    })
                except Exception:
                    logger.warning("Could not send class extension warning for session %s", session_id, exc_info=True)


async def _auto_end_session(session_id, room):
    reason = "student_no_show" if not room.student_ever_joined else "time_up"
    db = SessionLocal()
    try:
        if room.student_ever_joined:
            end_class_session(session_id, db)
        else:
            mark_student_no_show(session_id, db)
    except Exception:
        db.rollback()
        logging.getLogger(__name__).exception(
            "Automatic class end failed for session %s; will retry",
            session_id,
        )
        return False
    finally:
        db.close()

    out = {"type": "session_ended", "reason": reason}
    for ws in (room.teacher_ws, room.student_ws):
        if ws:
            try:
                await ws.send_json(out)
            except Exception:
                pass
    if room.timer_task and room.timer_task is not asyncio.current_task() and not room.timer_task.done():
        room.timer_task.cancel()
    manager.rooms.pop(session_id, None)
    return True
