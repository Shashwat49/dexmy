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
    TeacherProfile,
    TeacherSubject,
)
from app.models.user import User, UserRole

from app.schemas.profile import (
    TeacherProfileRead,
    TeacherProfileUpdate,
    TeacherPublicRead,
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
