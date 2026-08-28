import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.teacher_profile_change_request import TeacherProfileChangeRequest
from app.models.user import User, UserRole
from app.schemas.teacher_profile_change import TeacherProfileChangeRequestRead, TeacherProfileChangeReview
from app.services.audit_service import record_admin_action

router=APIRouter()

@router.get("", response_model=list[TeacherProfileChangeRequestRead])
def list_pending_requests(current_user:User=Depends(require_permission("teacher.read")),db:Session=Depends(get_db)):
    return db.execute(select(TeacherProfileChangeRequest).where(TeacherProfileChangeRequest.status=="pending").order_by(TeacherProfileChangeRequest.created_at.asc())).scalars().all()

@router.patch("/{request_id}", response_model=TeacherProfileChangeRequestRead)
def review_request(request_id:uuid.UUID,payload:TeacherProfileChangeReview,request:Request,current_user:User=Depends(require_permission("teacher.verify")),db:Session=Depends(get_db)):
    item=db.get(TeacherProfileChangeRequest,request_id)
    if item is None: raise HTTPException(status_code=404,detail="Profile change request not found")
    if item.status!="pending": raise HTTPException(status_code=409,detail="This request has already been reviewed")
    if not payload.approved:
        item.status="rejected";item.reviewed_by=current_user.id;item.review_reason=payload.reason or "Rejected by administrator";item.reviewed_at=datetime.now(timezone.utc)
    else:
        teacher=db.get(User,item.teacher_id);profile=db.get(TeacherProfile,item.teacher_id)
        if teacher is None or profile is None or teacher.role!=UserRole.teacher: raise HTTPException(status_code=404,detail="Teacher not found")
        changes=item.requested_changes or {}
        for field in ("bio","qualifications","years_experience","hourly_rate"):
            if field in changes: setattr(profile,field,changes[field])
        if "subject_ids" in changes:
            ids=list(dict.fromkeys(changes["subject_ids"] or []))
            valid={row[0] for row in db.query(Subject.id).filter(Subject.id.in_(ids)).all()} if ids else set()
            if set(ids)!=valid: raise HTTPException(status_code=422,detail="The requested subject list contains invalid subjects")
            db.query(TeacherSubject).filter(TeacherSubject.teacher_id==item.teacher_id).delete(synchronize_session=False)
            for subject_id in ids: db.add(TeacherSubject(teacher_id=item.teacher_id,subject_id=subject_id))
        profile.is_verified=True
        item.status="approved";item.reviewed_by=current_user.id;item.review_reason=payload.reason or "Approved by administrator";item.reviewed_at=datetime.now(timezone.utc)
        record_admin_action(db,admin_user_id=current_user.id,action="teacher.profile.change.approve",resource_type="teacher",resource_id=item.teacher_id,old_values={"is_verified":False},new_values={"is_verified":True,"requested_changes":changes},ip_address=request.client.host if request.client else None,user_agent=request.headers.get("user-agent"))
    db.commit();db.refresh(item);return item
