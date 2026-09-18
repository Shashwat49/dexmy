import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
import pytest
from app.models.booking import Booking

def test_student_double_booking_race_condition(client, seed_data, auth_headers, db_session):
    """
    Test that a student cannot create two overlapping bookings by exploiting race conditions.
    Even with 5 simultaneous requests, only 1 should succeed.
    """
    student = seed_data["student"]
    subject = seed_data["subject"]
    headers = auth_headers(student.id, "student")
    
    # Target exactly tomorrow at 10 AM IST (Valid slot)
    tomorrow = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=1)
    slot_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 10, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    payload = {
        "subject_id": subject.id,
        "scheduled_at": slot_time.isoformat(),
        # Generate random idempotency keys to ensure it's not blocked by idempotency
        # but blocked by the EXCLUDE constraint or SELECT FOR UPDATE
    }
    
    # We must provide free class use or package for booking. We assume endpoints handle demo or free class.
    # We will hit the standard booking endpoint. Let's just pass idempotency_key in payload.
    
    def make_request(i):
        req_payload = payload.copy()
        req_payload["idempotency_key"] = str(uuid.uuid4())
        return client.post("/api/v1/bookings/", json=req_payload, headers=headers)
    
    num_requests = 5
    with ThreadPoolExecutor(max_workers=num_requests) as executor:
        responses = list(executor.map(make_request, range(num_requests)))
    
    # We expect exactly 1 success (201 or 200) and 4 conflicts (409) or bad requests depending on logic.
    successes = [r for r in responses if r.status_code in (200, 201)]
    conflicts = [r for r in responses if r.status_code == 409]
    
    assert len(successes) == 1, f"Expected exactly 1 successful booking, got {len(successes)}"
    assert len(conflicts) == num_requests - 1, f"Expected {num_requests - 1} conflicts, got {len(conflicts)}"
    
    # Verify DB state
    bookings = db_session.query(Booking).filter_by(student_id=student.id).all()
    assert len(bookings) == 1


def test_admin_assignment_race_condition(client, seed_data, auth_headers, db_session):
    """
    Test that two admins cannot assign different teachers to the same booking concurrently.
    """
    admin = seed_data["admin"]
    student = seed_data["student"]
    subject = seed_data["subject"]
    teacher1 = seed_data["teacher1"]
    teacher2 = seed_data["teacher2"]
    
    admin_headers = auth_headers(admin.id, "admin")
    
    # Pre-create a confirmed booking
    tomorrow = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=1)
    slot_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 14, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    booking = Booking(
        id=uuid.uuid4(),
        student_id=student.id,
        subject_id=subject.id,
        scheduled_at=slot_time,
        status="confirmed",
        teacher_assignment_status="pending",
        duration_minutes=55
    )
    db_session.add(booking)
    db_session.commit()
    
    def assign_teacher(teacher_id):
        return client.post(
            f"/api/v1/bookings/{booking.id}/assign-teacher",
            json={"teacher_id": str(teacher_id)},
            headers=admin_headers
        )
    
    # We fire two requests simultaneously, one for teacher1 and one for teacher2
    teachers = [teacher1.id, teacher2.id]
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(assign_teacher, teachers))
    
    successes = [r for r in responses if r.status_code in (200, 201)]
    conflicts = [r for r in responses if r.status_code == 409]
    
    assert len(successes) == 1, "Only one teacher assignment should succeed"
    assert len(conflicts) == 1, "The second assignment should be blocked by 409 Conflict"
    
    # Check the database for the audit trail
    db_session.expire_all()
    b = db_session.get(Booking, booking.id)
    assert b.teacher_id is not None
    assert b.teacher_assignment_status == "assigned"


def test_idempotency_key_prevents_duplicate_processing(client, seed_data, auth_headers, db_session):
    """
    Test that sending the same idempotency key twice returns the same booking
    and does NOT create two records.
    """
    student = seed_data["student"]
    subject = seed_data["subject"]
    headers = auth_headers(student.id, "student")
    
    tomorrow = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=5, minutes=30))).date() + timedelta(days=1)
    slot_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 12, 0, tzinfo=timezone(timedelta(hours=5, minutes=30)))
    
    idem_key = str(uuid.uuid4())
    payload = {
        "subject_id": subject.id,
        "scheduled_at": slot_time.isoformat(),
        "idempotency_key": idem_key
    }
    
    # First request
    resp1 = client.post("/api/v1/bookings/", json=payload, headers=headers)
    assert resp1.status_code in (200, 201), resp1.text
    booking1 = resp1.json()
    
    # Second request with the same idempotency key
    resp2 = client.post("/api/v1/bookings/", json=payload, headers=headers)
    assert resp2.status_code in (200, 201), resp2.text
    booking2 = resp2.json()
    
    # Should be the exact same booking
    assert booking1["id"] == booking2["id"]
    
    # Verify only 1 row in DB
    count = db_session.query(Booking).filter_by(student_id=student.id).count()
    assert count == 1
