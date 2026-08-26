# Deliverable 1 — Technical Analysis: Dexmy Booking System

> **Task:** Task 2 — Booking Algorithm Optimization  
> **Author:** Intern (Vikash)  
> **Date:** 2026-08-26  
> **Scope:** Existing implementation analysis, problem identification, root causes, and proposed architecture

---

## 1. Existing Implementation

### 1.1 Technology Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (Python) |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Session management | SQLAlchemy `SessionLocal` — one session per request, no explicit transactions |
| Timezone handling | Python `zoneinfo` (`Asia/Kolkata`) |
| Authentication | JWT tokens via `get_current_user` dependency |

---

### 1.2 System Overview

The Dexmy platform supports **one-on-one tutoring sessions** where:

- A **student** books a 55-minute class for tomorrow in a 60-minute scheduling slot.
- An **admin** later assigns a teacher to the confirmed booking.
- The student **never chooses** the teacher directly.

---

### 1.3 Booking Flow (Current)

```
Student → GET /bookings/available-slots?subject_id=X
        ← returns slots with available=true/false and remaining_capacity

Student → POST /bookings { subject_id, scheduled_at }
        ← validates slot, checks student conflict, checks teacher capacity
        ← creates Booking (status=confirmed, teacher_id=NULL, teacher_assignment_status=pending)
        ← creates ClassSession (livekit_room_name)
        ← returns BookingDetailRead

Admin   → GET /admin/bookings/pending-teacher-assignment
        ← lists all confirmed bookings with teacher_id IS NULL

Admin   → GET /admin/bookings/{booking_id}/eligible-teachers
        ← runs can_assign_teacher() for every qualified teacher candidate
        ← returns filtered list

Admin   → POST /admin/bookings/{booking_id}/assign-teacher { teacher_id }
        ← re-validates teacher, subject, conflicts
        ← sets teacher_id, teacher_assignment_status="assigned"
        ← upserts StudentSubjectTeacher record
```

---

### 1.4 Key Files and Responsibilities

| File | Responsibility |
|---|---|
| [`bookings.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/api/v1/endpoints/bookings.py) | Student-facing booking endpoints |
| [`admin.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/api/v1/endpoints/admin.py) | Admin-facing teacher assignment endpoints |
| [`booking_service.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/services/booking_service.py) | Slot generation, slot validation, free-class tracking |
| [`scheduling_service.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/services/scheduling_service.py) | Teacher eligibility, overlap detection, bipartite matching, capacity calculation |
| [`booking.py` (model)](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/models/booking.py) | `Booking` ORM model |
| [`schema.sql`](file:///d:/GitHub%20Projects/Internship/dexmy/schema.sql) | PostgreSQL DDL |
| [`constants.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/core/constants.py) | `CLASS_DURATION_MINUTES=55`, `SLOT_DURATION_MINUTES=60` |
| [`session.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/db/session.py) | SQLAlchemy engine/session factory |

---

### 1.5 Scheduling Algorithm

The scheduling engine in [`scheduling_service.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/services/scheduling_service.py) is the most sophisticated part of the system. It uses **maximum bipartite matching** (Hopcroft-Karp style DFS augmentation) to answer:

> "If we add this booking, can every booking in this slot still be assigned to a distinct qualified teacher?"

**Step-by-step:**

1. `get_eligible_teacher_ids(db, subject_id)` — returns active + verified teachers for a subject.
2. `get_active_bookings_for_interval(db, start, end)` — returns all non-cancelled/completed bookings overlapping the interval.
3. `get_occupied_teacher_ids(bookings)` — teachers already assigned to some booking in the slot.
4. `get_available_teacher_ids(eligible, occupied)` — subtracts occupied from eligible.
5. `build_teacher_graph(bookings, teachers, subject_map)` — constructs bipartite graph: booking → list of qualified teachers.
6. `find_maximum_matching(graph)` — runs augmenting-path matching; most-constrained bookings first.
7. `MatchingResult.is_fully_assignable` — true only when matched = total unassigned bookings.

**Slot capacity check:**

`get_slot_capacity()` runs the matching **repeatedly** (existing + 1, + 2, ...) until the slot becomes non-schedulable. The returned count is the remaining capacity for a specific subject at a specific time.

**Booking acceptance check:**

`can_accept_booking()` first checks the student's own overlapping bookings, then runs matching with a synthetic new booking added.

**Teacher assignment check:**

`can_assign_teacher()` verifies: teacher active/verified → teaches subject → no teacher overlap → no student overlap → assigning this teacher still leaves other unassigned bookings satisfiable.

---

### 1.6 Slot Validation

`validate_requested_slot()` in [`booking_service.py`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/services/booking_service.py) enforces:

- `scheduled_at` must include timezone info.
- Must represent tomorrow in IST.
- Must be exactly on an hourly boundary (minute=0, second=0, microsecond=0).
- Must fall in `[10:00, 22:00)` IST.

---

### 1.7 Database Schema Summary

**`bookings` table (relevant columns):**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `student_id` | UUID FK → users | NOT NULL |
| `teacher_id` | UUID FK → teacher_profiles | **NULLABLE** — set after admin assigns |
| `subject_id` | INT FK → subjects | NOT NULL |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL |
| `duration_minutes` | INT | DEFAULT 60 |
| `status` | `booking_status` ENUM | `pending/confirmed/cancelled/completed/no_show` |
| `price` | NUMERIC | Nullable |
| `teacher_assignment_status` | VARCHAR(20) | `"pending"` / `"assigned"` — **plain string, no enum, no constraint** |

**Indexes on `bookings`:** `student_id`, `teacher_id`, `scheduled_at`.

**No unique constraints** on `(student_id, scheduled_at)` or `(teacher_id, scheduled_at)`.

---

## 2. Existing Problems

### 2.1 Race Conditions & Concurrency (CRITICAL)

#### P1 — No Atomic Booking Protection
The booking creation in [`bookings.py:192–277`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/api/v1/endpoints/bookings.py#L192-L277) follows a **check-then-insert** pattern:

```python
can_book, error = can_accept_booking(...)  # CHECK (reads DB)
if not can_book:
    raise HTTPException(...)
# ... time passes — another request can slip in here ...
booking = Booking(...)
db.add(booking)
db.flush()
# ... more work ...
db.commit()                                 # INSERT (writes DB)
```

Between the capacity check and the commit, another request can pass the same check and create a conflicting booking. **Two students can book the same slot simultaneously** and both succeed.

#### P2 — No Atomic Teacher Assignment Protection
`assign_teacher` in [`admin.py:387–712`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/api/v1/endpoints/admin.py#L387-L712) has the same pattern:

```python
# Re-validates conflicts...
booking.teacher_id = teacher.id  # No row lock
db.commit()
```

Two admins assigning the same teacher to two different bookings at the same time can both pass the overlap check and both commit, creating a double-booked teacher.

#### P3 — No `SELECT FOR UPDATE` / Row-Level Locking
Neither the booking creation nor the teacher assignment acquires any pessimistic or optimistic lock on the affected rows before modifying them.

#### P4 — No Idempotency / Duplicate Request Protection
Double-clicking "Book" or a network retry will submit two identical requests. Both can pass `can_accept_booking()` before either commits, resulting in **two bookings for the same student at the same time**.

---

### 2.2 Database Constraints (CRITICAL)

#### P5 — No Unique Constraint on Student + Slot
There is no `UNIQUE(student_id, scheduled_at)` or exclusion constraint on the `bookings` table. The application-layer check is the only protection, which is bypassed under concurrent load.

#### P6 — No Unique Constraint on Teacher + Slot
There is no constraint preventing two confirmed bookings from having the same `teacher_id` and overlapping `scheduled_at`. The only protection is the application check.

#### P7 — `teacher_assignment_status` Is a Plain String
The column is `VARCHAR(20)` with no CHECK constraint and no Enum. Valid values like `"pending"` and `"assigned"` are enforced only by convention. Any string can be stored.

#### P8 — Booking Status Does Not Match Schema Lifecycle
The schema defines: `pending → confirmed → cancelled/completed/no_show`.
The code **skips `pending`** entirely — new bookings are inserted as `confirmed` immediately. There is no lifecycle guard preventing invalid transitions (e.g., `confirmed → confirmed`, or `cancelled → completed`).

#### P9 — `duration_minutes` Defaults to 60 in DB, 55 in Code
- Schema: `duration_minutes INTEGER NOT NULL DEFAULT 60`
- Constants: `CLASS_DURATION_MINUTES = 55`, `SLOT_DURATION_MINUTES = 60`
- Code inserts with `duration_minutes=CLASS_DURATION_MINUTES` (55)

The DB default (60) and the code-assigned value (55) differ. If a row is ever inserted without explicit `duration_minutes`, the DB will store 60 minutes while conflict detection logic uses 55, potentially allowing overlapping bookings to slip through.

#### P10 — `bookings.teacher_id` Is a Hard FK (`ON DELETE CASCADE`)
If a `teacher_profiles` row is deleted, all their bookings cascade-delete silently. A student would lose their booking history. A `SET NULL` or `RESTRICT` policy is more appropriate for this use case.

---

### 2.3 Timezone Handling

#### P11 — `scheduling_service.py` Uses Naive Datetimes Internally
`intervals_overlap()`, `get_booking_end()`, and all the bipartite matching logic operate on Python `datetime` objects. These objects may be **timezone-aware** (from `booking.scheduled_at`) or **naive** if any code path creates a datetime without `tzinfo`. No defensive check is performed. A naive vs. aware comparison raises a `TypeError` at runtime.

#### P12 — Stale "Tomorrow" Window
`get_tomorrow_ist()` is called at request time. Near midnight IST, a student could:
1. Open the slot picker at 11:59 PM IST (showing tomorrow = Aug 27).
2. Select a slot.
3. Submit the booking request at 12:01 AM IST (tomorrow is now Aug 28).

`validate_requested_slot()` will reject the booking because the selected date is no longer "tomorrow." This is a UX cliff, not a data-corruption risk, but it should be documented and handled gracefully.

---

### 2.4 Booking Status Lifecycle

#### P13 — Missing Lifecycle States
The task specification requires the following lifecycle:

```
PENDING → CONFIRMED → TEACHER_ASSIGNED → SCHEDULED → COMPLETED
```

The current system only uses:

```
(implicitly pending) → confirmed ← (booking created here)
                                → cancelled
                                → completed (no automation)
                                → no_show (no automation)
```

`TEACHER_ASSIGNED` and `SCHEDULED` are entirely absent as booking statuses. `teacher_assignment_status` is a separate free-text field attempting to cover this gap.

#### P14 — No Status Transition Guards
There is no state machine or guard preventing:
- A `cancelled` booking receiving a teacher assignment.
- A `completed` booking being cancelled.
- Any arbitrary status jump.

The cancel endpoint does guard against cancelling already-closed bookings, but this is the only guard in the system.

---

### 2.5 Teacher Assignment (Design Gaps)

#### P15 — `assign_teacher` Duplicates `can_assign_teacher`
The admin endpoint [`admin.py:387–615`](file:///d:/GitHub%20Projects/Internship/dexmy/backend/app/api/v1/endpoints/admin.py#L387-L615) manually re-checks: teacher exists → role → active → verified → teaches subject → teacher conflict → student conflict.

`can_assign_teacher()` in `scheduling_service.py` already does all of these checks. The endpoint partially delegates to `can_assign_teacher()` only for the eligible-teachers list (GET), but performs its own duplicate checks for the actual assignment (POST). This **double logic creates a maintenance hazard** — a fix in one place won't automatically fix the other.

#### P16 — No Audit Trail for Teacher Assignments
When a teacher is assigned, there is no record of:
- Which admin made the assignment.
- When the assignment was made.
- What the previous teacher was (if reassignment is ever needed).

#### P17 — `list_eligible_teachers` Is O(n × matching cost)
For every qualified teacher candidate, the endpoint runs `can_assign_teacher()` which internally runs the bipartite matching algorithm. This is an expensive N-query loop. For a large teacher pool, this endpoint will be slow.

#### P18 — Teacher Reassignment Not Supported
There is no reassignment endpoint. If a teacher becomes unavailable after assignment, an admin must manually cancel and rebook, with no automated workflow.

---

### 2.6 Cancellation & Booking Lifecycle

#### P19 — Cancellation Does Not Free ClassSession
When a booking is cancelled, `ClassSession` records are **not** updated. The `livekit_room_name` room remains allocated. The session status remains `scheduled`. A student who navigates to the session endpoint after cancellation would still see the session object.

#### P20 — No Rescheduling Endpoint
There is no endpoint to reschedule a booking. A student must cancel and re-book, which uses up a free class slot unnecessarily.

---

### 2.7 API & Security

#### P21 — No Rate Limiting on Booking Creation
A determined user or a double-click can fire multiple simultaneous POST requests. There is no rate-limiting middleware or idempotency key mechanism.

#### P22 — Booking ID Enumerable (Low Risk with UUID)
Booking IDs are UUIDs, which is good. However, the ownership check for cancel/session-access only checks `student_id` and `teacher_id`, not that the user's role is appropriate. An admin cancelling a student's booking via the student endpoint would fail authorization correctly, but the role-check is implicit in the allowed-IDs set rather than explicit.

#### P23 — `subject_id` Not Validated Against Student Permissions
Any authenticated student can book any valid `subject_id`. There is no check whether the student is enrolled in or permitted to book that subject.

---

### 2.8 Performance

#### P24 — Slot Capacity Is Computed Per-Slot Per-Request
`get_available_slots()` iterates all 12 hourly slots and calls `get_slot_capacity()` for each. Each capacity call:
1. Fetches all bookings for the interval.
2. Fetches eligible teachers.
3. Runs maximum bipartite matching (potentially many times in a loop).

For a production system with many concurrent users fetching available slots, this is **O(12 × n_teachers × matching_iterations)** per request, with no caching.

#### P25 — N+1 Queries in List Endpoints
`list_my_bookings()` and `list_pending_teacher_assignments()` fetch bookings in bulk, then call `db.get(User, ...)` and `db.get(Subject, ...)` per row. This is a classic **N+1 query problem**.

---

## 3. Root Causes

| Root Cause | Problems Caused |
|---|---|
| **No database-level uniqueness constraints on booking slots** | P1, P2, P4, P5, P6 — any concurrent requests bypass the application-layer checks |
| **No pessimistic or optimistic locking (no `SELECT FOR UPDATE`)** | P1, P2, P3 — race window between check and insert/update |
| **No explicit transaction demarcation around check+insert** | P1, P4 — the implicit autocommit boundary does not prevent read-then-write races |
| **`teacher_assignment_status` is a plain VARCHAR with no constraint** | P7 — arbitrary invalid values can enter the DB |
| **No booking lifecycle state machine** | P8, P13, P14 — invalid status transitions are not prevented |
| **Duplicated validation logic between endpoint and service** | P15 — inconsistency risk over time |
| **No audit/logging table for assignment changes** | P16 — no observability for admin actions |
| **No ClassSession lifecycle management on cancel** | P19 — orphaned session records |
| **No caching for slot capacity** | P24 — expensive per-request computation |
| **No join-based loading for list endpoints** | P25 — N+1 query patterns |
| **Inconsistent `duration_minutes` default** | P9 — potential silent conflict-check errors |

---

## 4. Proposed Architecture

### 4.1 Guiding Principles

> **The database is the source of truth. Every critical business rule must be enforced at the database level, with the application layer as a second line of defence.**

1. Use **database constraints** (unique, exclusion, check) to enforce booking rules.
2. Use **`SELECT FOR UPDATE`** to serialize concurrent booking and assignment operations.
3. Wrap check+insert in a **single explicit transaction** with the row lock held throughout.
4. Introduce a **formal booking lifecycle** enforced by both application and DB check constraint.
5. Consolidate validation logic into a **single canonical service function**, called from both eligibility-listing and assignment endpoints.
6. Add an **audit log** for teacher assignment changes.

---

### 4.2 Booking Lifecycle (Proposed)

```
PENDING
  │
  ▼ (booking created by student; teacher not yet assigned)
CONFIRMED
  │
  ▼ (admin assigns a teacher)
TEACHER_ASSIGNED
  │
  ▼ (class starts / auto-triggered)
SCHEDULED  ← (live session active)
  │
  ▼
COMPLETED
  │ ← also: CANCELLED (from PENDING/CONFIRMED/TEACHER_ASSIGNED)
  │ ← also: NO_SHOW
```

Add a DB `CHECK` constraint enforcing valid transitions. Use a Python state machine in the service layer.

---

### 4.3 Database Changes (Proposed for Deliverable 3)

#### Exclusion Constraint — Student Cannot Double-Book
```sql
ALTER TABLE bookings
ADD CONSTRAINT no_student_double_booking
EXCLUDE USING GIST (
    student_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
)
WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
```
*Requires `btree_gist` extension.*

#### Exclusion Constraint — Teacher Cannot Double-Book
```sql
ALTER TABLE bookings
ADD CONSTRAINT no_teacher_double_booking
EXCLUDE USING GIST (
    teacher_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
)
WHERE (teacher_id IS NOT NULL AND status NOT IN ('cancelled', 'completed', 'no_show'));
```

#### Enum + Check on `teacher_assignment_status`
Convert `VARCHAR` to a proper enum or add a `CHECK` constraint:
```sql
ALTER TABLE bookings
ADD CONSTRAINT chk_teacher_assignment_status
CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed'));
```

#### Booking Status Enum Update
Add `teacher_assigned` and `scheduled` to the `booking_status` PostgreSQL enum.

#### Audit Table
```sql
CREATE TABLE booking_assignment_audit (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings(id),
    admin_id     UUID NOT NULL REFERENCES users(id),
    prev_teacher UUID REFERENCES teacher_profiles(user_id),
    new_teacher  UUID REFERENCES teacher_profiles(user_id),
    action       VARCHAR(30) NOT NULL, -- 'assigned', 'reassigned', 'unassigned'
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Fix `duration_minutes` Default
```sql
ALTER TABLE bookings ALTER COLUMN duration_minutes SET DEFAULT 55;
```

---

### 4.4 Booking Creation (Proposed)

Replace the current check-then-insert with a **locked transaction**:

```python
with db.begin():
    # 1. Lock the student row to serialize concurrent requests from same student
    db.execute(
        select(User).where(User.id == student_id).with_for_update()
    )

    # 2. Re-validate (inside the lock)
    validate_requested_slot(payload.scheduled_at)
    can_book, error = can_accept_booking(db, student_id, subject_id, slot_start)
    if not can_book:
        raise HTTPException(409, error)

    # 3. Insert booking
    booking = Booking(status=BookingStatus.confirmed, ...)
    db.add(booking)
    db.flush()

    # 4. Create session
    session = ClassSession(booking_id=booking.id, ...)
    db.add(session)
    # commit happens on context manager exit
```

The DB-level exclusion constraint is the **final guarantee** even if two requests race past the application check.

---

### 4.5 Teacher Assignment (Proposed)

Replace the duplicated checks with a single service function and a row lock:

```python
with db.begin():
    # Lock the booking row
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id).with_for_update()
    ).scalar_one_or_none()

    # Single canonical check
    can_assign, reason = can_assign_teacher(db, booking=booking, teacher_id=teacher_id)
    if not can_assign:
        raise HTTPException(409, reason)

    # Assign
    prev_teacher = booking.teacher_id
    booking.teacher_id = teacher_id
    booking.teacher_assignment_status = "assigned"
    booking.status = BookingStatus.teacher_assigned

    # Audit
    db.add(BookingAssignmentAudit(
        booking_id=booking.id,
        admin_id=current_user.id,
        prev_teacher=prev_teacher,
        new_teacher=teacher_id,
        action="assigned" if prev_teacher is None else "reassigned",
    ))
```

---

### 4.6 Idempotency

For booking creation, accept an optional client-supplied `idempotency_key` (UUID). Store it on the booking row. Before insert, check if a booking with the same key exists. If yes, return it directly. This safely handles retries and double-submits.

```sql
ALTER TABLE bookings ADD COLUMN idempotency_key UUID UNIQUE;
```

---

### 4.7 Timezone Hardening

- All `datetime` objects entering the scheduling service must be **timezone-aware** UTC. Add a guard at service entry:
  ```python
  assert slot_start.tzinfo is not None, "slot_start must be tz-aware"
  ```
- Store `scheduled_at` in UTC in the DB (`TIMESTAMPTZ` already does this correctly).
- Display conversion to IST happens at the API response layer only.
- "Tomorrow" calculation uses `datetime.now(ZoneInfo("Asia/Kolkata")).date() + timedelta(days=1)` — already correct. Add a tolerance for near-midnight submissions.

---

### 4.8 Cancellation Hardening

When a booking is cancelled:
1. Update `booking.status = cancelled`.
2. Update the related `ClassSession.status = cancelled`.
3. Free any `StudentFreeClassUse` if the booking was free (policy decision — document clearly).
4. All in one transaction.

---

### 4.9 Performance Improvements

- **Eager loading:** Use `joinedload` in list endpoints to eliminate N+1 queries.
- **Slot capacity caching:** Cache computed slot capacity per `(subject_id, slot_start)` for a short TTL (e.g., 10 seconds) using an in-process cache or Redis, to avoid expensive re-computation on concurrent GET requests.
- **Batch eligible-teacher check:** Instead of calling `can_assign_teacher()` per teacher in a Python loop, pre-compute occupied teacher IDs in bulk and filter in SQL, then run matching once.

---

## 5. Summary of Critical Risk Areas

| Severity | Problem | Impact |
|---|---|---|
| 🔴 CRITICAL | No atomic booking — race between check and insert | Duplicate bookings |
| 🔴 CRITICAL | No atomic teacher assignment | Teacher double-booked |
| 🔴 CRITICAL | No DB constraints on slot uniqueness | Corrupted data |
| 🟠 HIGH | No idempotency | Duplicate bookings on retry |
| 🟠 HIGH | `teacher_assignment_status` unconstrained | Invalid DB state |
| 🟠 HIGH | Booking lifecycle not enforced | Invalid status transitions |
| 🟡 MEDIUM | Duplicated assignment validation logic | Maintenance hazard |
| 🟡 MEDIUM | No audit trail | No accountability |
| 🟡 MEDIUM | ClassSession not closed on cancel | Orphaned records |
| 🟡 MEDIUM | N+1 queries in list endpoints | Performance degradation |
| 🟡 MEDIUM | No slot-capacity caching | Expensive repeated computation |
| 🟢 LOW | Near-midnight UX cliff | Poor UX, not data corruption |

---

## 6. What Is Working Well

Before moving to Deliverable 2, it is important to acknowledge what the current system gets right — **do not break these**:

- ✅ Bipartite matching for teacher capacity is correct and handles multi-subject teachers.
- ✅ Half-open interval semantics for overlap detection are correct.
- ✅ Timezone input is always validated (must include `tzinfo`).
- ✅ "Tomorrow IST" calculation is correct.
- ✅ Hourly boundary and booking window validation are correct.
- ✅ Teacher qualification (active + verified + subject) is checked at both booking and assignment time.
- ✅ `can_assign_teacher()` checks future-feasibility (won't strand other unassigned bookings).
- ✅ All booking endpoints require authentication and role checks.
- ✅ `scheduled_at` uses `TIMESTAMPTZ` — UTC stored correctly.
- ✅ Foreign keys exist for `student_id`, `teacher_id`, `subject_id`.
