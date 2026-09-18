from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.schemas.profile import StudentProfileRead, StudentProfileUpdate

router = APIRouter()


def _read_profile(profile: StudentProfile, user: User) -> StudentProfileRead:
    return StudentProfileRead(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        grade_level=profile.grade_level,
        school_name=profile.school_name,
        date_of_birth=profile.date_of_birth,
        gender=profile.gender,
        address=profile.address,
        city=profile.city,
        country=profile.country,
        board=profile.board,
        academic_year=profile.academic_year,
        subjects=profile.subjects,
        student_id_number=profile.student_id_number,
        parent_name=profile.parent_name,
        parent_email=profile.parent_email,
        parent_phone=profile.parent_phone,
        parent_relationship=profile.parent_relationship,
        parent_occupation=profile.parent_occupation,
    )


@router.get("/me/profile", response_model=StudentProfileRead)
def get_my_student_profile(
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    profile = db.get(StudentProfile, current_user.id)
    if profile is None:
        profile = StudentProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return _read_profile(profile, current_user)


@router.patch("/me/profile", response_model=StudentProfileRead)
def update_my_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    profile = db.get(StudentProfile, current_user.id)
    if profile is None:
        profile = StudentProfile(user_id=current_user.id)
        db.add(profile)

    values = payload.model_dump(exclude_unset=True)
    if "full_name" in values:
        current_user.full_name = values.pop("full_name")
    if "phone" in values:
        current_user.phone = values.pop("phone")
    for field, value in values.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    db.refresh(current_user)
    return _read_profile(profile, current_user)
