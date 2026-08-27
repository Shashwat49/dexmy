import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.schemas.admin_students import AdminStudentDetailRead, AdminStudentListResponse, AdminStudentRead, AdminStudentStatusUpdate
from app.services.audit_service import record_admin_action

router = APIRouter()

@router.get("", response_model=AdminStudentListResponse)
def list_students(search: str | None = Query(default=None, min_length=1, max_length=100), is_active: bool | None = None, page: int = Query(default=1, ge=1), page_size: int = Query(default=25, ge=1, le=100), current_user: User = Depends(require_permission("student.read")), db: Session = Depends(get_db)):
    base = select(User).where(User.role == UserRole.student)
    if is_active is not None: base = base.where(User.is_active.is_(is_active))
    if search:
        term = f"%{search.strip()}%"
        base = base.where((User.full_name.ilike(term)) | (User.email.ilike(term)) | (User.phone.ilike(term)))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    users = db.scalars(base.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    if not users:
        return AdminStudentListResponse(items=[], total=total, page=page, page_size=page_size)
    ids = [u.id for u in users]
    profiles = {p.user_id: p for p in db.scalars(select(StudentProfile).where(StudentProfile.user_id.in_(ids))).all()}
    counts = db.execute(select(Booking.student_id, func.count().label("total"), func.sum(case((Booking.status == BookingStatus.completed, 1), else_=0)).label("completed"), func.sum(case((Booking.scheduled_at >= func.now(), 1), else_=0) * case((Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]), 1), else_=0)).label("upcoming")).where(Booking.student_id.in_(ids)).group_by(Booking.student_id)).all()
    count_map = {r.student_id: r for r in counts}
    items = []
    for user in users:
        p = profiles.get(user.id); c = count_map.get(user.id)
        items.append(AdminStudentRead(id=user.id,email=user.email,full_name=user.full_name,phone=user.phone,avatar_url=user.avatar_url,is_active=user.is_active,email_verified=user.email_verified,created_at=user.created_at,grade_level=p.grade_level if p else None,school_name=p.school_name if p else None,date_of_birth=p.date_of_birth if p else None,total_bookings=int(c.total or 0) if c else 0,completed_classes=int(c.completed or 0) if c else 0,upcoming_classes=int(c.upcoming or 0) if c else 0))
    return AdminStudentListResponse(items=items,total=total,page=page,page_size=page_size)

@router.get("/{student_id}", response_model=AdminStudentDetailRead)
def get_student(student_id: uuid.UUID, current_user: User = Depends(require_permission("student.read")), db: Session = Depends(get_db)):
    student = db.scalar(select(User).where(User.id == student_id, User.role == UserRole.student))
    if student is None: raise HTTPException(status_code=404, detail="Student not found")
    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student.id))
    rows = db.execute(select(Booking.status, func.count()).where(Booking.student_id == student.id).group_by(Booking.status)).all()
    counts = {r.status: int(r[1]) for r in rows}; total = sum(counts.values())
    upcoming = db.scalar(select(func.count()).select_from(Booking).where(Booking.student_id == student.id, Booking.scheduled_at >= func.now(), Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]))) or 0
    return AdminStudentDetailRead(id=student.id,email=student.email,full_name=student.full_name,phone=student.phone,avatar_url=student.avatar_url,is_active=student.is_active,email_verified=student.email_verified,created_at=student.created_at,grade_level=profile.grade_level if profile else None,school_name=profile.school_name if profile else None,date_of_birth=profile.date_of_birth if profile else None,total_bookings=total,completed_classes=counts.get(BookingStatus.completed,0),upcoming_classes=upcoming,cancelled_classes=counts.get(BookingStatus.cancelled,0),no_show_classes=counts.get(BookingStatus.no_show,0),pending_classes=counts.get(BookingStatus.pending,0),confirmed_classes=counts.get(BookingStatus.confirmed,0))

@router.patch("/{student_id}/status", response_model=AdminStudentRead)
def update_student_status(student_id: uuid.UUID, payload: AdminStudentStatusUpdate, current_user: User = Depends(require_permission("student.suspend")), db: Session = Depends(get_db)):
    student = db.scalar(select(User).where(User.id == student_id, User.role == UserRole.student))
    if student is None: raise HTTPException(status_code=404, detail="Student not found")
    if student.is_active == payload.is_active: return get_student(student_id, current_user=current_user, db=db)
    old_value={"is_active":student.is_active}; student.is_active=payload.is_active
    record_admin_action(db,admin_user_id=current_user.id,action="student.activate" if payload.is_active else "student.suspend",resource_type="student",resource_id=student.id,old_values=old_value,new_values={"is_active":payload.is_active},reason=payload.reason)
    db.commit(); db.refresh(student)
    return get_student(student_id,current_user=current_user,db=db)
