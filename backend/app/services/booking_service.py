import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.constants import SLOT_DURATION_MINUTES
from app.models.booking import Booking, BookingStatus
from app.models.teacher import (
    Subject,
    TeacherAvailability,
    TeacherProfile,
    TeacherSubject,
)
from app.models.user import User, UserRole
from app.models.free_class import StudentFreeClassUse

CLASS_SEARCH_DAYS = 30
FREE_CLASS_LIMIT = 2


def get_next_slot_for_teacher(
    db: Session,
    teacher_id: uuid.UUID,
    duration_minutes: int = SLOT_DURATION_MINUTES,
) -> datetime | None:

    now = datetime.now(timezone.utc)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id == teacher_id,

            Booking.status.in_(
                [
                    BookingStatus.pending,
                    BookingStatus.confirmed,
                ]
            ),

            Booking.scheduled_at >= now,
            Booking.scheduled_at
            < now + timedelta(
                days=CLASS_SEARCH_DAYS
            ),
        )
        .order_by(
            Booking.scheduled_at.asc()
        )
        .all()
    )

    booked_ranges = []

    for booking in bookings:

        start = booking.scheduled_at

        end = (
            start
            + timedelta(
                minutes=booking.duration_minutes
            )
        )

        booked_ranges.append(
            (start, end)
        )


    availability = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id
            == teacher_id,
            TeacherAvailability.is_recurring.is_(True),
        )
        .order_by(
            TeacherAvailability.day_of_week,
            TeacherAvailability.start_time,
        )
        .all()
    )


    if not availability:
        return None


    slot_duration = timedelta(
        minutes=duration_minutes
    )

    slot_step = timedelta(
        minutes=SLOT_DURATION_MINUTES
    )


    for day_offset in range(
        CLASS_SEARCH_DAYS + 1
    ):

        current_date = (
            now.date()
            + timedelta(
                days=day_offset
            )
        )

        # Database convention:
        # 0 = Sunday
        day_of_week = (
            current_date.weekday() + 1
        ) % 7


        day_windows = [
            window
            for window in availability
            if window.day_of_week
            == day_of_week
        ]


        for window in day_windows:

            window_start = datetime.combine(
                current_date,
                window.start_time,
                tzinfo=timezone.utc,
            )

            window_end = datetime.combine(
                current_date,
                window.end_time,
                tzinfo=timezone.utc,
            )


            cursor = window_start

            if cursor < now:
                cursor = now

                # Round up to the next slot boundary.
                minutes_since_midnight = (
                    cursor.hour * 60
                    + cursor.minute
                )

                remainder = (
                    minutes_since_midnight
                    % SLOT_DURATION_MINUTES
                )

                if remainder:
                    cursor += timedelta(
                        minutes=(
                            SLOT_DURATION_MINUTES
                            - remainder
                        )
                    )

                cursor = cursor.replace(
                    second=0,
                    microsecond=0,
                )


            while (
                cursor + slot_duration
                <= window_end
            ):

                slot_end = (
                    cursor
                    + slot_duration
                )


                overlaps = any(
                    cursor < booked_end
                    and slot_end > booked_start
                    for (
                        booked_start,
                        booked_end,
                    )
                    in booked_ranges
                )


                if not overlaps:
                    return cursor


                cursor += slot_step


    return None


def find_teacher_and_slot(
    db: Session,
    subject_id: int,
) -> tuple[
    uuid.UUID,
    datetime,
] | None:

    subject = db.get(
        Subject,
        subject_id,
    )

    if subject is None:
        return None


    teacher_profiles = (
        db.query(TeacherProfile)
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


    candidates = []


    for teacher in teacher_profiles:

        slot = get_next_slot_for_teacher(
            db=db,
            teacher_id=teacher.user_id,
        )

        if slot is not None:

            candidates.append(
                (
                    slot,
                    teacher.user_id,
                )
            )


    if not candidates:
        return None


    # Earliest available class wins.
    candidates.sort(
        key=lambda item: item[0]
    )


    selected_slot, selected_teacher = (
        candidates[0]
    )


    return (
        selected_teacher,
        selected_slot,
    )

def get_free_class_status(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
) -> tuple[bool, int]:

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

    # Already used a free class for this subject.
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