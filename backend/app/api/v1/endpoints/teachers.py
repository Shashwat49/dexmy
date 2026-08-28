import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.teacher_profile_change_request import TeacherProfileChangeRequest
from app.models.user import User, UserRole
from app.schemas.profile import TeacherProfileRead, TeacherProfileUpdate
from app.schemas.teacher_profile_change import TeacherProfileChangeRequestRead
router=APIRouter()
def _get_teacher_profile(teacher_id,db):
    profile=db.get(TeacherProfile,teacher_id)
    if profile is None: raise HTTPException(status_code=404,detail="Teacher profile not found")
    return profile
def _get_teacher_subject_ids(teacher_id,db): return [row[0] for row in db.query(TeacherSubject.subject_id).filter(TeacherSubject.teacher_id==teacher_id).all()]
def _build_teacher_profile_read(profile,user,db): return TeacherProfileRead(user_id=profile.user_id,full_name=user.full_name,email=user.email,phone=user.phone,bio=profile.bio,qualifications=profile.qualifications,years_experience=profile.years_experience,hourly_rate=profile.hourly_rate,is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count,subject_ids=_get_teacher_subject_ids(profile.user_id,db))
def _validate_application(profile,subject_ids,user):
    missing=[]
    if not user.full_name or len(user.full_name.strip())<2: missing.append("full_name")
    if not user.phone or len(user.phone.strip())<7: missing.append("phone")
    if not profile.bio or not profile.bio.strip(): missing.append("bio")
    if not profile.qualifications or not profile.qualifications.strip(): missing.append("qualifications")
    if profile.years_experience is None: missing.append("years_experience")
    if profile.hourly_rate is None: missing.append("hourly_rate")
    if not subject_ids: missing.append("subject_ids")
    if missing: raise HTTPException(status_code=422,detail={"message":"Complete every required teacher profile field before submitting your application.","missing_fields":missing})
@router.get("/me/profile",response_model=TeacherProfileRead)
def get_my_teacher_profile(current_user=Depends(require_role(UserRole.teacher)),db=Depends(get_db)):
    return _build_teacher_profile_read(_get_teacher_profile(current_user.id,db),current_user,db)
@router.get("/me/profile/pending",response_model=TeacherProfileChangeRequestRead|None)
def get_my_pending_teacher_profile_change(current_user=Depends(require_role(UserRole.teacher)),db=Depends(get_db)):
    return db.execute(select(TeacherProfileChangeRequest).where(TeacherProfileChangeRequest.teacher_id==current_user.id,TeacherProfileChangeRequest.status=="pending").order_by(TeacherProfileChangeRequest.created_at.desc())).scalars().first()
@router.patch("/me/profile",response_model=TeacherProfileRead)
def update_my_teacher_profile(payload:TeacherProfileUpdate,current_user=Depends(require_role(UserRole.teacher)),db=Depends(get_db)):
    profile=_get_teacher_profile(current_user.id,db); incoming=payload.model_dump(exclude_unset=True)
    if not incoming: raise HTTPException(status_code=400,detail="No profile changes supplied")
    subject_ids=_get_teacher_subject_ids(current_user.id,db)
    if "subject_ids" in incoming:
        subject_ids=list(dict.fromkeys(incoming.pop("subject_ids") or [])); existing={row[0] for row in db.query(Subject.id).filter(Subject.id.in_(subject_ids)).all()} if subject_ids else set(); invalid=set(subject_ids)-existing
        if invalid: raise HTTPException(status_code=400,detail="Invalid subject IDs: "+", ".join(str(v) for v in sorted(invalid)))
    candidate=TeacherProfile(user_id=current_user.id,bio=incoming.get("bio",profile.bio),qualifications=incoming.get("qualifications",profile.qualifications),years_experience=incoming.get("years_experience",profile.years_experience),hourly_rate=incoming.get("hourly_rate",profile.hourly_rate),is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count)
    _validate_application(candidate,subject_ids,current_user)
    pending=db.execute(select(TeacherProfileChangeRequest).where(TeacherProfileChangeRequest.teacher_id==current_user.id,TeacherProfileChangeRequest.status=="pending")).scalars().first()
    if pending: raise HTTPException(status_code=409,detail="You already have a profile change awaiting admin review.")
    db.add(TeacherProfileChangeRequest(teacher_id=current_user.id,requested_changes={**incoming,"subject_ids":subject_ids},created_at=datetime.now(timezone.utc)));db.commit()
    return _build_teacher_profile_read(profile,current_user,db)
