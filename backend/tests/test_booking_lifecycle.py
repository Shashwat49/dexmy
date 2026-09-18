import uuid
from datetime import datetime, timedelta, timezone
from app.models.booking import Booking, BookingStatus

def test_booking_cancellation_workflow(client, seed_data, auth_headers, db_session):
    """
    Test that cancelling a booking updates its status and triggers downstream effects
    (like restoring credits or updating ClassSession if implemented).
    """
    student = seed_data["student"]
    subject = seed_data["subject"]
    headers = auth_headers(student.id, "student")
    
    tomorrow = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=1)
    slot_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 10, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    # 1. Create a booking
    payload = {
        "subject_id": subject.id,
        "scheduled_at": slot_time.isoformat(),
        "idempotency_key": str(uuid.uuid4())
    }
    resp = client.post("/api/v1/bookings/", json=payload, headers=headers)
    assert resp.status_code in (200, 201), resp.text
    booking_id = resp.json()["id"]
    
    # 2. Cancel the booking
    cancel_resp = client.post(f"/api/v1/bookings/{booking_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200, cancel_resp.text
    
    # 3. Verify status in database
    db_session.expire_all()
    booking = db_session.get(Booking, uuid.UUID(booking_id))
    assert booking.status == BookingStatus.cancelled

def test_assign_unqualified_teacher_fails(client, seed_data, auth_headers, db_session):
    """
    Test that assigning a teacher who doesn't teach the subject fails with 400.
    """
    admin = seed_data["admin"]
    student = seed_data["student"]
    
    # Create a subject that no teacher teaches
    from app.models.teacher import Subject
    new_subject = Subject(name="Physics")
    db_session.add(new_subject)
    db_session.commit()
    
    tomorrow = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=1)
    slot_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 15, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    booking = Booking(
        id=uuid.uuid4(),
        student_id=student.id,
        subject_id=new_subject.id,
        scheduled_at=slot_time,
        status="confirmed",
        teacher_assignment_status="pending",
        duration_minutes=55
    )
    db_session.add(booking)
    db_session.commit()
    
    teacher1 = seed_data["teacher1"]
    admin_headers = auth_headers(admin.id, "admin")
    
    resp = client.post(
        f"/api/v1/bookings/{booking.id}/assign-teacher",
        json={"teacher_id": str(teacher1.id)},
        headers=admin_headers
    )
    
    assert resp.status_code == 400
    assert "Teacher does not teach this subject" in resp.text
