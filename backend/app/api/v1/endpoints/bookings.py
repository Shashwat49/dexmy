import uuid
from datetime import datetime, timezone

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
from app.models.teacher import (
    Subject,
    TeacherProfile,
)
from app.models.user import User, UserRole

from app.schemas.booking import (
    BookingCreate,
    BookingDetailRead,
    BookingRead,
)

from app.schemas.classroom import (
    ClassSessionRead,
)

from app.services.booking_service import (
    find_teacher_and_slot,
    get_free_class_status,
)


router = APIRouter()


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
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # Student-only
    # --------------------------------------------------------

    if current_user.role != UserRole.student:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only students can book classes.",
        )


    # --------------------------------------------------------
    # Subject exists
    # --------------------------------------------------------

    subject = db.get(
        Subject,
        payload.subject_id,
    )

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found.",
        )


    # --------------------------------------------------------
    # Determine free vs paid
    # --------------------------------------------------------

    is_free, remaining_free = get_free_class_status(
            db=db,
            student_id=current_user.id,
            subject_id=payload.subject_id,
        )


    # --------------------------------------------------------
    # Find teacher + earliest slot
    # --------------------------------------------------------

    allocation = find_teacher_and_slot(
            db=db,
            subject_id=payload.subject_id,
        )


    if allocation is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "No teacher is currently available "
                "for this subject."
            ),
        )


    teacher_id, scheduled_at = allocation


    # --------------------------------------------------------
    # Price
    #
    # TEMPORARY:
    # Paid classes currently use the teacher hourly rate.
    # Payment integration will be added in Phase 5.
    # --------------------------------------------------------

    teacher_profile = (
        db.query(TeacherProfile)
        .filter(
            TeacherProfile.user_id
            == teacher_id
        )
        .first()
    )


    if is_free:

        price = 0

    else:

        price = (
            float(
                teacher_profile.hourly_rate
            )
            if teacher_profile
            and teacher_profile.hourly_rate
            is not None
            else None
        )


        if price is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "This class requires payment, "
                    "but a class price has not been "
                    "configured."
                ),
            )


    # --------------------------------------------------------
    # Create booking
    # --------------------------------------------------------

    booking = Booking(
        student_id=current_user.id,

        teacher_id=teacher_id,

        subject_id=payload.subject_id,

        scheduled_at=scheduled_at,

        duration_minutes=60,

        status=BookingStatus.confirmed,

        price=price,
    )


    db.add(booking)

    db.flush()


    # --------------------------------------------------------
    # Consume free class
    # --------------------------------------------------------

    if is_free:

        free_use = StudentFreeClassUse(
            student_id=current_user.id,

            subject_id=payload.subject_id,

            booking_id=booking.id,
        )

        db.add(free_use)


    # --------------------------------------------------------
    # Create classroom session
    # --------------------------------------------------------

    session = ClassSession(
        booking_id=booking.id,

        livekit_room_name=(
            f"dexmy-class-{booking.id}"
        ),
    )

    db.add(session)


    db.commit()

    db.refresh(booking)


    # --------------------------------------------------------
    # Build response
    # --------------------------------------------------------

    student_user = db.get(
        User,
        booking.student_id,
    )

    teacher_user = db.get(
        User,
        booking.teacher_id,
    )


    return BookingDetailRead(
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

        subject_name=subject.name,

        scheduled_at=booking.scheduled_at,

        duration_minutes=(
            booking.duration_minutes
        ),

        status=booking.status,

        price=booking.price,

        created_at=booking.created_at,
    )


# ============================================================
# MY BOOKINGS
# ============================================================

@router.get(
    "/me",
    response_model=list[BookingDetailRead],
)
def list_my_bookings(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):

    query = db.query(Booking)


    if current_user.role == UserRole.teacher:

        query = query.filter(
            Booking.teacher_id
            == current_user.id
        )

    elif current_user.role == UserRole.student:

        query = query.filter(
            Booking.student_id
            == current_user.id
        )

    else:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed.",
        )


    bookings = (
        query
        .order_by(
            Booking.scheduled_at.asc()
        )
        .all()
    )


    results = []


    for booking in bookings:

        student_user = db.get(
            User,
            booking.student_id,
        )

        teacher_user = db.get(
            User,
            booking.teacher_id,
        )

        subject = db.get(
            Subject,
            booking.subject_id,
        )


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

                scheduled_at=(
                    booking.scheduled_at
                ),

                duration_minutes=(
                    booking.duration_minutes
                ),

                status=booking.status,

                price=booking.price,

                created_at=booking.created_at,
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

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(get_db),
):

    booking = db.get(
        Booking,
        booking_id,
    )


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


    booking.status = (
        BookingStatus.cancelled
    )


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

    current_user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(get_db),
):

    booking = db.get(
        Booking,
        booking_id,
    )


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
        .filter(
            ClassSession.booking_id
            == booking_id
        )
        .first()
    )


    if session is None:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Session not found for this booking"
            ),
        )


    return session