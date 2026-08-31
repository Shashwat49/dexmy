# Booking and Teacher Assignment Architecture

This document describes the architectural flow, database constraints, and API behaviors for the booking system.

## 1. Final Architecture

The booking system handles real-time concurrency by moving all conflict resolution and validation down to the database level, ensuring that race conditions cannot bypass the system rules regardless of how many requests are fired simultaneously.

### Core Database Constraints
We employ **PostgreSQL EXCLUDE USING GIST** constraints to provide physical guarantees against double-booking.

- **Student Conflict Protection**:
  ```sql
  EXCLUDE USING GIST (
      student_id WITH =,
      tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'completed', 'no_show'))
  ```
- **Teacher Conflict Protection**:
  Same logic applied to `teacher_id` to ensure a teacher cannot be assigned to overlapping classes.

### Idempotency
An `idempotency_key` (UUID) has been added to the `bookings` table with a `UNIQUE` index. This guarantees that duplicate network requests (from retries or impatient users) return the exact same booking record instead of attempting to create duplicates.

---

## 2. Booking Lifecycle

A booking transitions through several states, categorized under two main pillars:

### A. Booking Status (`status`)
1. **pending** — The booking is requested but not yet fully confirmed/paid.
2. **confirmed** — The booking is active and upcoming.
3. **cancelled** — The student or admin cancelled the booking.
4. **completed** — The class was conducted successfully.
5. **no_show** — The class was scheduled but not attended.

### B. Teacher Assignment Status (`teacher_assignment_status`)
1. **pending** — Default state when a booking is created. No teacher is assigned yet.
2. **assigned** — A teacher has been successfully allocated to the booking.
3. **failed** — The system or admin could not find a suitable teacher.

---

## 3. API Behavior

### Creating a Booking
**Endpoint**: `POST /api/v1/bookings/`

- Validates that the requested `scheduled_at` time falls on the hour or half-hour (e.g., `10:00`, `10:30`).
- Validates that `scheduled_at` is at least 12 hours in the future.
- Uses `SELECT FOR UPDATE` on the student package/credits to prevent race conditions during credit deduction.
- Inserts the booking using the `idempotency_key`. If the `EXCLUDE` constraint detects a time overlap, it raises a `409 Conflict`.

### Assigning a Teacher
**Endpoint**: `POST /api/v1/bookings/{id}/assign-teacher`

- Admin or internal system attempts to assign a teacher via `teacher_id`.
- Validates the teacher's qualifications (`subject_id` matches the teacher's profile).
- Validates the teacher's availability using Postgres `EXCLUDE` constraints.
- Employs a row lock (`SELECT FOR UPDATE`) on the `booking` record to ensure two admins cannot assign different teachers simultaneously.
- Updates `teacher_id` and sets `teacher_assignment_status` to `assigned`.
- Generates an audit log entry in the `booking_assignment_audits` table.

---

## 4. Error Handling

Standard HTTP status codes are enforced at the API boundary:
- **`200 OK` / `201 Created`**: Successful operation.
- **`400 Bad Request`**: Validation errors (e.g., scheduling less than 12 hours in advance, teacher doesn't teach the subject).
- **`404 Not Found`**: Entity (student, teacher, booking) not found.
- **`409 Conflict`**: Concurrency errors. Thrown when a double-booking constraint is violated, or if the `idempotency_key` detects a duplicate but the state doesn't match.

---

## 5. Developer Notes

### Setting up the Database
The constraints and audit tables are enforced using raw SQL migrations instead of Alembic.
To set up a fresh database, run:
```bash
psql -U postgres -d your_db -f backend/sql_migrations/001_booking_constraints_and_audit.sql
```

### Running Tests Locally
To verify the concurrency logic, run the test suite:
```bash
pip install -r backend/requirements-dev.txt
pytest backend/tests/test_booking_concurrency.py
```
*(Ensure your `.env` contains a valid `DATABASE_URL` pointing to a PostgreSQL database, as SQLite does not support `tstzrange` or `GIST` constraints).*
