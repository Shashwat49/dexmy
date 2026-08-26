from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable

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
    TeacherProfile,
    TeacherSubject,
)

from app.models.user import (
    User,
    UserRole,
)


# ============================================================
# SCHEDULING CONFIGURATION
# ============================================================

# Dexmy's scheduling timezone.
# All scheduling decisions must be made in IST.
#
# We deliberately do not create teacher availability here.
# Business rule:
#
#   Active + verified teacher
#   = available during Dexmy's scheduling window.
#
# Teacher availability is determined by:
#   1. teacher account active
#   2. teacher verified
#   3. teacher teaches requested subject
#   4. teacher has no conflicting booking
#
# ============================================================


ACTIVE_BOOKING_STATUSES = {
    BookingStatus.pending,
    BookingStatus.confirmed,
}


# ============================================================
# DATA STRUCTURES
# ============================================================


@dataclass(frozen=True)
class TeacherCandidate:
    """
    Represents one teacher who is potentially capable
    of teaching a booking.

    A teacher is a single scheduling resource even if
    they teach multiple subjects.
    """

    teacher_id: object
    subject_ids: frozenset[int]


@dataclass(frozen=True)
class SchedulingBooking:
    """
    Lightweight representation of a booking used by
    the scheduling engine.

    This keeps the matching algorithm independent from
    SQLAlchemy objects.
    """

    booking_id: object
    student_id: object
    subject_id: int
    start: datetime
    end: datetime
    teacher_id: object | None


# ============================================================
# TIME / INTERVAL HELPERS
# ============================================================


def get_booking_end(
    start: datetime,
    duration_minutes: int | None = None,
) -> datetime:
    """
    Return the end of a booking interval.

    By default we use the configured class duration.

    IMPORTANT:
        The resource slot is 60 minutes, while the actual
        class is 55 minutes. The scheduling engine should
        use the booking's actual duration for conflict
        detection.
    """

    duration = (
        duration_minutes
        if duration_minutes is not None
        else CLASS_DURATION_MINUTES
    )

    return start + timedelta(
        minutes=duration
    )


def intervals_overlap(
    start_a: datetime,
    end_a: datetime,
    start_b: datetime,
    end_b: datetime,
) -> bool:
    """
    Return True when two intervals overlap.

    Uses half-open interval semantics:

        [start, end)

    Therefore:

        7:00–7:55
        7:55–8:50

    do NOT overlap.

    But:

        7:00–7:55
        7:30–8:25

    DO overlap.
    """

    return (
        start_a < end_b
        and start_b < end_a
    )


# ============================================================
# BOOKING CONVERSION
# ============================================================


def booking_to_scheduling_booking(
    booking: Booking,
) -> SchedulingBooking:
    """
    Convert a SQLAlchemy Booking into the lightweight
    representation used by the scheduler.
    """

    start = booking.scheduled_at

    end = get_booking_end(
        start=start,
        duration_minutes=booking.duration_minutes,
    )

    return SchedulingBooking(
        booking_id=booking.id,
        student_id=booking.student_id,
        subject_id=booking.subject_id,
        start=start,
        end=end,
        teacher_id=booking.teacher_id,
    )


# ============================================================
# DATABASE BOOKING RETRIEVAL
# ============================================================


def get_active_bookings_for_interval(
    db: Session,
    start: datetime,
    end: datetime,
    *,
    exclude_booking_id: object | None = None,
) -> list[SchedulingBooking]:
    """
    Return every active booking whose time interval overlaps
    the requested interval.

    This is deliberately NOT limited to exact scheduled_at
    equality.

    That protects us from future non-hourly bookings and
    correctly handles interval overlaps.
    """

    query = (
        db.query(Booking)
        .filter(
            Booking.status.in_(
                ACTIVE_BOOKING_STATUSES
            ),

            Booking.scheduled_at < end,
        )
    )

    if exclude_booking_id is not None:
        query = query.filter(
            Booking.id
            != exclude_booking_id
        )

    bookings = query.all()

    results: list[
        SchedulingBooking
    ] = []

    for booking in bookings:

        scheduling_booking = (
            booking_to_scheduling_booking(
                booking
            )
        )

        if intervals_overlap(
            scheduling_booking.start,
            scheduling_booking.end,
            start,
            end,
        ):
            results.append(
                scheduling_booking
            )

    return results


def get_active_bookings_for_slot(
    db: Session,
    slot_start: datetime,
) -> list[SchedulingBooking]:
    """
    Return all active bookings overlapping one booking slot.

    The slot itself is SLOT_DURATION_MINUTES long.

    Currently that is 60 minutes.
    """

    slot_end = (
        slot_start
        + timedelta(
            minutes=SLOT_DURATION_MINUTES
        )
    )

    return get_active_bookings_for_interval(
        db=db,
        start=slot_start,
        end=slot_end,
    )


# ============================================================
# TEACHER ELIGIBILITY
# ============================================================


def get_eligible_teacher_ids(
    db: Session,
    subject_id: int,
) -> list[object]:
    """
    Return active + verified teachers who teach a subject.

    This answers ONLY:

        "Who is qualified to teach this subject?"

    It does NOT answer:

        "Who is free at this time?"

    Time occupancy is handled separately.
    """

    rows = (
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
        ) in rows
    ]


def get_teacher_subject_map(
    db: Session,
    teacher_ids: Iterable[object],
) -> dict[object, frozenset[int]]:
    """
    Return:

        teacher_id -> subjects they teach

    Only requested teacher IDs are included.

    Example:

        Teacher A -> {SAT, TMUA}
        Teacher B -> {SAT}
    """

    teacher_ids = list(
        teacher_ids
    )

    if not teacher_ids:
        return {}

    rows = (
        db.query(
            TeacherSubject.teacher_id,
            TeacherSubject.subject_id,
        )
        .join(
            TeacherProfile,
            TeacherProfile.user_id
            == TeacherSubject.teacher_id,
        )
        .join(
            User,
            User.id
            == TeacherSubject.teacher_id,
        )
        .filter(
            TeacherSubject.teacher_id.in_(
                teacher_ids
            ),

            TeacherProfile.is_verified.is_(
                True
            ),

            User.is_active.is_(True),

            User.role
            == UserRole.teacher,
        )
        .all()
    )

    result: dict[
        object,
        set[int],
    ] = {}

    for teacher_id, subject_id in rows:

        result.setdefault(
            teacher_id,
            set(),
        ).add(subject_id)

    return {
        teacher_id: frozenset(
            subject_ids
        )
        for teacher_id, subject_ids
        in result.items()
    }


# ============================================================
# TEACHER OCCUPANCY
# ============================================================


def get_occupied_teacher_ids(
    bookings: Iterable[SchedulingBooking],
) -> set[object]:
    """
    Return teachers already assigned to an active booking.

    IMPORTANT:

    If a teacher teaches:

        SAT + TMUA

    and is assigned:

        SAT at 7 PM

    that teacher is considered occupied for the entire
    scheduling interval.

    They therefore cannot be assigned:

        TMUA at 7 PM

    even though they are qualified for TMUA.
    """

    return {
        booking.teacher_id
        for booking in bookings
        if booking.teacher_id is not None
    }


def get_available_teacher_ids(
    teacher_ids: Iterable[object],
    occupied_teacher_ids: Iterable[object],
) -> set[object]:
    """
    Remove occupied teachers from a candidate pool.
    """

    return (
        set(teacher_ids)
        - set(occupied_teacher_ids)
    )


# ============================================================
# TEACHER -> BOOKING GRAPH
# ============================================================


def teacher_can_teach_booking(
    teacher_id: object,
    booking: SchedulingBooking,
    teacher_subject_map: dict[
        object,
        frozenset[int],
    ],
) -> bool:
    """
    Return whether a teacher is qualified for a booking.

    Teacher qualification is subject-specific.

    This is the first half of scheduling eligibility.

    Occupancy is handled separately.
    """

    subjects = teacher_subject_map.get(
        teacher_id,
        frozenset(),
    )

    return (
        booking.subject_id
        in subjects
    )


def build_teacher_graph(
    bookings: Iterable[SchedulingBooking],
    teacher_ids: Iterable[object],
    teacher_subject_map: dict[
        object,
        frozenset[int],
    ],
) -> dict[
    object,
    list[object],
]:
    """
    Build a bipartite graph:

        booking_id -> teacher_ids

    A teacher receives an edge only when they are qualified
    to teach that booking's subject.

    Occupied teachers should already have been removed
    before calling this function.
    """

    teacher_ids = list(
        teacher_ids
    )

    graph: dict[
        object,
        list[object],
    ] = {}

    for booking in bookings:

        graph[
            booking.booking_id
        ] = [
            teacher_id
            for teacher_id in teacher_ids
            if teacher_can_teach_booking(
                teacher_id=teacher_id,
                booking=booking,
                teacher_subject_map=(
                    teacher_subject_map
                ),
            )
        ]

    return graph


# ============================================================
# MAXIMUM BIPARTITE MATCHING
# ============================================================


def find_maximum_matching(
    graph: dict[
        object,
        list[object],
    ],
) -> dict[object, object]:
    """
    Find a maximum bipartite matching.

    Returns:

        booking_id -> teacher_id

    Every teacher can appear at most once.

    Every booking can appear at most once.

    This is the core protection for multi-subject teachers.

    Example:

        Teacher A -> SAT + TMUA
        Teacher B -> SAT

        SAT booking -> A, B
        TMUA booking -> A

    The matching can produce:

        SAT  -> B
        TMUA -> A
    """

    teacher_to_booking: dict[
        object,
        object,
    ] = {}

    def try_assign(
        booking_id: object,
        visited: set[object],
    ) -> bool:

        for teacher_id in graph.get(
            booking_id,
            [],
        ):

            if teacher_id in visited:
                continue

            visited.add(
                teacher_id
            )

            current_booking = (
                teacher_to_booking.get(
                    teacher_id
                )
            )

            if (
                current_booking is None
                or try_assign(
                    current_booking,
                    visited,
                )
            ):

                teacher_to_booking[
                    teacher_id
                ] = booking_id

                return True

        return False

    # --------------------------------------------------------
    # Try the most constrained bookings first.
    #
    # This is important:
    #
    # TMUA -> A
    # SAT  -> A, B
    #
    # We should attempt TMUA first.
    # --------------------------------------------------------

    booking_order = sorted(
        graph.keys(),
        key=lambda booking_id: len(
            graph[booking_id]
        ),
    )

    for booking_id in booking_order:

        try_assign(
            booking_id,
            set(),
        )

    return {
        booking_id: teacher_id
        for teacher_id, booking_id
        in teacher_to_booking.items()
    }


# ============================================================
# MATCHING ANALYSIS
# ============================================================


@dataclass(frozen=True)
class MatchingResult:
    """
    Result of attempting to assign all active bookings
    within a scheduling slot.
    """

    matching: dict[object, object]

    total_bookings: int

    matched_bookings: int

    unmatched_booking_ids: tuple[object, ...]

    @property
    def is_fully_assignable(self) -> bool:
        """
        True only when every booking can be assigned
        to a distinct qualified teacher.
        """

        return (
            self.total_bookings
            == self.matched_bookings
        )


def calculate_slot_matching(
    db: Session,
    slot_start: datetime,
    *,
    additional_booking: SchedulingBooking | None = None,
    exclude_booking_id: object | None = None,
) -> MatchingResult:
    """
    Calculate whether all active bookings in a slot can
    be assigned to distinct qualified teachers.

    `additional_booking` is used to answer:

        "If we add this new booking, does the slot
         remain schedulable?"

    This is the central function we will later use for
    student booking availability and admin assignment.
    """

    slot_end = (
        slot_start
        + timedelta(
            minutes=SLOT_DURATION_MINUTES
        )
    )

    existing_bookings = (
        get_active_bookings_for_interval(
            db=db,
            start=slot_start,
            end=slot_end,
            exclude_booking_id=(
                exclude_booking_id
            ),
        )
    )

    all_bookings = list(
        existing_bookings
    )

    if additional_booking is not None:

        all_bookings.append(
            additional_booking
        )

    # --------------------------------------------------------
    # Teachers already assigned to existing bookings
    # --------------------------------------------------------

    occupied_teacher_ids = (
        get_occupied_teacher_ids(
            all_bookings
        )
    )

    # --------------------------------------------------------
    # Candidate teachers
    #
    # We collect teachers who teach at least one subject
    # represented in this slot.
    # --------------------------------------------------------

    requested_subject_ids = {
        booking.subject_id
        for booking in all_bookings
    }

    candidate_teacher_ids: set[
        object
    ] = set()

    for subject_id in (
        requested_subject_ids
    ):

        candidate_teacher_ids.update(
            get_eligible_teacher_ids(
                db=db,
                subject_id=subject_id,
            )
        )

    # --------------------------------------------------------
    # Remove teachers already occupied by assigned bookings.
    #
    # IMPORTANT:
    #
    # An occupied teacher is removed globally.
    #
    # They cannot teach another subject at this time.
    # --------------------------------------------------------

    available_teacher_ids = (
        get_available_teacher_ids(
            teacher_ids=(
                candidate_teacher_ids
            ),
            occupied_teacher_ids=(
                occupied_teacher_ids
            ),
        )
    )

    # --------------------------------------------------------
    # If we have no unassigned bookings, the slot is already
    # fully represented by assigned bookings.
    # --------------------------------------------------------

    unassigned_bookings = [
        booking
        for booking in all_bookings
        if booking.teacher_id is None
    ]

    if not unassigned_bookings:

        return MatchingResult(
            matching={},
            total_bookings=0,
            matched_bookings=0,
            unmatched_booking_ids=(),
        )

    # --------------------------------------------------------
    # Get subject map.
    # --------------------------------------------------------

    teacher_subject_map = (
        get_teacher_subject_map(
            db=db,
            teacher_ids=(
                available_teacher_ids
            ),
        )
    )

    # --------------------------------------------------------
    # Build graph.
    # --------------------------------------------------------

    graph = build_teacher_graph(
        bookings=unassigned_bookings,
        teacher_ids=(
            available_teacher_ids
        ),
        teacher_subject_map=(
            teacher_subject_map
        ),
    )

    # --------------------------------------------------------
    # Maximum matching.
    # --------------------------------------------------------

    matching = find_maximum_matching(
        graph
    )

    unmatched = tuple(
        booking.booking_id
        for booking in unassigned_bookings
        if booking.booking_id
        not in matching
    )

    return MatchingResult(
        matching=matching,
        total_bookings=len(
            unassigned_bookings
        ),
        matched_bookings=len(
            matching
        ),
        unmatched_booking_ids=unmatched,
    )


# ============================================================
# SLOT CAPACITY
# ============================================================


def get_slot_capacity(
    db: Session,
    subject_id: int,
    slot_start: datetime,
) -> int:
    """
    Return the number of additional bookings for `subject_id`
    that can safely fit into this slot.

    IMPORTANT:

    This is NOT simply:

        teachers - bookings

    Instead, it asks:

        "How many additional bookings of this subject
         can be added while maintaining a valid teacher
         assignment?"

    We repeatedly test the slot with an additional booking.

    This is intentionally conservative and correctness-first.
    """

    slot_end = (
        slot_start
        + timedelta(
            minutes=SLOT_DURATION_MINUTES
        )
    )

    existing_bookings = (
        get_active_bookings_for_interval(
            db=db,
            start=slot_start,
            end=slot_end,
        )
    )

    # --------------------------------------------------------
    # Determine teachers who can teach this subject.
    # --------------------------------------------------------

    eligible_teacher_ids = (
        set(
            get_eligible_teacher_ids(
                db=db,
                subject_id=subject_id,
            )
        )
    )

    if not eligible_teacher_ids:
        return 0

    # --------------------------------------------------------
    # First verify that the existing schedule itself is
    # assignable.
    # --------------------------------------------------------

    current_result = (
        calculate_slot_matching(
            db=db,
            slot_start=slot_start,
        )
    )

    if not current_result.is_fully_assignable:

        # Existing pending bookings already exceed what
        # the available teacher pool can satisfy.
        #
        # Do not advertise additional capacity.
        return 0

    # --------------------------------------------------------
    # Maximum possible additional bookings cannot exceed
    # the number of eligible teachers.
    # --------------------------------------------------------

    occupied_eligible_teachers = {
        booking.teacher_id
        for booking in existing_bookings
        if (
            booking.teacher_id
            in eligible_teacher_ids
        )
    }

    available_eligible_teacher_count = (
        len(
            eligible_teacher_ids
            - occupied_eligible_teachers
        )
    )

    if available_eligible_teacher_count <= 0:
        return 0

    # --------------------------------------------------------
    # Add bookings one at a time.
    #
    # We test:
    #
    # existing + 1
    # existing + 2
    # existing + 3
    #
    # until the slot can no longer maintain a complete
    # matching.
    #
    # This handles:
    #
    # SAT + TMUA
    # SAT-only + SAT/TMUA teacher
    #
    # correctly.
    # --------------------------------------------------------

    capacity = 0

    for _ in range(
        available_eligible_teacher_count
    ):

        synthetic_booking = (
            SchedulingBooking(
                booking_id=(
                    f"capacity-check-{capacity}"
                    f"-{slot_start.isoformat()}"
                ),
                student_id=(
                    f"capacity-check-student-{capacity}"
                ),
                subject_id=subject_id,
                start=slot_start,
                end=(
                    slot_start
                    + timedelta(
                        minutes=CLASS_DURATION_MINUTES
                    )
                ),
                teacher_id=None,
            )
        )

        result = (
            calculate_slot_matching(
                db=db,
                slot_start=slot_start,
                additional_booking=(
                    synthetic_booking
                ),
            )
        )

        if not result.is_fully_assignable:
            break

        capacity += 1

    return capacity


# ============================================================
# CAN ACCEPT NEW BOOKING
# ============================================================


def can_accept_booking(
    db: Session,
    *,
    student_id: object,
    subject_id: int,
    slot_start: datetime,
) -> tuple[bool, str | None]:
    """
    Validate whether a new student booking can be accepted.

    This performs scheduling validation only.

    Payment/free-class logic remains in booking_service.py.
    """

    # --------------------------------------------------------
    # New booking interval.
    # --------------------------------------------------------

    booking_start = slot_start

    booking_end = (
        slot_start
        + timedelta(
            minutes=CLASS_DURATION_MINUTES
        )
    )

    # --------------------------------------------------------
    # Student conflict.
    # --------------------------------------------------------

    student_bookings = (
        db.query(Booking)
        .filter(
            Booking.student_id
            == student_id,

            Booking.status.in_(
                ACTIVE_BOOKING_STATUSES
            ),

            Booking.scheduled_at
            < booking_end,
        )
        .all()
    )

    for booking in student_bookings:

        existing = (
            booking_to_scheduling_booking(
                booking
            )
        )

        if intervals_overlap(
            booking_start,
            booking_end,
            existing.start,
            existing.end,
        ):
            return (
                False,
                "You already have another "
                "class at this time.",
            )

    # --------------------------------------------------------
    # Teacher capacity / matching.
    # --------------------------------------------------------

    synthetic_booking = (
        SchedulingBooking(
            booking_id=(
                f"new-booking-{student_id}-"
                f"{subject_id}-"
                f"{slot_start.isoformat()}"
            ),
            student_id=student_id,
            subject_id=subject_id,
            start=booking_start,
            end=booking_end,
            teacher_id=None,
        )
    )

    result = calculate_slot_matching(
        db=db,
        slot_start=slot_start,
        additional_booking=(
            synthetic_booking
        ),
    )

    if not result.is_fully_assignable:

        return (
            False,
            "This time slot is no longer "
            "available for this subject.",
        )

    return True, None


# ============================================================
# CAN ASSIGN TEACHER
# ============================================================


def can_assign_teacher(
    db: Session,
    *,
    booking: Booking,
    teacher_id: object,
) -> tuple[bool, str | None]:
    """
    Validate a proposed teacher assignment.

    Checks:

    1. Teacher exists as active verified teacher.
    2. Teacher teaches booking subject.
    3. Teacher has no overlapping booking.
    4. Student has no conflicting booking.
    5. The assignment does not leave another pending
       booking in the same slot impossible to assign.
    """

    # --------------------------------------------------------
    # Teacher account.
    # --------------------------------------------------------

    teacher = db.get(
        User,
        teacher_id,
    )

    if teacher is None:
        return (
            False,
            "Teacher not found.",
        )

    if teacher.role != UserRole.teacher:
        return (
            False,
            "Selected user is not a teacher.",
        )

    if not teacher.is_active:
        return (
            False,
            "Teacher is inactive.",
        )

    # --------------------------------------------------------
    # Teacher verification.
    # --------------------------------------------------------

    profile = db.get(
        TeacherProfile,
        teacher.id,
    )

    if profile is None:
        return (
            False,
            "Teacher profile not found.",
        )

    if not profile.is_verified:
        return (
            False,
            "Teacher is not verified.",
        )

    # --------------------------------------------------------
    # Subject qualification.
    # --------------------------------------------------------

    teaches_subject = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id
            == teacher_id,

            TeacherSubject.subject_id
            == booking.subject_id,
        )
        .first()
    )

    if teaches_subject is None:
        return (
            False,
            "Teacher does not teach this subject.",
        )

    # --------------------------------------------------------
    # Booking interval.
    # --------------------------------------------------------

    booking_start = booking.scheduled_at

    booking_end = get_booking_end(
        start=booking_start,
        duration_minutes=(
            booking.duration_minutes
        ),
    )

    # --------------------------------------------------------
    # Teacher overlap.
    # --------------------------------------------------------

    existing_teacher_bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id
            == teacher_id,

            Booking.status.in_(
                ACTIVE_BOOKING_STATUSES
            ),

            Booking.id
            != booking.id,

            Booking.scheduled_at
            < booking_end,
        )
        .all()
    )

    for existing in (
        existing_teacher_bookings
    ):

        existing_end = (
            get_booking_end(
                start=existing.scheduled_at,
                duration_minutes=(
                    existing.duration_minutes
                ),
            )
        )

        if intervals_overlap(
            booking_start,
            booking_end,
            existing.scheduled_at,
            existing_end,
        ):
            return (
                False,
                "Teacher is already assigned "
                "to another class at this time.",
            )

    # --------------------------------------------------------
    # Student overlap.
    # --------------------------------------------------------

    existing_student_bookings = (
        db.query(Booking)
        .filter(
            Booking.student_id
            == booking.student_id,

            Booking.status.in_(
                ACTIVE_BOOKING_STATUSES
            ),

            Booking.id
            != booking.id,

            Booking.scheduled_at
            < booking_end,
        )
        .all()
    )

    for existing in (
        existing_student_bookings
    ):

        existing_end = (
            get_booking_end(
                start=existing.scheduled_at,
                duration_minutes=(
                    existing.duration_minutes
                ),
            )
        )

        if intervals_overlap(
            booking_start,
            booking_end,
            existing.scheduled_at,
            existing_end,
        ):
            return (
                False,
                "Student already has another "
                "class at this time.",
            )

    # --------------------------------------------------------
    # Future-feasibility check.
    #
    # We simulate assigning THIS teacher to the booking.
    #
    # Then we ask:
    #
    # "Can every other unassigned booking at this
    # slot still be assigned?"
    # --------------------------------------------------------

    slot_end = (
        booking_start
        + timedelta(
            minutes=SLOT_DURATION_MINUTES
        )
    )

    other_bookings = (
        get_active_bookings_for_interval(
            db=db,
            start=booking_start,
            end=slot_end,
            exclude_booking_id=booking.id,
        )
    )

    # Existing assigned bookings remain assigned.
    #
    # We add the proposed assignment to the booking
    # conceptually by treating this teacher as occupied.

    occupied_teacher_ids = (
        get_occupied_teacher_ids(
            other_bookings
        )
    )

    if teacher_id in occupied_teacher_ids:
        return (
            False,
            "Teacher is already occupied "
            "during this slot.",
        )

    # --------------------------------------------------------
    # Find all unassigned bookings.
    # --------------------------------------------------------

    unassigned_bookings = [
        item
        for item in other_bookings
        if item.teacher_id is None
    ]

    # --------------------------------------------------------
    # If there are no other pending bookings, the assignment
    # is safe.
    # --------------------------------------------------------

    if not unassigned_bookings:
        return True, None

    # --------------------------------------------------------
    # Candidate teachers.
    # --------------------------------------------------------

    subject_ids = {
        item.subject_id
        for item in unassigned_bookings
    }

    candidate_teacher_ids: set[
        object
    ] = set()

    for subject_id in subject_ids:

        candidate_teacher_ids.update(
            get_eligible_teacher_ids(
                db=db,
                subject_id=subject_id,
            )
        )

    # The proposed teacher is now occupied.
    candidate_teacher_ids.discard(
        teacher_id
    )

    # Existing assigned teachers are also occupied.
    candidate_teacher_ids -= (
        occupied_teacher_ids
    )

    teacher_subject_map = (
        get_teacher_subject_map(
            db=db,
            teacher_ids=(
                candidate_teacher_ids
            ),
        )
    )

    graph = build_teacher_graph(
        bookings=unassigned_bookings,
        teacher_ids=(
            candidate_teacher_ids
        ),
        teacher_subject_map=(
            teacher_subject_map
        ),
    )

    matching = find_maximum_matching(
        graph
    )

    if len(matching) != len(
        unassigned_bookings
    ):
        return (
            False,
            "This assignment would leave "
            "another booking without an "
            "eligible teacher.",
        )

    return True, None