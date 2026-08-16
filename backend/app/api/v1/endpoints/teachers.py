import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.constants import SLOT_DURATION_MINUTES
from app.core.dependencies import require_role
from app.db.session import get_db

from app.models.booking import Booking, BookingStatus
from app.models.teacher import (
    Subject,
    TeacherAvailability,
    TeacherProfile,
    TeacherSubject,
)
from app.models.user import User, UserRole

from app.schemas.profile import (
    TeacherProfileRead,
    TeacherProfileUpdate,
    TeacherPublicRead,
)
from app.schemas.teacher import (
    AvailabilityCreate,
    AvailabilityRead,
    SlotRead,
)


router = APIRouter()


# ============================================================
# HELPERS
# ============================================================

def _get_teacher_profile(
    teacher_id: uuid.UUID,
    db: Session,
) -> TeacherProfile:

    profile = db.get(
        TeacherProfile,
        teacher_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found",
        )

    return profile


def _get_teacher_subject_ids(
    teacher_id: uuid.UUID,
    db: Session,
) -> list[int]:

    rows = (
        db.query(TeacherSubject.subject_id)
        .filter(
            TeacherSubject.teacher_id == teacher_id
        )
        .all()
    )

    return [
        row[0]
        for row in rows
    ]


def _build_teacher_profile_read(
    profile: TeacherProfile,
    db: Session,
) -> TeacherProfileRead:

    return TeacherProfileRead(
        user_id=profile.user_id,
        bio=profile.bio,
        qualifications=profile.qualifications,
        years_experience=profile.years_experience,
        hourly_rate=profile.hourly_rate,
        is_verified=profile.is_verified,
        rating_avg=profile.rating_avg,
        rating_count=profile.rating_count,
        subject_ids=_get_teacher_subject_ids(
            profile.user_id,
            db,
        ),
    )


def _build_public_teacher(
    profile: TeacherProfile,
    user: User,
    db: Session,
) -> TeacherPublicRead:

    return TeacherPublicRead(
        user_id=profile.user_id,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        bio=profile.bio,
        qualifications=profile.qualifications,
        years_experience=profile.years_experience,
        hourly_rate=profile.hourly_rate,
        is_verified=profile.is_verified,
        rating_avg=profile.rating_avg,
        rating_count=profile.rating_count,
        subject_ids=_get_teacher_subject_ids(
            profile.user_id,
            db,
        ),
    )


# ============================================================
# MY TEACHER PROFILE
# ============================================================

@router.get(
    "/me/profile",
    response_model=TeacherProfileRead,
)
def get_my_teacher_profile(
    current_user: User = Depends(
        require_role(UserRole.teacher)
    ),
    db: Session = Depends(get_db),
):
    profile = _get_teacher_profile(
        current_user.id,
        db,
    )

    return _build_teacher_profile_read(
        profile,
        db,
    )


@router.patch(
    "/me/profile",
    response_model=TeacherProfileRead,
)
def update_my_teacher_profile(
    payload: TeacherProfileUpdate,
    current_user: User = Depends(
        require_role(UserRole.teacher)
    ),
    db: Session = Depends(get_db),
):
    profile = _get_teacher_profile(
        current_user.id,
        db,
    )

    # --------------------------------------------------------
    # Generic teacher fields
    # --------------------------------------------------------

    fields = payload.model_dump(
        exclude_unset=True,
        exclude={"subject_ids"},
    )

    if "years_experience" in fields:
        years = fields["years_experience"]

        if years is not None and years < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Years of experience cannot be negative",
            )

    if "hourly_rate" in fields:
        rate = fields["hourly_rate"]

        if rate is not None and rate < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hourly rate cannot be negative",
            )

    for field, value in fields.items():
        setattr(
            profile,
            field,
            value,
        )

    # --------------------------------------------------------
    # Subjects
    # --------------------------------------------------------

    if payload.subject_ids is not None:

        subject_ids = list(
            dict.fromkeys(
                payload.subject_ids
            )
        )

        if subject_ids:

            existing_subject_ids = {
                row[0]
                for row in (
                    db.query(Subject.id)
                    .filter(
                        Subject.id.in_(
                            subject_ids
                        )
                    )
                    .all()
                )
            }

            invalid_subject_ids = (
                set(subject_ids)
                - existing_subject_ids
            )

            if invalid_subject_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Invalid subject IDs: "
                        + ", ".join(
                            str(value)
                            for value in sorted(
                                invalid_subject_ids
                            )
                        )
                    ),
                )

        (
            db.query(TeacherSubject)
            .filter(
                TeacherSubject.teacher_id
                == current_user.id
            )
            .delete(
                synchronize_session=False
            )
        )

        for subject_id in subject_ids:
            db.add(
                TeacherSubject(
                    teacher_id=current_user.id,
                    subject_id=subject_id,
                )
            )

    db.commit()
    db.refresh(profile)

    return _build_teacher_profile_read(
        profile,
        db,
    )


# ============================================================
# TEACHER AVAILABILITY
#
# Full calendar UI and slot engine will be Phase 3.
# ============================================================

@router.post(
    "/me/availability",
    response_model=AvailabilityRead,
    status_code=status.HTTP_201_CREATED,
)
def add_availability(
    payload: AvailabilityCreate,
    current_user: User = Depends(
        require_role(UserRole.teacher)
    ),
    db: Session = Depends(get_db),
):
    if not 0 <= payload.day_of_week <= 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week must be between 0 and 6",
        )

    if payload.start_time >= payload.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be before end time",
        )

    availability = TeacherAvailability(
        teacher_id=current_user.id,
        **payload.model_dump(),
    )

    db.add(availability)
    db.commit()
    db.refresh(availability)

    return availability


@router.get(
    "/me/availability",
    response_model=list[AvailabilityRead],
)
def list_my_availability(
    current_user: User = Depends(
        require_role(UserRole.teacher)
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id
            == current_user.id
        )
        .order_by(
            TeacherAvailability.day_of_week,
            TeacherAvailability.start_time,
        )
        .all()
    )


@router.delete(
    "/me/availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_availability(
    availability_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.teacher)
    ),
    db: Session = Depends(get_db),
):
    availability = db.get(
        TeacherAvailability,
        availability_id,
    )

    if (
        availability is None
        or availability.teacher_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Availability slot not found",
        )

    db.delete(availability)
    db.commit()

    return None


# ============================================================
# PUBLIC TEACHER MARKETPLACE
# ============================================================

@router.get(
    "",
    response_model=list[TeacherPublicRead],
)
def browse_teachers(
    subject_id: int | None = Query(
        default=None,
    ),
    db: Session = Depends(get_db),
):
    query = (
        db.query(TeacherProfile)
        .join(
            User,
            User.id == TeacherProfile.user_id,
        )
        .filter(
            TeacherProfile.is_verified.is_(True),
            User.is_active.is_(True),
        )
    )

    if subject_id is not None:
        query = (
            query
            .join(
                TeacherSubject,
                TeacherSubject.teacher_id
                == TeacherProfile.user_id,
            )
            .filter(
                TeacherSubject.subject_id
                == subject_id,
            )
        )

    profiles = (
        query
        .order_by(
            TeacherProfile.rating_avg.desc(),
            TeacherProfile.rating_count.desc(),
        )
        .all()
    )

    teachers = []

    for profile in profiles:
        user = db.get(
            User,
            profile.user_id,
        )

        if user is not None:
            teachers.append(
                _build_public_teacher(
                    profile,
                    user,
                    db,
                )
            )

    return teachers


@router.get(
    "/{teacher_id}",
    response_model=TeacherPublicRead,
)
def get_teacher_public_profile(
    teacher_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    profile = db.get(
        TeacherProfile,
        teacher_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    user = db.get(
        User,
        teacher_id,
    )

    if (
        user is None
        or not user.is_active
        or not profile.is_verified
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return _build_public_teacher(
        profile,
        user,
        db,
    )


# ============================================================
# PUBLIC AVAILABILITY
# ============================================================

@router.get(
    "/{teacher_id}/availability",
    response_model=list[AvailabilityRead],
)
def get_teacher_availability(
    teacher_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    profile = db.get(
        TeacherProfile,
        teacher_id,
    )

    if (
        profile is None
        or not profile.is_verified
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    return (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id
            == teacher_id
        )
        .order_by(
            TeacherAvailability.day_of_week,
            TeacherAvailability.start_time,
        )
        .all()
    )


# ============================================================
# AVAILABLE SLOTS
#
# Temporary/simple version.
# Phase 3 will make timezone handling and slot generation
# production-grade.
# ============================================================

@router.get(
    "/{teacher_id}/slots",
    response_model=list[SlotRead],
)
def get_available_slots(
    teacher_id: uuid.UUID,
    date: date = Query(...),
    duration_minutes: int = Query(
        default=60,
        ge=15,
        le=180,
    ),
    db: Session = Depends(get_db),
):
    profile = db.get(
        TeacherProfile,
        teacher_id,
    )

    if (
        profile is None
        or not profile.is_verified
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )

    day_of_week = (
        date.weekday() + 1
    ) % 7

    windows = (
        db.query(TeacherAvailability)
        .filter(
            TeacherAvailability.teacher_id
            == teacher_id,
            TeacherAvailability.day_of_week
            == day_of_week,
        )
        .order_by(
            TeacherAvailability.start_time
        )
        .all()
    )

    if not windows:
        return []

    day_start = datetime.combine(
        date,
        datetime.min.time(),
    )

    day_end = (
        day_start
        + timedelta(days=1)
    )

    existing_bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id
            == teacher_id,
            or_(
                Booking.status
                == BookingStatus.confirmed,

                and_(
                    Booking.status
                    == BookingStatus.pending,

                    Booking.created_at
                    >= datetime.now(
                        timezone.utc
                    )
                    - timedelta(
                        minutes=15
                    ),
                ),
            ),
            Booking.scheduled_at
            >= day_start,
            Booking.scheduled_at
            < day_end,
        )
        .all()
    )

    booked_ranges = [
        (
            booking.scheduled_at,
            booking.scheduled_at
            + timedelta(
                minutes=booking.duration_minutes
            ),
        )
        for booking in existing_bookings
    ]

    requested_duration = timedelta(
        minutes=duration_minutes
    )

    step = timedelta(
        minutes=SLOT_DURATION_MINUTES
    )

    slots: list[SlotRead] = []

    for window in windows:

        window_start = datetime.combine(
            date,
            window.start_time,
        )

        window_end = datetime.combine(
            date,
            window.end_time,
        )

        cursor = window_start

        while (
            cursor + requested_duration
            <= window_end
        ):
            slot_end = (
                cursor
                + requested_duration
            )

            overlaps = any(
                cursor < booking_end
                and slot_end > booking_start
                for (
                    booking_start,
                    booking_end,
                ) in booked_ranges
            )

            if not overlaps:
                slots.append(
                    SlotRead(
                        start_time=cursor,
                        end_time=slot_end,
                    )
                )

            cursor += step

    return slots