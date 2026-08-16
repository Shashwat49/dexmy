from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.student import StudentProfile
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.profile import (
    StudentProfileRead,
    StudentProfileUpdate,
    TeacherProfileRead,
    TeacherProfileUpdate,
)

router = APIRouter()


# ============================================================
# STUDENT PROFILE
# ============================================================

@router.get(
    "/student",
    response_model=StudentProfileRead,
)
def get_student_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=403,
            detail="Only students can access this profile",
        )

    profile = (
        db.query(StudentProfile)
        .filter(
            StudentProfile.user_id == current_user.id
        )
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        )

    return profile


@router.patch(
    "/student",
    response_model=StudentProfileRead,
)
def update_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=403,
            detail="Only students can update this profile",
        )

    profile = (
        db.query(StudentProfile)
        .filter(
            StudentProfile.user_id == current_user.id
        )
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Student profile not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile


# ============================================================
# TEACHER PROFILE
# ============================================================

@router.get(
    "/teacher",
    response_model=TeacherProfileRead,
)
def get_teacher_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.teacher:
        raise HTTPException(
            status_code=403,
            detail="Only teachers can access this profile",
        )

    profile = (
        db.query(TeacherProfile)
        .filter(
            TeacherProfile.user_id == current_user.id
        )
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    return profile


@router.patch(
    "/teacher",
    response_model=TeacherProfileRead,
)
def update_teacher_profile(
    payload: TeacherProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.teacher:
        raise HTTPException(
            status_code=403,
            detail="Only teachers can update this profile",
        )

    profile = (
        db.query(TeacherProfile)
        .filter(
            TeacherProfile.user_id == current_user.id
        )
        .first()
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Teacher profile not found",
        )

    for field, value in payload.model_dump(
        exclude={"subject_ids"},
        exclude_unset=True,
    ).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile