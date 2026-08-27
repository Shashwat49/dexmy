import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.teacher import Subject
from app.models.user import User, UserRole
from app.schemas.admin_bookings import AdminBookingListResponse, AdminBookingRead

router = APIRouter()


def _booking_query(db: Session):
    return (
        select(
            Booking,
            User.full_name.label("student_name"),
            Subject.name.label("subject_name"),
        )
        .join(User, User.id == Booking.student_id)
        .join(Subject, Subject.id == Booking.subject_id)
    )


@router.get("", response_model=AdminBookingListResponse)
def list_bookings(
    current_user: User = Depends(require_permission("booking.read")),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: BookingStatus | None = Query(None, alias="status"),
    student_id: uuid.UUID | None = None,
    teacher_id: uuid.UUID | None = None,
    subject_id: int | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
):
    filters = []
    if status_filter is not None:
        filters.append(Booking.status == status_filter)
    if student_id is not None:
        filters.append(Booking.student_id == student_id)
    if teacher_id is not None:
        filters.append(Booking.teacher_id == teacher_id)
    if subject_id is not None:
        filters.append(Booking.subject_id == subject_id)
    if from_date is not None:
        filters.append(Booking.scheduled_at >= from_date)
    if to_date is not None:
        filters.append(Booking.scheduled_at <= to_date)

    total = db.execute(
        select(func.count()).select_from(Booking).where(*filters)
    ).scalar_one()

    rows = db.execute(
        _booking_query(db)
        .where(*filters)
        .order_by(Booking.scheduled_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    teacher_ids = {row.Booking.teacher_id for row in rows if row.Booking.teacher_id}
    teachers = {}
    if teacher_ids:
        teachers = dict(
            db.execute(
                select(User.id, User.full_name)
                .where(User.id.in_(teacher_ids), User.role == UserRole.teacher)
            ).all()
        )

    items = [
        AdminBookingRead(
            id=booking.id,
            student_id=booking.student_id,
            student_name=student_name,
            teacher_id=booking.teacher_id,
            teacher_name=teachers.get(booking.teacher_id) if booking.teacher_id else None,
            subject_id=booking.subject_id,
            subject_name=subject_name,
            scheduled_at=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            status=booking.status,
            price=float(booking.price) if booking.price is not None else None,
            teacher_assignment_status=booking.teacher_assignment_status,
            created_at=booking.created_at,
        )
        for booking, student_name, subject_name in rows
    ]

    return AdminBookingListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{booking_id}", response_model=AdminBookingRead)
def get_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(require_permission("booking.read")),
    db: Session = Depends(get_db),
):
    row = db.execute(
        _booking_query(db).where(Booking.id == booking_id)
    ).first()

    if row is None:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    booking, student_name, subject_name = row
    teacher_name = None
    if booking.teacher_id:
        teacher_name = db.execute(
            select(User.full_name).where(
                User.id == booking.teacher_id,
                User.role == UserRole.teacher,
            )
        ).scalar_one_or_none()

    return AdminBookingRead(
        id=booking.id,
        student_id=booking.student_id,
        student_name=student_name,
        teacher_id=booking.teacher_id,
        teacher_name=teacher_name,
        subject_id=booking.subject_id,
        subject_name=subject_name,
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
        status=booking.status,
        price=float(booking.price) if booking.price is not None else None,
        teacher_assignment_status=booking.teacher_assignment_status,
        created_at=booking.created_at,
    )
