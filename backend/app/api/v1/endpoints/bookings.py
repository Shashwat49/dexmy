import uuid
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db

from app.models.booking import (
    Booking,
    BookingStatus,
)
from app.models.classroom import ClassSession
from app.models.free_class import (
    StudentFreeClassUse,
)
from app.models.teacher import Subject
from app.models.user import User, UserRole

from app.schemas.booking import (
    AvailableSlotsRead,
    BookingCreate,
    BookingDetailRead,
    BookingRead,
)

from app.schemas.classroom import (
    ClassSessionRead,
)

from app.services.booking_service import (
    create_booking_atomic,
    cancel_booking_atomic,
    get_available_slots,
    get_free_class_status,
    validate_requested_slot,
)

from app.services.scheduling_service import (
    can_accept_booking,
)


router = APIRouter()

UNLIMITED_FREE_CLASS_STUDENT_ID = uuid.UUID(
    "c451405f-924b-411a-9ddf-049cc7127091"
)

# ============================================================
# AVAILABLE SLOTS
# ============================================================

@router.get(
    "/available-slots",
    response_model=AvailableSlotsRead,
)
def available_slots(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can view booking slots.")

    subject = db.get(Subject, subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    slots = get_available_slots(db=db, subject_id=subject_id)

    from app.services.booking_service import get_tomorrow_ist

    return AvailableSlotsRead(
        date=str(get_tomorrow_ist()),
        timezone="Asia/Kolkata",
        slots=slots,
    )


# ============================================================
# CREATE BOOKING
# ============================================================

@router.post(
    "",
    response_model=BookingDetailRead,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can book classes.")

    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    try:
        scheduled_at = validate_requested_slot(payload.scheduled_at)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    is_unlimited_free_student = current_user.id == UNLIMITED_FREE_CLASS_STUDENT_ID

    is_free, remaining_free = get_free_class_status(
        db=db,
        student_id=current_user.id,
        subject_id=payload.subject_id,
    )

    if is_unlimited_free_student:
        is_free = True
        remaining_free = -1

    if is_free:
        price = 0
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Paid class booking will be enabled after payment pricing is configured.",
        )

    try:
        booking = create_booking_atomic(
            db=db,
            student_id=current_user.id,
            subject_id=payload.subject_id,
            scheduled_at=scheduled_at,
            price=price,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    db.commit()
    db.refresh(booking)

    student_user = db.get(User, booking.student_id)

    return BookingDetailRead(
        id=booking.id,
        student_id=booking.student_id,
        student_name=student_user.full_name if student_user else "Unknown",
        teacher_id=None,
        teacher_name=None,
        subject_id=booking.subject_id,
        subject_name=subject.name,
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
        status=booking.status,
        price=float(booking.price) if booking.price is not None else None,
        created_at=booking.created_at,
        teacher_assignment_status=booking.teacher_assignment_status,
        idempotency_key=booking.idempotency_key,
    )


# ============================================================
# MY BOOKINGS
# ============================================================

@router.get(
    "/me",
    response_model=list[BookingDetailRead],
)
def list_my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Booking)

    if current_user.role == UserRole.teacher:
        query = query.filter(Booking.teacher_id == current_user.id)
    elif current_user.role == UserRole.student:
        query = query.filter(Booking.student_id == current_user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed.")

    bookings = query.order_by(Booking.scheduled_at.asc()).all()
    results = []

    for booking in bookings:
        student_user = db.get(User, booking.student_id)
        teacher_user = db.get(User, booking.teacher_id) if booking.teacher_id is not None else None
        subject = db.get(Subject, booking.subject_id)

        results.append(
            BookingDetailRead(
                id=booking.id,
                student_id=booking.student_id,
                student_name=student_user.full_name if student_user else "Unknown",
                teacher_id=booking.teacher_id,
                teacher_name=teacher_user.full_name if teacher_user else None,
                subject_id=booking.subject_id,
                subject_name=subject.name if subject else "Unknown",
                scheduled_at=booking.scheduled_at,
                duration_minutes=booking.duration_minutes,
                status=booking.status,
                price=float(booking.price) if booking.price is not None else None,
                created_at=booking.created_at,
                teacher_assignment_status=booking.teacher_assignment_status,
            )
        )

    return results


# ============================================================
# CANCEL
# ============================================================

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    allowed_ids = {booking.student_id}
    if booking.teacher_id is not None:
        allowed_ids.add(booking.teacher_id)

    if current_user.id not in allowed_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")

    try:
        booking = cancel_booking_atomic(db=db, booking=booking)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    db.commit()
    db.refresh(booking)
    return booking


# ============================================================
# CLASS SESSION
# ============================================================

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    allowed_ids = {booking.student_id}
    if booking.teacher_id is not None:
        allowed_ids.add(booking.teacher_id)

    if current_user.id not in allowed_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")

    session = db.query(ClassSession).filter(ClassSession.booking_id == booking_id).first()

    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found for this booking")

    return session
