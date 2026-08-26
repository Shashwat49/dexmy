import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import (
    CLASS_DURATION_MINUTES,
    SLOT_DURATION_MINUTES,
)

from app.models.booking import (
    Booking,
    BookingStatus,
    TeacherAssignmentStatus,
)

from app.models.classroom import (
    ClassSession,
)

from app.models.teacher import (
    Subject,
    TeacherProfile,
    TeacherSubject,
)

from app.models.user import (
    User,
    UserRole,
)

from app.models.free_class import (
    StudentFreeClassUse,
)

from app.services.scheduling_service import (
    get_slot_capacity as calculate_scheduling_capacity,
    can_accept_booking,
)



# ============================================================
# BOOKING CONFIGURATION
# ============================================================

IST = ZoneInfo("Asia/Kolkata")

BOOKING_START_HOUR = 10
BOOKING_END_HOUR = 22

FREE_CLASS_LIMIT = 2


# ============================================================
# DATE / TIME HELPERS
# ============================================================

def get_now_ist() -> datetime:
    """
    Return the current datetime in India Standard Time.
    """
    return datetime.now(IST)


def get_tomorrow_ist() -> date:
    """
    Return tomorrow's calendar date according to IST.
    """
    return get_now_ist().date() + timedelta(days=1)


def generate_tomorrow_slots() -> list[datetime]:
    """
    Generate all valid booking start times for tomorrow.

    Valid start times:

        10:00 AM
        11:00 AM
        12:00 PM
        1:00 PM
        ...
        8:00 PM
        9:00 PM

    The booking window ends at 10:00 PM,
    therefore 9:00 PM is the final start time.

    All values are timezone-aware IST datetimes.
    """

    tomorrow = get_tomorrow_ist()

    slots: list[datetime] = []

    for hour in range(
        BOOKING_START_HOUR,
        BOOKING_END_HOUR,
    ):
        slot = datetime.combine(
            tomorrow,
            time(hour, 0),
            tzinfo=IST,
        )

        slots.append(slot)

    return slots


# ============================================================
# TEACHER ELIGIBILITY
# ============================================================

def get_eligible_teacher_ids(
    db: Session,
    subject_id: int,
) -> list[uuid.UUID]:
    """
    Return active + verified teachers who teach
    the requested subject.

    IMPORTANT:

    This answers only:

        "Who is qualified to teach this subject?"

    It does NOT mean those teachers are currently free.

    Teacher occupancy is handled by scheduling_service.py.
    """

    teachers = (
        db.query(
            TeacherProfile.user_id
        )
        .join(
            TeacherSubject,
            TeacherSubject.teacher_id
            == TeacherProfile.user_id,
        )
        .join(
            User,
            User.id
            == TeacherProfile.user_id,
        )
        .filter(
            TeacherSubject.subject_id
            == subject_id,

            TeacherProfile.is_verified.is_(
                True
            ),

            User.is_active.is_(True),

            User.role
            == UserRole.teacher,
        )
        .distinct()
        .all()
    )

    return [
        teacher_id
        for (
            teacher_id,
        ) in teachers
    ]


# ============================================================
# SLOT CAPACITY
# ============================================================

def get_slot_capacity(
    db: Session,
    subject_id: int,
    slot: datetime,
) -> int:
    """
    Calculate how many additional students can safely
    book this subject at this slot.

    IMPORTANT:

    Capacity is now delegated entirely to the centralized
    scheduling engine.

    The scheduling engine considers:

        - teacher qualification
        - multi-subject teachers
        - occupied teachers
        - assigned bookings
        - unassigned bookings
        - subject-specific matching
        - maximum bipartite matching

    This function intentionally contains NO duplicate
    teacher-capacity algorithm.
    """

    return calculate_scheduling_capacity(
        db=db,
        subject_id=subject_id,
        slot_start=slot,
    )


# ============================================================
# AVAILABLE SLOTS
# ============================================================

def get_available_slots(
    db: Session,
    subject_id: int,
) -> list[dict]:
    """
    Return tomorrow's booking slots and their availability.

    Rules:

        - Tomorrow only
        - 10 AM through 9 PM start time
        - 60-minute scheduling slots
        - 55-minute actual class
        - 5-minute buffer
        - Teacher selection is handled by admin
    """

    # --------------------------------------------------------
    # Make sure subject exists.
    # --------------------------------------------------------

    subject = db.get(
        Subject,
        subject_id,
    )

    if subject is None:
        return []

    slots = generate_tomorrow_slots()

    results: list[dict] = []

    for slot in slots:

        capacity = get_slot_capacity(
            db=db,
            subject_id=subject_id,
            slot=slot,
        )

        slot_end = (
            slot
            + timedelta(
                minutes=SLOT_DURATION_MINUTES
            )
        )

        results.append(
            {
                "start": slot,
                "end": slot_end,
                "available": capacity > 0,
                "remaining_capacity": capacity,
            }
        )

    return results


# ============================================================
# VALIDATE REQUESTED SLOT
# ============================================================

def validate_requested_slot(
    requested_slot: datetime,
) -> datetime:
    """
    Validate and normalize a student's requested
    booking slot.

    Rules:

        1. Must represent tomorrow in IST.
        2. Must be between 10 AM and 9 PM start time.
        3. Must be exactly on an hourly boundary.
    """

    # --------------------------------------------------------
    # Timezone must be supplied.
    # --------------------------------------------------------

    if requested_slot.tzinfo is None:
        raise ValueError(
            "scheduled_at must include a timezone."
        )

    requested_ist = (
        requested_slot.astimezone(
            IST
        )
    )

    tomorrow = get_tomorrow_ist()

    # --------------------------------------------------------
    # Tomorrow only.
    # --------------------------------------------------------

    if requested_ist.date() != tomorrow:
        raise ValueError(
            "Classes can only be booked for tomorrow."
        )

    # --------------------------------------------------------
    # Exact hourly slot.
    # --------------------------------------------------------

    if (
        requested_ist.minute != 0
        or requested_ist.second != 0
        or requested_ist.microsecond != 0
    ):
        raise ValueError(
            "Please select one of the available hourly slots."
        )

    # --------------------------------------------------------
    # 10 AM through 9 PM start time.
    # --------------------------------------------------------

    if not (
        BOOKING_START_HOUR
        <= requested_ist.hour
        < BOOKING_END_HOUR
    ):
        raise ValueError(
            "Classes can only be booked between "
            "10:00 AM and 10:00 PM IST."
        )

    # --------------------------------------------------------
    # Return normalized IST datetime.
    # --------------------------------------------------------

    return requested_ist


# ============================================================
# FREE CLASS STATUS
# ============================================================

def get_free_class_status(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
) -> tuple[bool, int]:
    """
    Determine whether the student can use a free class.

    Rules:

        - Maximum 2 free classes.
        - A free class cannot be reused for the same subject.
    """

    used_subjects = (
        db.query(
            StudentFreeClassUse.subject_id
        )
        .filter(
            StudentFreeClassUse.student_id
            == student_id
        )
        .all()
    )

    used_subject_ids = {
        row[0]
        for row in used_subjects
    }

    # --------------------------------------------------------
    # Already used free class for this subject.
    # --------------------------------------------------------

    if subject_id in used_subject_ids:
        return False, 0

    remaining = max(
        FREE_CLASS_LIMIT
        - len(used_subject_ids),
        0,
    )

    return (
        remaining > 0,
        remaining,
    )


# ============================================================
# ATOMIC BOOKING CREATION
# ============================================================

def create_booking_atomic(
    db: Session,
    *,
    student_id: uuid.UUID,
    subject_id: int,
    scheduled_at: datetime,
    price: float,
    idempotency_key: uuid.UUID | None = None,
) -> Booking:
    """
    Create a booking atomically, preventing race conditions.

    This function owns the complete transactional flow:

        1. Idempotency check — return existing booking if key matches.
        2. SELECT FOR UPDATE on the student row — serializes
           concurrent requests from the same student.
        3. Re-validate slot inside the lock — ensures the slot
           is still available after acquiring the lock.
        4. Insert Booking + StudentFreeClassUse + ClassSession
           in a single flush before commit.

    The caller is responsible for:
        - Validating the requested slot BEFORE calling this.
        - Determining the price.
        - Calling db.commit() after this function returns.

    Raises:
        ValueError: if the slot is no longer bookable
                    (student conflict or no eligible teacher).

    IMPORTANT:
        The database-level exclusion constraint (added in PR #4)
        is the final safety net. This function is the second
        line of defence at the application layer.
    """

    # --------------------------------------------------------
    # Idempotency check.
    #
    # If the client already submitted this request and received
    # a response (or the response was lost), return the existing
    # booking instead of creating a duplicate.
    # --------------------------------------------------------

    if idempotency_key is not None:

        existing = (
            db.query(Booking)
            .filter(
                Booking.idempotency_key
                == idempotency_key,
            )
            .first()
        )

        if existing is not None:
            return existing

    # --------------------------------------------------------
    # Acquire a row-level lock on the student's user record.
    #
    # WHY:
    #   Two concurrent booking requests from the same student
    #   could both pass can_accept_booking() before either
    #   commits, resulting in duplicate bookings.
    #
    #   Locking the student row serializes requests — the
    #   second request blocks here until the first has
    #   committed, then sees the first booking and fails the
    #   capacity check below.
    #
    # NOTE:
    #   This does NOT prevent two DIFFERENT students from
    #   simultaneously filling the last slot. The DB-level
    #   exclusion constraint (PR #4) handles that case.
    # --------------------------------------------------------

    db.execute(
        select(User)
        .where(User.id == student_id)
        .with_for_update()
    )

    # --------------------------------------------------------
    # Re-validate inside the lock.
    #
    # The slot must still be available after acquiring the lock.
    # --------------------------------------------------------

    can_book, scheduling_error = can_accept_booking(
        db=db,
        student_id=student_id,
        subject_id=subject_id,
        slot_start=scheduled_at,
    )

    if not can_book:
        raise ValueError(
            scheduling_error
            or "This time slot is no longer available."
        )

    # --------------------------------------------------------
    # Create the booking.
    # --------------------------------------------------------

    booking = Booking(
        student_id=student_id,

        # Teacher is intentionally NULL.
        # Admin assigns teacher later.
        teacher_id=None,

        subject_id=subject_id,

        scheduled_at=scheduled_at,

        duration_minutes=CLASS_DURATION_MINUTES,

        # Booking is immediately confirmed.
        # Pending → Confirmed is the first lifecycle step.
        status=BookingStatus.confirmed,

        price=price,

        # Teacher assignment is pending.
        teacher_assignment_status=(
            TeacherAssignmentStatus.pending.value
        ),

        idempotency_key=idempotency_key,
    )

    db.add(booking)

    # flush to get booking.id before creating dependent records
    db.flush()

    # --------------------------------------------------------
    # Consume the free class entitlement.
    # --------------------------------------------------------

    if price == 0:

        free_use = StudentFreeClassUse(
            student_id=student_id,
            subject_id=subject_id,
            booking_id=booking.id,
        )

        db.add(free_use)

    # --------------------------------------------------------
    # Create the classroom session.
    # --------------------------------------------------------

    session = ClassSession(
        booking_id=booking.id,
        livekit_room_name=(
            f"dexmy-class-{booking.id}"
        ),
    )

    db.add(session)

    # --------------------------------------------------------
    # Flush all changes.
    #
    # The caller must call db.commit() to finalize.
    # --------------------------------------------------------

    db.flush()

    return booking


# ============================================================
# CANCEL BOOKING (atomic helper)
# ============================================================

def cancel_booking_atomic(
    db: Session,
    *,
    booking: Booking,
) -> Booking:
    """
    Cancel a booking and synchronize all dependent records
    in a single atomic operation.

    Actions:
        1. Acquire SELECT FOR UPDATE lock on the booking row.
        2. Set booking.status = cancelled.
        3. Set the linked ClassSession.status = cancelled.
        4. Delete the StudentFreeClassUse record if the booking
           was free — restoring the student's free-class credit.

    The caller is responsible for:
        - Verifying ownership before calling this.
        - Calling db.commit() after this function returns.

    Raises:
        ValueError: if the booking is already in a terminal
                    state (cancelled / completed).
    """

    # --------------------------------------------------------
    # Acquire row-level lock on the booking.
    #
    # WHY:
    #   Two concurrent cancel requests (or a cancel racing with
    #   a teacher assignment) could create inconsistent state.
    #   The lock ensures only one writer proceeds at a time.
    # --------------------------------------------------------

    locked_booking = db.execute(
        select(Booking)
        .where(Booking.id == booking.id)
        .with_for_update()
    ).scalar_one()

    # --------------------------------------------------------
    # Guard against invalid status transitions.
    # --------------------------------------------------------

    if locked_booking.status in (
        BookingStatus.cancelled,
        BookingStatus.completed,
    ):
        raise ValueError(
            "Booking is already in a terminal state "
            f"({locked_booking.status.value}) "
            "and cannot be cancelled."
        )

    # --------------------------------------------------------
    # Cancel the booking.
    # --------------------------------------------------------

    locked_booking.status = BookingStatus.cancelled

    # --------------------------------------------------------
    # Cancel the linked classroom session.
    #
    # WHY:
    #   Without this, the ClassSession remains in 'scheduled'
    #   state, giving the impression of an active class.
    #   The classroom layer must respect booking status.
    # --------------------------------------------------------

    from app.models.classroom import SessionStatus

    session = (
        db.query(ClassSession)
        .filter(
            ClassSession.booking_id
            == locked_booking.id
        )
        .first()
    )

    if session is not None:
        session.status = SessionStatus.cancelled

    # --------------------------------------------------------
    # Restore free-class credit.
    #
    # BUSINESS RULE:
    #   If the student cancels a booking that used their free
    #   class, the free-class entitlement is restored.
    #   This lets the student rebook for free later.
    #
    #   This is safe because StudentFreeClassUse has a UNIQUE
    #   constraint on (student_id, subject_id), so the credit
    #   can only be re-consumed once per subject.
    # --------------------------------------------------------

    if locked_booking.price == 0:

        free_use = (
            db.query(StudentFreeClassUse)
            .filter(
                StudentFreeClassUse.booking_id
                == locked_booking.id
            )
            .first()
        )

        if free_use is not None:
            db.delete(free_use)

    db.flush()

    return locked_booking