import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.constants import (
    CLASS_DURATION_MINUTES,
    SLOT_DURATION_MINUTES,
)

from app.models.booking import (
    Booking,
    BookingStatus,
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