import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.teacher_profile_change_request import TeacherProfileChangeRequest
from app.models.user import User, UserRole
from app.schemas.admin_teacher import (
    AdminTeacherDetail,
    AdminTeacherListItem,
    AdminTeacherStatusUpdate,
    AdminTeacherSubjectRead,
    AdminTeacherSubjectUpdate,
)
from app.services.audit_service import record_admin_action

router = APIRouter()

@router.get("", response_model=list[AdminTeacherListItem])
def list_admin_teachers(verified: bool | None = None, active: bool | None = None, subject_id: int | None = None, current_user: User = Depends(require_permission("teacher.read")), db: Session = Depends(get_db)):
    completed=select(func.count(Booking.id)).where(Booking.teacher_id==User.id,Booking.status==BookingStatus.completed).correlate(User).scalar_subquery(); upcoming=select(func.count(Booking.id)).where(Booking.teacher_id==User.id,Booking.status==BookingStatus.confirmed).correlate(User).scalar_subquery(); subject_count=select(func.count(TeacherSubject.subject_id)).where(TeacherSubject.teacher_id==User.id).correlate(User).scalar_subquery()
    query=select(User,TeacherProfile,subject_count,completed,upcoming).join(TeacherProfile,TeacherProfile.user_id==User.id).where(User.role==UserRole.teacher)
    if verified is not None: query=query.where(TeacherProfile.is_verified.is_(verified))
    if active is not None: query=query.where(User.is_active.is_(active))
    if subject_id is not None: query=query.join(TeacherSubject,TeacherSubject.teacher_id==User.id).where(TeacherSubject.subject_id==subject_id)
    rows=db.execute(query.order_by(User.created_at.desc())).all()
    return [AdminTeacherListItem(id=u.id,full_name=u.full_name,email=u.email,phone=u.phone,is_active=u.is_active,is_verified=p.is_verified,rating_avg=p.rating_avg,rating_count=p.rating_count,years_experience=p.years_experience,hourly_rate=p.hourly_rate,subject_count=int(s or 0),completed_classes=int(d or 0),upcoming_classes=int(x or 0)) for u,p,s,d,x in rows]

@router.get("/{teacher_id}", response_model=AdminTeacherDetail)
def get_admin_teacher(teacher_id: uuid.UUID, current_user: User = Depends(require_permission("teacher.read")), db: Session = Depends(get_db)):
    row=db.execute(select(User,TeacherProfile).join(TeacherProfile,TeacherProfile.user_id==User.id).where(User.id==teacher_id,User.role==UserRole.teacher)).one_or_none()
    if row is None: raise HTTPException(status_code=404,detail="Teacher not found")
    user,profile=row; subjects=db.execute(select(Subject.name).join(TeacherSubject,TeacherSubject.subject_id==Subject.id).where(TeacherSubject.teacher_id==teacher_id).order_by(Subject.name.asc())).scalars().all(); completed=db.execute(select(func.count(Booking.id)).where(Booking.teacher_id==teacher_id,Booking.status==BookingStatus.completed)).scalar_one(); upcoming=db.execute(select(func.count(Booking.id)).where(Booking.teacher_id==teacher_id,Booking.status==BookingStatus.confirmed)).scalar_one()
    return AdminTeacherDetail(id=user.id,full_name=user.full_name,email=user.email,phone=user.phone,is_active=user.is_active,is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count,years_experience=profile.years_experience,hourly_rate=profile.hourly_rate,subject_count=len(subjects),completed_classes=int(completed),upcoming_classes=int(upcoming),bio=profile.bio,qualifications=profile.qualifications,subjects=list(subjects),created_at=user.created_at)

@router.get("/profile-change-requests", response_model=list[dict])
def list_profile_change_requests(current_user: User = Depends(require_permission("teacher.read")), db: Session = Depends(get_db)):
    rows=db.execute(select(TeacherProfileChangeRequest,User).join(User,User.id==TeacherProfileChangeRequest.teacher_id).order_by(TeacherProfileChangeRequest.created_at.desc())).all()
    return [{"id":r.id,"teacher_id":u.id,"teacher_name":u.full_name,"teacher_email":u.email,"requested_changes":r.requested_changes,"status":r.status,"reviewed_by":r.reviewed_by,"review_reason":r.review_reason,"created_at":r.created_at,"reviewed_at":r.reviewed_at} for r,u in rows]

@router.patch("/profile-change-requests/{request_id}/review", response_model=dict)
def review_profile_change_request(request_id: uuid.UUID, payload: dict, request: Request, current_user: User = Depends(require_permission("teacher.verify")), db: Session = Depends(get_db)):
    item=db.get(TeacherProfileChangeRequest,request_id)
    if item is None: raise HTTPException(status_code=404,detail="Profile change request not found")
    if item.status != "pending": raise HTTPException(status_code=409,detail="This request has already been reviewed")
    decision=str(payload.get("status","")).lower(); reason=payload.get("review_reason")
    if decision not in {"approved","rejected"}: raise HTTPException(status_code=422,detail="Status must be approved or rejected")
    if decision=="rejected" and not reason: raise HTTPException(status_code=422,detail="A rejection reason is required")
    if decision=="approved":
        profile=db.get(TeacherProfile,item.teacher_id); changes=item.requested_changes or {}
        for field in ("bio","qualifications","years_experience","hourly_rate"):
            if field in changes: setattr(profile,field,changes[field])
        if "subject_ids" in changes:
            ids=list(dict.fromkeys(changes["subject_ids"] or [])); existing={x[0] for x in db.execute(select(Subject.id).where(Subject.id.in_(ids))).all()}
            if set(ids)!=existing: raise HTTPException(status_code=422,detail="Profile request contains invalid subjects")
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id==item.teacher_id).delete(synchronize_session=False)
            for sid in ids: db.add(TeacherSubject(teacher_id=item.teacher_id,subject_id=sid))
    item.status=decision; item.reviewed_by=current_user.id; item.review_reason=reason; item.reviewed_at=datetime.now(timezone.utc)
    record_admin_action(db,admin_user_id=current_user.id,action=f"teacher.profile_change.{decision}",resource_type="teacher_profile_change_request",resource_id=item.id,new_values={"status":decision,"review_reason":reason},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")); db.commit()
    return {"id":item.id,"status":item.status,"reviewed_at":item.reviewed_at}

@router.patch("/{teacher_id}/status", response_model=AdminTeacherListItem)
def update_teacher_status(teacher_id: uuid.UUID,payload: AdminTeacherStatusUpdate,request: Request,current_user: User = Depends(require_permission("teacher.suspend")),db: Session = Depends(get_db)):
    user=db.execute(select(User).where(User.id==teacher_id,User.role==UserRole.teacher)).scalar_one_or_none()
    if user is None: raise HTTPException(status_code=404,detail="Teacher not found")
    old=user.is_active; user.is_active=payload.is_active; record_admin_action(db,admin_user_id=current_user.id,action="teacher.status.update",resource_type="teacher",resource_id=teacher_id,old_values={"is_active":old},new_values={"is_active":payload.is_active},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")); db.commit(); profile=db.get(TeacherProfile,teacher_id)
    return AdminTeacherListItem(id=user.id,full_name=user.full_name,email=user.email,phone=user.phone,is_active=user.is_active,is_verified=profile.is_verified,rating_avg=profile.rating_avg,rating_count=profile.rating_count,years_experience=profile.years_experience,hourly_rate=profile.hourly_rate,subject_count=db.execute(select(func.count(TeacherSubject.subject_id)).where(TeacherSubject.teacher_id==teacher_id)).scalar_one(),completed_classes=db.execute(select(func.count(Booking.id)).where(Booking.teacher_id==teacher_id,Booking.status==BookingStatus.completed)).scalar_one(),upcoming_classes=db.execute(select(func.count(Booking.id)).where(Booking.teacher_id==teacher_id,Booking.status==BookingStatus.confirmed)).scalar_one())

@router.get("/{teacher_id}/subjects",response_model=list[AdminTeacherSubjectRead])
def list_teacher_subjects(teacher_id:uuid.UUID,current_user:User=Depends(require_permission("teacher.read")),db:Session=Depends(get_db)):
    if db.execute(select(User.id).where(User.id==teacher_id,User.role==UserRole.teacher)).scalar_one_or_none() is None: raise HTTPException(status_code=404,detail="Teacher not found")
    rows=db.execute(select(TeacherSubject.subject_id,Subject.name).join(Subject,Subject.id==TeacherSubject.subject_id).where(TeacherSubject.teacher_id==teacher_id).order_by(Subject.name.asc())).all(); return [AdminTeacherSubjectRead(subject_id=i,subject_name=n) for i,n in rows]

@router.post("/{teacher_id}/subjects",response_model=AdminTeacherSubjectRead,status_code=201)
def add_teacher_subject(teacher_id:uuid.UUID,payload:AdminTeacherSubjectUpdate,request:Request,current_user:User=Depends(require_permission("teacher.assign_subject")),db:Session=Depends(get_db)):
    if db.execute(select(User.id).where(User.id==teacher_id,User.role==UserRole.teacher)).scalar_one_or_none() is None: raise HTTPException(status_code=404,detail="Teacher not found")
    subject=db.get(Subject,payload.subject_id)
    if subject is None: raise HTTPException(status_code=404,detail="Subject not found")
    if db.execute(select(TeacherSubject).where(TeacherSubject.teacher_id==teacher_id,TeacherSubject.subject_id==payload.subject_id)).scalar_one_or_none(): raise HTTPException(status_code=409,detail="Teacher is already assigned to this subject")
    db.add(TeacherSubject(teacher_id=teacher_id,subject_id=payload.subject_id)); record_admin_action(db,admin_user_id=current_user.id,action="teacher.subject.add",resource_type="teacher",resource_id=teacher_id,new_values={"subject_id":payload.subject_id},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")); db.commit(); return AdminTeacherSubjectRead(subject_id=subject.id,subject_name=subject.name)

@router.delete("/{teacher_id}/subjects/{subject_id}",status_code=204)
def remove_teacher_subject(teacher_id:uuid.UUID,subject_id:int,request:Request,current_user:User=Depends(require_permission("teacher.assign_subject")),db:Session=Depends(get_db)):
    assignment=db.execute(select(TeacherSubject).where(TeacherSubject.teacher_id==teacher_id,TeacherSubject.subject_id==subject_id)).scalar_one_or_none()
    if assignment is None: raise HTTPException(status_code=404,detail="Teacher is not assigned to this subject")
    db.delete(assignment); record_admin_action(db,admin_user_id=current_user.id,action="teacher.subject.remove",resource_type="teacher",resource_id=teacher_id,old_values={"subject_id":subject_id},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent")); db.commit()
