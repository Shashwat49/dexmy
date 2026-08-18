import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.constants import SLOT_DURATION_MINUTES
from app.models.booking import Booking, BookingStatus
from app.models.teacher import (
    Subject,
    TeacherProfile,
    TeacherSubject,
)
from app.models.user import User, UserRole
from app.models.free_class import StudentFreeClassUse


# ============================================================
# BOOKING CONFIGURATION
# ============================================================

IST = ZoneInfo("Asia/Kolkata")

BOOKING_START_HOUR = 10
BOOKING_END_HOUR = 22

# A slot starts every hour.
# 10:00, 11:00, ..., 21:00
BOOKING_SLOT_MINUTES = 60

# Actual class duration.
CLASS_DURATION_MINUTES = 55

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

    Valid slots:

    10:00
    11:00
    12:00
    13:00
    14:00
    15:00
    16:00
    17:00
    18:00
    19:00
    20:00
    21:00

    All times are represented as timezone-aware IST datetimes.
    """

    tomorrow = get_tomorrow_ist()

    slots = []

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
    Return active + verified teachers who teach the
    requested subject.

    Students never receive this information directly.
    """

    teachers = (
        db.query(TeacherProfile.user_id)
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

            TeacherProfile.is_verified.is_(True),

            User.is_active.is_(True),

            User.role == UserRole.teacher,
        )
        .all()
    )

    return [
        teacher_id
        for (teacher_id,) in teachers
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
    Calculate how many additional students can book
    this subject at this slot.

    Capacity is based on eligible teachers.

    A teacher can only teach one class during a slot.

    Assigned teacher bookings consume teacher capacity.

    Unassigned bookings also reserve capacity because
    they still need a teacher.
    """

    eligible_teacher_ids = get_eligible_teacher_ids(
        db=db,
        subject_id=subject_id,
    )

    total_teachers = len(
        eligible_teacher_ids
    )

    if total_teachers == 0:
        return 0

    # --------------------------------------------------------
    # Find all active bookings at this exact slot.
    #
    # These include:
    #
    # - confirmed bookings
    # - pending bookings
    #
    # Cancelled/completed bookings don't consume capacity.
    # --------------------------------------------------------

    bookings = (
        db.query(Booking)
        .filter(
            Booking.scheduled_at == slot,

            Booking.status.in_(
                [
                    BookingStatus.pending,
                    BookingStatus.confirmed,
                ]
            ),
        )
        .all()
    )

    # --------------------------------------------------------
    # Teachers already occupied at this slot
    #
    # Only count assigned teachers who are eligible for
    # the requested subject.
    # --------------------------------------------------------

    occupied_teacher_ids = {
        booking.teacher_id
        for booking in bookings
        if booking.teacher_id is not None
        and booking.teacher_id
        in eligible_teacher_ids
    }

    occupied_assigned_teachers = len(
        occupied_teacher_ids
    )

    # --------------------------------------------------------
    # Unassigned bookings reserve capacity.
    #
    # A booking with teacher_id = NULL has already taken
    # a student slot and still needs a teacher.
    # --------------------------------------------------------

    unassigned_bookings = sum(
        1
        for booking in bookings
        if booking.teacher_id is None
    )

    capacity = (
        total_teachers
        - occupied_assigned_teachers
        - unassigned_bookings
    )

    return max(capacity, 0)


# ============================================================
# AVAILABLE SLOTS
# ============================================================

def get_available_slots(
    db: Session,
    subject_id: int,
) -> list[dict]:
    """
    Return tomorrow's booking slots and their availability.

    The student can only book tomorrow.

    Scheduling window:
        10:00 AM IST
        through
        10:00 PM IST

    The final start time is 9:00 PM IST.
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

    results = []

    for slot in slots:

        capacity = get_slot_capacity(
            db=db,
            subject_id=subject_id,
            slot=slot,
        )

        slot_end = (
            slot
            + timedelta(
                minutes=BOOKING_SLOT_MINUTES
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
    Validate and normalize a student's requested booking slot.

    Rules:

    1. Must represent tomorrow in IST.
    2. Must be between 10 AM and 9 PM start time.
    3. Must be exactly on an hourly boundary.
    """

    # --------------------------------------------------------
    # Convert submitted timestamp to IST.
    # --------------------------------------------------------

    if requested_slot.tzinfo is None:
        raise ValueError(
            "scheduled_at must include a timezone."
        )

    requested_ist = requested_slot.astimezone(
        IST
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
    # Exact hour.
    #
    # No:
    # 6:15 PM
    # 6:30 PM
    # 6:45 PM
    #
    # Only:
    # 6:00 PM
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
    - Free class cannot be reused for the same subject.
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