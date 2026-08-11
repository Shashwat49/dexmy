import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.classroom import ClassSession, SessionStatus
from app.models.teacher import TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingRead
from app.schemas.classroom import ClassSessionRead

from app.models.teacher import Subject
from app.schemas.booking import BookingDetailRead

router = APIRouter()

@router.get("/me", response_model=list[BookingRead])
def list_my_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.teacher:
        return db.query(Booking).filter(Booking.teacher_id == current_user.id).order_by(Booking.scheduled_at).all()
    return db.query(Booking).filter(Booking.student_id == current_user.id).order_by(Booking.scheduled_at).all()


@router.patch("/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(booking_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")
    if booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking already closed out")

    booking.status = BookingStatus.cancelled
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}/session", response_model=ClassSessionRead)
def get_booking_session(booking_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if current_user.id not in (booking.student_id, booking.teacher_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")

    session = db.query(ClassSession).filter(ClassSession.booking_id == booking_id).first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found for this booking")
    return session

@router.get("/me", response_model=list[BookingDetailRead])
def list_my_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Booking)
    if current_user.role == UserRole.teacher:
        query = query.filter(Booking.teacher_id == current_user.id)
    else:
        query = query.filter(Booking.student_id == current_user.id)
    bookings = query.order_by(Booking.scheduled_at).all()

    results = []
    for b in bookings:
        teacher_user = db.get(User, b.teacher_id)
        subject = db.get(Subject, b.subject_id)
        results.append(BookingDetailRead(
            id=b.id, student_id=b.student_id, teacher_id=b.teacher_id,
            teacher_name=teacher_user.full_name if teacher_user else "Unknown",
            subject_id=b.subject_id, subject_name=subject.name if subject else "Unknown",
            scheduled_at=b.scheduled_at, duration_minutes=b.duration_minutes,
            status=b.status, price=b.price, created_at=b.created_at,
        ))
    return results