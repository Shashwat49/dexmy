from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.schemas.profile import StudentProfileRead, StudentProfileUpdate

router = APIRouter()


@router.get("/me/profile", response_model=StudentProfileRead)
def get_my_student_profile(
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    return db.get(StudentProfile, current_user.id)


@router.patch("/me/profile", response_model=StudentProfileRead)
def update_my_student_profile(
    payload: StudentProfileUpdate,
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    profile = db.get(StudentProfile, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile