import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking
from app.models.teacher import Subject
from app.models.user import User, UserRole
from app.models.package import PackagePlan
from app.schemas.booking import BookingCreate, BookingDetailRead, BookingRead
from app.services.booking_service import (
    cancel_booking_atomic,
    create_booking_atomic,
    get_free_class_status,
    validate_requested_slot,
)
from app.services.package_credit_service import PackageCreditService

router = APIRouter()


def _booking_response(db: Session, booking: Booking) -> BookingDetailRead:
    student = db.get(User, booking.student_id)
    teacher = db.get(User, booking.teacher_id) if booking.teacher_id else None
    subject = db.get(Subject, booking.subject_id)
    return BookingDetailRead(
        id=booking.id,
        student_id=booking.student_id,
        student_name=student.full_name if student else "Unknown",
        teacher_id=booking.teacher_id,
        teacher_name=teacher.full_name if teacher else None,
        subject_id=booking.subject_id,
        subject_name=subject.name if subject else "Unknown",
        scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes,
        status=booking.status,
        price=float(booking.price) if booking.price is not None else None,
        created_at=booking.created_at,
        teacher_assignment_status=booking.teacher_assignment_status,
        idempotency_key=booking.idempotency_key,
    )


@router.post("", response_model=BookingDetailRead, status_code=status.HTTP_201_CREATED)
def create_package_aware_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a free booking or atomically consume one package credit."""
    if current_user.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can book classes.")

    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    try:
        scheduled_at = validate_requested_slot(payload.scheduled_at)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # Idempotent retries must never consume another credit.
    if payload.idempotency_key is not None:
        existing = db.query(Booking).filter(Booking.idempotency_key == payload.idempotency_key).first()
        if existing is not None:
            return _booking_response(db, existing)

    is_free, _ = get_free_class_status(
        db=db,
        student_id=current_user.id,
        subject_id=payload.subject_id,
    )

    package = None
    if is_free:
        price = 0
    else:
        package = PackageCreditService.select_active_package_for_student(
            db,
            student_id=current_user.id,
        )
        plan = db.get(PackagePlan, package.package_plan_id)
        if plan is None:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Package plan not found.")
        price = plan.price / package.total_classes

    try:
        booking = create_booking_atomic(
            db=db,
            student_id=current_user.id,
            subject_id=payload.subject_id,
            scheduled_at=scheduled_at,
            price=price,
            idempotency_key=payload.idempotency_key,
        )

        if package is not None:
            booking.student_package_id = package.id
            PackageCreditService.consume(
                db,
                student_package_id=package.id,
                booking_id=booking.id,
                created_by=current_user.id,
            )

        db.commit()
        db.refresh(booking)
        return _booking_response(db, booking)
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception:
        db.rollback()
        raise


@router.patch("/{booking_id}/cancel", response_model=BookingRead)
def cancel_package_aware_booking(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a booking and restore its package credit exactly once when applicable."""
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    if current_user.role not in {UserRole.student, UserRole.teacher}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed.")
    if current_user.id != booking.student_id and current_user.id != booking.teacher_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")

    try:
        booking = cancel_booking_atomic(db=db, booking=booking)
        if booking.student_package_id is not None:
            PackageCreditService.refund(
                db,
                student_package_id=booking.student_package_id,
                booking_id=booking.id,
                created_by=current_user.id,
            )
        db.commit()
        db.refresh(booking)
        return booking
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
