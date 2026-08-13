import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.teacher import TeacherProfile
from app.models.user import User, UserRole
from app.schemas.user import UserRead

router = APIRouter()


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    role: UserRole | None = Query(None),
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(user_id: uuid.UUID, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/activate", response_model=UserRead)
def activate_user(user_id: uuid.UUID, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.patch("/teachers/{teacher_id}/verify", status_code=status.HTTP_204_NO_CONTENT)
def verify_teacher(teacher_id: uuid.UUID, current_user: User = Depends(require_role(UserRole.admin)), db: Session = Depends(get_db)):
    profile = db.get(TeacherProfile, teacher_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher profile not found")
    profile.is_verified = True
    db.commit()