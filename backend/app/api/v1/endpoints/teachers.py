import uuid
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.core.constants import SLOT_DURATION_MINUTES
from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.schemas.profile import TeacherProfileRead, TeacherProfileUpdate, TeacherPublicRead

router = APIRouter()

def _get_teacher_profile(teacher_id: uuid.UUID, db: Session) -> TeacherProfile:
    profile = db.get(TeacherProfile, teacher_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher profile not found")
    return profile

def _get_teacher_subject_ids(teacher_id: uuid.UUID, db: Session) -> list[int]:
    return [row[0] for row in db.query(TeacherSubject.subject_id).filter(TeacherSubject.teacher_id == teacher_id).all()]

def _build_teacher_profile_read(profile: TeacherProfile, db: Session) -> TeacherProfileRead:
    return TeacherProfileRead(user_id=profile.user_id,bio=profile.bio,qualifications=profile.qualifications,years_experience=profile.years_experience,hourly_rate=profile.hourly_rate,is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count,subject_ids=_get_teacher_subject_ids(profile.user_id,db))

def _build_public_teacher(profile: TeacherProfile, user: User, db: Session) -> TeacherPublicRead:
    return TeacherPublicRead(user_id=profile.user_id,full_name=user.full_name,avatar_url=user.avatar_url,bio=profile.bio,qualifications=profile.qualifications,years_experience=profile.years_experience,hourly_rate=profile.hourly_rate,is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count,subject_ids=_get_teacher_subject_ids(profile.user_id,db))

def _validate_application(profile: TeacherProfile, subject_ids: list[int], user: User):
    missing=[]
    if not user.full_name or len(user.full_name.strip()) < 2: missing.append("full_name")
    if not user.phone or len(user.phone.strip()) < 7: missing.append("phone")
    if not profile.bio or not profile.bio.strip(): missing.append("bio")
    if not profile.qualifications or not profile.qualifications.strip(): missing.append("qualifications")
    if profile.years_experience is None: missing.append("years_experience")
    if profile.hourly_rate is None: missing.append("hourly_rate")
    if not subject_ids: missing.append("subject_ids")
    if missing:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message":"Complete every required teacher profile field before submitting your application.","missing_fields":missing})

@router.get("/me/profile", response_model=TeacherProfileRead)
def get_my_teacher_profile(current_user: User = Depends(require_role(UserRole.teacher)), db: Session = Depends(get_db)):
    return _build_teacher_profile_read(_get_teacher_profile(current_user.id,db),db)

@router.patch("/me/profile", response_model=TeacherProfileRead)
def update_my_teacher_profile(payload: TeacherProfileUpdate,current_user: User = Depends(require_role(UserRole.teacher)),db: Session = Depends(get_db)):
    profile=_get_teacher_profile(current_user.id,db)
    fields=payload.model_dump(exclude_unset=True,exclude={"subject_ids"})
    if "years_experience" in fields and fields["years_experience"] is not None and fields["years_experience"] < 0: raise HTTPException(status_code=400,detail="Years of experience cannot be negative")
    if "hourly_rate" in fields and fields["hourly_rate"] is not None and fields["hourly_rate"] < 0: raise HTTPException(status_code=400,detail="Hourly rate cannot be negative")
    for field,value in fields.items(): setattr(profile,field,value)
    if payload.subject_ids is not None:
        subject_ids=list(dict.fromkeys(payload.subject_ids))
        existing={row[0] for row in db.query(Subject.id).filter(Subject.id.in_(subject_ids)).all()} if subject_ids else set()
        invalid=set(subject_ids)-existing
        if invalid: raise HTTPException(status_code=400,detail="Invalid subject IDs: "+", ".join(str(v) for v in sorted(invalid)))
        db.query(TeacherSubject).filter(TeacherSubject.teacher_id==current_user.id).delete(synchronize_session=False)
        for subject_id in subject_ids: db.add(TeacherSubject(teacher_id=current_user.id,subject_id=subject_id))
    db.flush()
    subject_ids=_get_teacher_subject_ids(current_user.id,db)
    _validate_application(profile,subject_ids,current_user)
    db.commit();db.refresh(profile)
    return _build_teacher_profile_read(profile,db)
