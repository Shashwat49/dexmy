import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession
from app.models.teacher import Subject
from app.models.user import User, UserRole
from app.schemas.booking import BookingRead, BookingDetailRead
from app.schemas.classroom import ClassSessionRead

router = APIRouter()


@router.get("/me", response_model=list[BookingDetailRead])
def list_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Booking)

    if current_user.role == UserRole.teacher:
        query = query.filter(Booking.teacher_id == current_user.id)
    else:
        query = query.filter(Booking.student_id == current_user.id)

    bookings = query.order_by(Booking.scheduled_at).all()

    results = []

    for booking in bookings:
        student_user = db.get(User, booking.student_id)
        teacher_user = db.get(User, booking.teacher_id)
        subject = db.get(Subject, booking.subject_id)

        results.append(
            BookingDetailRead(
                id=booking.id,
                student_id=booking.student_id,
                student_name=(
                    student_user.full_name
                    if student_user
                    else "Unknown"
                ),
                teacher_id=booking.teacher_id,
                teacher_name=(
                    teacher_user.full_name
                    if teacher_user
                    else "Unknown"
                ),
                subject_id=booking.subject_id,
                subject_name=(
                    subject.name
                    if subject
                    else "Unknown"
                ),
                scheduled_at=booking.scheduled_at,
                duration_minutes=booking.duration_minutes,
                status=booking.status,
                price=booking.price,
                created_at=booking.created_at,
            )
        )

    return results


@router.patch(
    "/{booking_id}/cancel",
    response_model=BookingRead,
)
def cancel_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if current_user.id not in (
        booking.student_id,
        booking.teacher_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your booking",
        )

    if booking.status in (
        BookingStatus.cancelled,
        BookingStatus.completed,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking already closed out",
        )

    booking.status = BookingStatus.cancelled

    db.commit()
    db.refresh(booking)

    return booking


@router.get(
    "/{booking_id}/session",
    response_model=ClassSessionRead,
)
def get_booking_session(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if current_user.id not in (
        booking.student_id,
        booking.teacher_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your booking",
        )

    session = (
        db.query(ClassSession)
        .filter(ClassSession.booking_id == booking_id)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found for this booking",
        )

    return session