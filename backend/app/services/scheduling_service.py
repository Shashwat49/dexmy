from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Mapping, Sequence

from sqlalchemy.orm import Session

from app.core.constants import CLASS_DURATION_MINUTES, SLOT_DURATION_MINUTES
from app.models.booking import Booking, BookingStatus
from app.models.teacher import TeacherProfile, TeacherSubject
from app.models.user import User, UserRole

ACTIVE_BOOKING_STATUSES = {BookingStatus.pending, BookingStatus.confirmed}

@dataclass(frozen=True)
class TeacherCandidate:
    teacher_id: object
    subject_ids: frozenset[int]

@dataclass(frozen=True)
class SchedulingBooking:
    booking_id: object
    student_id: object
    subject_id: int
    start: datetime
    end: datetime
    teacher_id: object | None

@dataclass(frozen=True)
class MatchingResult:
    matching: dict[object, object]
    total_bookings: int
    matched_bookings: int
    unmatched_booking_ids: tuple[object, ...]

    @property
    def is_fully_assignable(self) -> bool:
        return self.total_bookings == self.matched_bookings

def get_booking_end(start: datetime, duration_minutes: int | None = None) -> datetime:
    duration = CLASS_DURATION_MINUTES if duration_minutes is None else duration_minutes
    return start + timedelta(minutes=duration)

def intervals_overlap(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a

def booking_to_scheduling_booking(booking: Booking) -> SchedulingBooking:
    return SchedulingBooking(booking.id, booking.student_id, booking.subject_id, booking.scheduled_at, get_booking_end(booking.scheduled_at, booking.duration_minutes), booking.teacher_id)

def get_active_bookings_for_interval(db: Session, start: datetime, end: datetime, *, exclude_booking_id: object | None = None) -> list[SchedulingBooking]:
    # Fetch only records that can overlap the requested interval.
    earliest_start = start - timedelta(minutes=SLOT_DURATION_MINUTES)
    query = db.query(Booking).filter(
        Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        Booking.scheduled_at >= earliest_start,
        Booking.scheduled_at < end,
    )
    if exclude_booking_id is not None:
        query = query.filter(Booking.id != exclude_booking_id)
    return [
        item for item in (booking_to_scheduling_booking(row) for row in query.all())
        if intervals_overlap(item.start, item.end, start, end)
    ]

def get_active_bookings_for_slot(db: Session, slot_start: datetime) -> list[SchedulingBooking]:
    return get_active_bookings_for_interval(db, slot_start, slot_start + timedelta(minutes=SLOT_DURATION_MINUTES))

def get_active_bookings_for_day(db: Session, start: datetime, end: datetime) -> list[SchedulingBooking]:
    return get_active_bookings_for_interval(db, start, end)

def get_eligible_teacher_ids(db: Session, subject_id: int) -> list[object]:
    rows = db.query(TeacherProfile.user_id).join(
        TeacherSubject, TeacherSubject.teacher_id == TeacherProfile.user_id
    ).join(User, User.id == TeacherProfile.user_id).filter(
        TeacherSubject.subject_id == subject_id,
        TeacherProfile.is_verified.is_(True),
        User.is_active.is_(True),
        User.role == UserRole.teacher,
    ).distinct().all()
    return [teacher_id for (teacher_id,) in rows]

def get_all_eligible_teacher_subjects(db: Session) -> dict[object, frozenset[int]]:
    rows = db.query(TeacherSubject.teacher_id, TeacherSubject.subject_id).join(
        TeacherProfile, TeacherProfile.user_id == TeacherSubject.teacher_id
    ).join(User, User.id == TeacherSubject.teacher_id).filter(
        TeacherProfile.is_verified.is_(True), User.is_active.is_(True), User.role == UserRole.teacher
    ).all()
    result: dict[object, set[int]] = {}
    for teacher_id, subject_id in rows:
        result.setdefault(teacher_id, set()).add(subject_id)
    return {teacher_id: frozenset(subjects) for teacher_id, subjects in result.items()}

def get_teacher_subject_map(db: Session, teacher_ids: Iterable[object]) -> dict[object, frozenset[int]]:
    teacher_ids = list(teacher_ids)
    if not teacher_ids:
        return {}
    rows = db.query(TeacherSubject.teacher_id, TeacherSubject.subject_id).join(
        TeacherProfile, TeacherProfile.user_id == TeacherSubject.teacher_id
    ).join(User, User.id == TeacherSubject.teacher_id).filter(
        TeacherSubject.teacher_id.in_(teacher_ids), TeacherProfile.is_verified.is_(True),
        User.is_active.is_(True), User.role == UserRole.teacher
    ).all()
    result: dict[object, set[int]] = {}
    for teacher_id, subject_id in rows:
        result.setdefault(teacher_id, set()).add(subject_id)
    return {teacher_id: frozenset(subjects) for teacher_id, subjects in result.items()}

def get_occupied_teacher_ids(bookings: Iterable[SchedulingBooking]) -> set[object]:
    return {booking.teacher_id for booking in bookings if booking.teacher_id is not None}

def get_available_teacher_ids(teacher_ids: Iterable[object], occupied_teacher_ids: Iterable[object]) -> set[object]:
    return set(teacher_ids) - set(occupied_teacher_ids)

def teacher_can_teach_booking(teacher_id: object, booking: SchedulingBooking, teacher_subject_map: Mapping[object, frozenset[int]]) -> bool:
    return booking.subject_id in teacher_subject_map.get(teacher_id, frozenset())

def build_teacher_graph(bookings: Iterable[SchedulingBooking], teacher_ids: Iterable[object], teacher_subject_map: Mapping[object, frozenset[int]]) -> dict[object, list[object]]:
    teacher_ids = list(teacher_ids)
    return {
        booking.booking_id: [
            teacher_id for teacher_id in teacher_ids
            if booking.subject_id in teacher_subject_map.get(teacher_id, frozenset())
        ] for booking in bookings
    }

def find_maximum_matching(graph: dict[object, list[object]]) -> dict[object, object]:
    """Hopcroft-Karp maximum matching for fast and correct teacher assignment."""
    if not graph:
        return {}
    from collections import deque
    left = list(graph)
    pair_left: dict[object, object | None] = {node: None for node in left}
    pair_right: dict[object, object | None] = {}
    distance: dict[object, int] = {}

    def bfs() -> bool:
        queue: deque[object] = deque()
        found = False
        for node in left:
            if pair_left[node] is None:
                distance[node] = 0
                queue.append(node)
            else:
                distance[node] = -1
        while queue:
            node = queue.popleft()
            for teacher in graph.get(node, ()):
                matched = pair_right.get(teacher)
                if matched is None:
                    found = True
                elif distance.get(matched, -1) == -1:
                    distance[matched] = distance[node] + 1
                    queue.append(matched)
        return found

    def dfs(node: object) -> bool:
        for teacher in graph.get(node, ()):
            matched = pair_right.get(teacher)
            if matched is None or (distance.get(matched, -1) == distance[node] + 1 and dfs(matched)):
                pair_left[node] = teacher
                pair_right[teacher] = node
                return True
        distance[node] = -1
        return False

    while bfs():
        for node in left:
            if pair_left[node] is None:
                dfs(node)
    return {node: teacher for node, teacher in pair_left.items() if teacher is not None}

def _matching_for_bookings(bookings: Sequence[SchedulingBooking], teacher_subject_map: Mapping[object, frozenset[int]], extra_occupied: Iterable[object] = ()) -> MatchingResult:
    occupied = get_occupied_teacher_ids(bookings) | set(extra_occupied)
    unassigned = [booking for booking in bookings if booking.teacher_id is None]
    available_teachers = set(teacher_subject_map) - occupied
    graph = build_teacher_graph(unassigned, available_teachers, teacher_subject_map)
    matching = find_maximum_matching(graph)
    unmatched = tuple(item.booking_id for item in unassigned if item.booking_id not in matching)
    return MatchingResult(matching, len(unassigned), len(matching), unmatched)

def calculate_slot_matching(db: Session, slot_start: datetime, *, additional_booking: SchedulingBooking | None = None, exclude_booking_id: object | None = None) -> MatchingResult:
    slot_end = slot_start + timedelta(minutes=SLOT_DURATION_MINUTES)
    bookings = get_active_bookings_for_interval(db, slot_start, slot_end, exclude_booking_id=exclude_booking_id)
    if additional_booking is not None:
        bookings.append(additional_booking)
    subjects = {booking.subject_id for booking in bookings}
    teacher_map = {tid: subjects_for_teacher for tid, subjects_for_teacher in get_all_eligible_teacher_subjects(db).items() if subjects_for_teacher & subjects}
    return _matching_for_bookings(bookings, teacher_map)

def _capacity_from_preloaded(subject_id: int, bookings: Sequence[SchedulingBooking], teacher_subject_map: Mapping[object, frozenset[int]], slot_start: datetime) -> int:
    relevant_subjects = {booking.subject_id for booking in bookings} | {subject_id}
    teachers = {tid: subjects for tid, subjects in teacher_subject_map.items() if subjects & relevant_subjects}
    current = _matching_for_bookings(bookings, teachers)
    if not current.is_fully_assignable:
        return 0
    occupied = get_occupied_teacher_ids(bookings)
    eligible_available = [tid for tid, subjects in teachers.items() if tid not in occupied and subject_id in subjects]
    if not eligible_available:
        return 0
    max_extra = len(eligible_available)

    def feasible(count: int) -> bool:
        synthetic = [SchedulingBooking(
            booking_id=f"__capacity__:{slot_start.isoformat()}:{i}",
            student_id=f"__capacity_student__:{i}", subject_id=subject_id,
            start=slot_start, end=slot_start + timedelta(minutes=CLASS_DURATION_MINUTES), teacher_id=None
        ) for i in range(count)]
        return _matching_for_bookings(list(bookings) + synthetic, teachers).is_fully_assignable

    lo, hi = 0, max_extra
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if feasible(mid):
            lo = mid
        else:
            hi = mid - 1
    return lo

def get_slot_capacity(db: Session, subject_id: int, slot_start: datetime) -> int:
    """Calculate one slot, reusing request-local data when called in a loop."""
    cache = db.info.setdefault("dexmy_availability_cache", {})
    day_key = slot_start.date()
    cached = cache.get(day_key)
    if cached is None:
        day_start = slot_start.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        cached = (
            get_active_bookings_for_day(db, day_start, day_end),
            get_all_eligible_teacher_subjects(db),
        )
        cache[day_key] = cached
    all_bookings, teacher_subject_map = cached
    slot_end = slot_start + timedelta(minutes=SLOT_DURATION_MINUTES)
    slot_bookings = [b for b in all_bookings if intervals_overlap(b.start, b.end, slot_start, slot_end)]
    return _capacity_from_preloaded(subject_id, slot_bookings, teacher_subject_map, slot_start)

def get_available_slot_capacities(db: Session, subject_id: int, slots: Sequence[datetime]) -> list[int]:
    if not slots:
        return []
    day_start = min(slots) - timedelta(minutes=SLOT_DURATION_MINUTES)
    day_end = max(slots) + timedelta(minutes=SLOT_DURATION_MINUTES)
    all_bookings = get_active_bookings_for_day(db, day_start, day_end)
    teacher_subject_map = get_all_eligible_teacher_subjects(db)
    capacities = []
    for slot_start in slots:
        slot_end = slot_start + timedelta(minutes=SLOT_DURATION_MINUTES)
        slot_bookings = [b for b in all_bookings if intervals_overlap(b.start, b.end, slot_start, slot_end)]
        capacities.append(_capacity_from_preloaded(subject_id, slot_bookings, teacher_subject_map, slot_start))
    return capacities

def can_accept_booking(db: Session, *, student_id: object, subject_id: int, slot_start: datetime) -> tuple[bool, str | None]:
    booking_start = slot_start
    booking_end = slot_start + timedelta(minutes=CLASS_DURATION_MINUTES)
    student_bookings = db.query(Booking).filter(
        Booking.student_id == student_id, Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        Booking.scheduled_at < booking_end,
        Booking.scheduled_at >= booking_start - timedelta(minutes=SLOT_DURATION_MINUTES),
    ).all()
    for booking in student_bookings:
        existing = booking_to_scheduling_booking(booking)
        if intervals_overlap(booking_start, booking_end, existing.start, existing.end):
            return False, "You already have another class at this time."
    synthetic = SchedulingBooking(f"new-booking-{student_id}-{subject_id}-{slot_start.isoformat()}", student_id, subject_id, booking_start, booking_end, None)
    if not calculate_slot_matching(db, slot_start, additional_booking=synthetic).is_fully_assignable:
        return False, "This time slot is no longer available for this subject."
    return True, None

def can_assign_teacher(db: Session, *, booking: Booking, teacher_id: object) -> tuple[bool, str | None]:
    teacher = db.get(User, teacher_id)
    if teacher is None:
        return False, "Teacher not found."
    if teacher.role != UserRole.teacher:
        return False, "Selected user is not a teacher."
    if not teacher.is_active:
        return False, "Teacher is inactive."
    profile = db.get(TeacherProfile, teacher.id)
    if profile is None:
        return False, "Teacher profile not found."
    if not profile.is_verified:
        return False, "Teacher is not verified."
    if db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id, TeacherSubject.subject_id == booking.subject_id).first() is None:
        return False, "Teacher does not teach this subject."

    booking_start = booking.scheduled_at
    booking_end = get_booking_end(booking_start, booking.duration_minutes)
    earliest = booking_start - timedelta(minutes=SLOT_DURATION_MINUTES)
    existing_teacher_bookings = db.query(Booking).filter(
        Booking.teacher_id == teacher_id, Booking.status.in_(ACTIVE_BOOKING_STATUSES), Booking.id != booking.id,
        Booking.scheduled_at < booking_end, Booking.scheduled_at >= earliest,
    ).all()
    for existing in existing_teacher_bookings:
        if intervals_overlap(booking_start, booking_end, existing.scheduled_at, get_booking_end(existing.scheduled_at, existing.duration_minutes)):
            return False, "Teacher is already assigned to another class at this time."

    existing_student_bookings = db.query(Booking).filter(
        Booking.student_id == booking.student_id, Booking.status.in_(ACTIVE_BOOKING_STATUSES), Booking.id != booking.id,
        Booking.scheduled_at < booking_end, Booking.scheduled_at >= earliest,
    ).all()
    for existing in existing_student_bookings:
        if intervals_overlap(booking_start, booking_end, existing.scheduled_at, get_booking_end(existing.scheduled_at, existing.duration_minutes)):
            return False, "Student already has another class at this time."

    other_bookings = get_active_bookings_for_interval(db, booking_start, booking_start + timedelta(minutes=SLOT_DURATION_MINUTES), exclude_booking_id=booking.id)
    occupied = get_occupied_teacher_ids(other_bookings)
    if teacher_id in occupied:
        return False, "Teacher is already occupied during this slot."
    unassigned = [item for item in other_bookings if item.teacher_id is None]
    if not unassigned:
        return True, None
    subject_ids = {item.subject_id for item in unassigned}
    teacher_subject_map = {tid: subjects for tid, subjects in get_all_eligible_teacher_subjects(db).items() if tid != teacher_id and subjects & subject_ids}
    result = _matching_for_bookings(unassigned, teacher_subject_map, extra_occupied=occupied | {teacher_id})
    if not result.is_fully_assignable:
        return False, "This assignment would leave another booking without an eligible teacher."
    return True, None
