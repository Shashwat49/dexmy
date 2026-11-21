import uuid
from datetime import datetime, timedelta, timezone

from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession
from app.websockets.connection_manager import RoomState
from app.websockets.classroom_ws import _update_timer_for_presence


def test_teacher_and_student_can_request_join_token_before_scheduled_time(
    client, seed_data, auth_headers, db_session
):
    student = seed_data["student"]
    teacher = seed_data["teacher1"]
    subject = seed_data["subject"]
    scheduled_at = datetime.now(timezone.utc) + timedelta(hours=2)

    booking = Booking(
        id=uuid.uuid4(),
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subject.id,
        scheduled_at=scheduled_at,
        booking_ends_at=scheduled_at + timedelta(minutes=55),
        duration_minutes=55,
        status=BookingStatus.confirmed,
        teacher_assignment_status="assigned",
    )
    db_session.add(booking)
    db_session.flush()

    session = ClassSession(
        id=uuid.uuid4(),
        booking_id=booking.id,
        livekit_room_name=f"classroom-{uuid.uuid4()}",
    )
    db_session.add(session)
    db_session.commit()

    teacher_response = client.post(
        "/api/v1/classroom/join-token",
        json={"session_id": str(session.id)},
        headers=auth_headers(str(teacher.id), "teacher"),
    )
    assert teacher_response.status_code == 200, teacher_response.text

    student_response = client.post(
        "/api/v1/classroom/join-token",
        json={"session_id": str(session.id)},
        headers=auth_headers(str(student.id), "student"),
    )
    assert student_response.status_code == 200, student_response.text


def test_timer_pauses_when_participant_disconnects_and_resumes_when_both_reconnect():
    room = RoomState()
    room.student_ever_joined = True
    room.timer_started = True
    room.remaining_seconds = 3300
    room.teacher_ws = object()
    room.student_ws = object()

    import asyncio

    asyncio.run(_update_timer_for_presence(room))
    assert room.timer_running is True
    assert room.deadline is not None

    room.student_ws = None
    asyncio.run(_update_timer_for_presence(room))
    assert room.timer_running is False
    paused_remaining = room.remaining_seconds
    assert paused_remaining is not None and paused_remaining > 0

    room.student_ws = object()
    asyncio.run(_update_timer_for_presence(room))
    assert room.timer_running is True
    assert room.remaining_seconds <= paused_remaining
