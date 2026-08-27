import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.student import StudentProfile
from app.models.user import User, UserRole
from app.schemas.admin_students import (
    AdminStudentDetailRead,
    AdminStudentListResponse,
    AdminStudentRead,
    AdminStudentStatusUpdate,
)
from app.services.audit_service import record_admin_action

router = APIRouter()


@router.get("", response_model=AdminStudentListResponse)
def list_students(
    search: str | None = Query(default=None, min_length=1, max_length=100),
    is_active: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    base = select(User).where(User.role == UserRole.student)
    if is_active is not None:
        base = base.where(User.is_active.is_(is_active))
    if search:
        term = f"%{search.strip()}%"
        base = base.where(
            (User.full_name.ilike(term)) | (User.email.ilike(term)) | (User.phone.ilike(term))
        )

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    users = db.scalars(
        base.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items: list[AdminStudentRead] = []
    for user in users:
        profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == user.id)
        )
        total_bookings = db.scalar(
            select(func.count()).select_from(Booking).where(Booking.student_id == user.id)
        ) or 0
        completed_classes = db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.student_id == user.id,
                Booking.status == BookingStatus.completed,
            )
        ) or 0
        upcoming_classes = db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.student_id == user.id,
                Booking.scheduled_at >= func.now(),
                Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
            )
        ) or 0

        items.append(
            AdminStudentRead(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                phone=user.phone,
                avatar_url=user.avatar_url,
                is_active=user.is_active,
                email_verified=user.email_verified,
                created_at=user.created_at,
                grade_level=profile.grade_level if profile else None,
                school_name=profile.school_name if profile else None,
                date_of_birth=profile.date_of_birth if profile else None,
                total_bookings=total_bookings,
                completed_classes=completed_classes,
                upcoming_classes=upcoming_classes,
            )
        )

    return AdminStudentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{student_id}", response_model=AdminStudentDetailRead)
def get_student(
    student_id: uuid.UUID,
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    student = db.scalar(
        select(User).where(User.id == student_id, User.role == UserRole.student)
    )
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == student.id))

    counts = {}
    for name, booking_status in (
        ("completed_classes", BookingStatus.completed),
        ("cancelled_classes", BookingStatus.cancelled),
        ("no_show_classes", BookingStatus.no_show),
        ("pending_classes", BookingStatus.pending),
        ("confirmed_classes", BookingStatus.confirmed),
    ):
        counts[name] = db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.student_id == student.id,
                Booking.status == booking_status,
            )
        ) or 0

    total_bookings = db.scalar(
        select(func.count()).select_from(Booking).where(Booking.student_id == student.id)
    ) or 0
    upcoming_classes = db.scalar(
        select(func.count()).select_from(Booking).where(
            Booking.student_id == student.id,
            Booking.scheduled_at >= func.now(),
            Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed]),
        )
    ) or 0

    return AdminStudentDetailRead(
        id=student.id,
        email=student.email,
        full_name=student.full_name,
        phone=student.phone,
        avatar_url=student.avatar_url,
        is_active=student.is_active,
        email_verified=student.email_verified,
        created_at=student.created_at,
        grade_level=profile.grade_level if profile else None,
        school_name=profile.school_name if profile else None,
        date_of_birth=profile.date_of_birth if profile else None,
        total_bookings=total_bookings,
        completed_classes=counts["completed_classes"],
        upcoming_classes=upcoming_classes,
        cancelled_classes=counts["cancelled_classes"],
        no_show_classes=counts["no_show_classes"],
        pending_classes=counts["pending_classes"],
        confirmed_classes=counts["confirmed_classes"],
    )


@router.patch("/{student_id}/status", response_model=AdminStudentRead)
def update_student_status(
    student_id: uuid.UUID,
    payload: AdminStudentStatusUpdate,
    current_user: User = Depends(require_permission("student.suspend")),
    db: Session = Depends(get_db),
):
    student = db.scalar(
        select(User).where(User.id == student_id, User.role == UserRole.student)
    )
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.is_active == payload.is_active:
        return get_student(student_id, current_user=current_user, db=db)

    old_value = {"is_active": student.is_active}
    student.is_active = payload.is_active

    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="student.activate" if payload.is_active else "student.suspend",
        resource_type="student",
        resource_id=student.id,
        old_values=old_value,
        new_values={"is_active": payload.is_active},
        reason=payload.reason,
    )
    db.commit()
    db.refresh(student)

    return get_student(student_id, current_user=current_user, db=db)
