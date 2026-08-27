import uuid
from datetime import timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.db.session import get_db

from app.models.booking import (
    Booking,
    BookingStatus,
)
from app.models.student_subject_teacher import (
    StudentSubjectTeacher,
)
from app.models.teacher import (
    Subject,
    TeacherProfile,
    TeacherSubject,
)
from app.models.user import (
    User,
    UserRole,
)

from app.schemas.booking import (
    PendingTeacherAssignmentRead,
    TeacherAssignmentRead,
    TeacherAssignmentRequest,
)
from app.schemas.user import UserRead

from app.services.booking_service import (
    assign_teacher_atomic,
)
from app.services.scheduling_service import (
    can_assign_teacher,
)

router = APIRouter()



# ============================================================
# USER MANAGEMENT
# ============================================================

@router.get(
    "/users",
    response_model=list[UserRead],
)
def list_all_users(
    role: UserRole | None = None,
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if role is not None:
        query = query.filter(
            User.role == role
        )

    return (
        query
        .order_by(User.created_at.desc())
        .all()
    )


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=UserRead,
)
def deactivate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = False

    db.commit()
    db.refresh(user)

    return user


@router.patch(
    "/users/{user_id}/activate",
    response_model=UserRead,
)
def activate_user(
    user_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = True

    db.commit()
    db.refresh(user)

    return user


@router.patch(
    "/teachers/{teacher_id}/verify",
    status_code=status.HTTP_204_NO_CONTENT,
)
def verify_teacher(
    teacher_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    profile = db.get(
        TeacherProfile,
        teacher_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher profile not found",
        )

    profile.is_verified = True

    db.commit()


# ============================================================
# PENDING TEACHER ASSIGNMENTS
# ============================================================

@router.get(
    "/bookings/pending-teacher-assignment",
    response_model=list[
        PendingTeacherAssignmentRead
    ],
)
def list_pending_teacher_assignments(
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    """
    Return confirmed bookings that have not yet
    been assigned a teacher.

    Uses a single joined query to avoid N+1 database
    calls when iterating over the booking list.
    """

    # --------------------------------------------------------
    # Single query with eager-loaded student and subject.
    #
    # WHY:
    #   The original implementation called db.get(User, ...)
    #   and db.get(Subject, ...) per booking row — an N+1
    #   query pattern.
    #
    #   joinedload fetches all related data in one SQL JOIN,
    #   regardless of the number of bookings returned.
    # --------------------------------------------------------

    from sqlalchemy import select
    from app.models.user import User as UserModel
    from app.models.teacher import Subject as SubjectModel

    rows = (
        db.execute(
            select(
                Booking,
                UserModel.full_name.label("student_name"),
                SubjectModel.name.label("subject_name"),
            )
            .join(
                UserModel,
                UserModel.id == Booking.student_id,
            )
            .join(
                SubjectModel,
                SubjectModel.id == Booking.subject_id,
            )
            .where(
                Booking.status == BookingStatus.confirmed,
                Booking.teacher_id.is_(None),
            )
            .order_by(Booking.scheduled_at.asc())
        )
        .all()
    )

    return [
        PendingTeacherAssignmentRead(
            booking_id=booking.id,
            student_id=booking.student_id,
            student_name=student_name,
            subject_id=booking.subject_id,
            subject_name=subject_name,
            scheduled_at=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            teacher_assignment_status=(
                booking.teacher_assignment_status
            ),
        )
        for booking, student_name, subject_name in rows
    ]



# ============================================================
# ELIGIBLE TEACHERS
# ============================================================

@router.get(
    "/bookings/{booking_id}/eligible-teachers",
    response_model=list[UserRead],
)
def list_eligible_teachers(
    booking_id: uuid.UUID,
    current_user: User = Depends(
        require_role(UserRole.admin)
    ),
    db: Session = Depends(get_db),
):
    """
    Return teachers who can safely be assigned to this
    booking.

    A teacher is eligible only when:

        1. Teacher account exists.
        2. Teacher is actually a teacher.
        3. Teacher is active.
        4. Teacher profile exists.
        5. Teacher is verified.
        6. Teacher teaches the booking subject.
        7. Teacher is not occupied at this time.
        8. Assigning this teacher would not make another
           pending booking at the same slot impossible
           to assign.

    The final scheduling decision is delegated to the
    centralized scheduling engine.
    """

    # ========================================================
    # GET BOOKING
    # ========================================================

    booking = db.get(
        Booking,
        booking_id,
    )

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found.",
        )

    # ========================================================
    # VALIDATE BOOKING STATUS
    # ========================================================

    if booking.status != BookingStatus.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only confirmed bookings can "
                "receive a teacher."
            ),
        )

    # ========================================================
    # VALIDATE ASSIGNMENT STATE
    # ========================================================

    if booking.teacher_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A teacher is already assigned "
                "to this booking."
            ),
        )

    # ========================================================
    # FIND BASIC QUALIFIED TEACHERS
    # ========================================================

    teachers = (
        db.query(User)
        .join(
            TeacherProfile,
            TeacherProfile.user_id
            == User.id,
        )
        .join(
            TeacherSubject,
            TeacherSubject.teacher_id
            == TeacherProfile.user_id,
        )
        .filter(
            User.role
            == UserRole.teacher,

            User.is_active.is_(True),

            TeacherProfile.is_verified.is_(True),

            TeacherSubject.subject_id
            == booking.subject_id,
        )
        .distinct()
        .all()
    )

    eligible_teachers: list[User] = []

    # ========================================================
    # RUN THE CENTRALIZED SCHEDULING CHECK
    # ========================================================

    for teacher in teachers:

        can_assign, reason = (
            can_assign_teacher(
                db=db,
                booking=booking,
                teacher_id=teacher.id,
            )
        )

        if can_assign:
            eligible_teachers.append(
                teacher
            )

    return eligible_teachers


# ============================================================
# ASSIGN TEACHER
# ============================================================

@router.post(
    "/bookings/{booking_id}/assign-teacher",
    response_model=TeacherAssignmentRead,
)
def assign_teacher(
    booking_id: uuid.UUID,

    payload: TeacherAssignmentRequest,

    current_user: User = Depends(
        require_role(UserRole.admin)
    ),

    db: Session = Depends(get_db),
):
    """
    Assign a teacher to an already-confirmed booking.

    This is performed only by an administrator.

    Concurrency safety:
        This endpoint delegates to assign_teacher_atomic(),
        which acquires a SELECT FOR UPDATE row lock on the
        booking before performing any validation or mutation.
        Two simultaneous assignment requests will be serialized
        — the second will see the booking is already assigned
        and receive a 409 response.

    Validation:
        All eligibility checks (teacher qualification, subject,
        overlap, future-feasibility) are performed inside
        assign_teacher_atomic() via the single canonical
        can_assign_teacher() function.

    Audit:
        Every successful assignment is recorded in the
        booking_assignment_audits table.
    """

    # --------------------------------------------------------
    # Load the booking (non-locking read — the lock is
    # acquired inside assign_teacher_atomic).
    # --------------------------------------------------------

    booking = db.get(
        Booking,
        booking_id,
    )

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found.",
        )

    # --------------------------------------------------------
    # Atomic assignment.
    #
    # assign_teacher_atomic():
    #   1. SELECT FOR UPDATE on booking row.
    #   2. Re-validates booking status and assignment state.
    #   3. Calls can_assign_teacher() — single canonical check.
    #   4. Sets teacher_id + teacher_assignment_status.
    #   5. Upserts StudentSubjectTeacher relationship.
    #   6. Inserts BookingAssignmentAudit row.
    # --------------------------------------------------------

    try:
        booking = assign_teacher_atomic(
            db=db,
            booking=booking,
            teacher_id=payload.teacher_id,
            admin_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )

    db.commit()
    db.refresh(booking)

    # --------------------------------------------------------
    # Build response
    # --------------------------------------------------------

    student = db.get(
        User,
        booking.student_id,
    )

    teacher = db.get(
        User,
        booking.teacher_id,
    )

    subject = db.get(
        Subject,
        booking.subject_id,
    )

    return TeacherAssignmentRead(
        booking_id=booking.id,

        student_id=booking.student_id,

        student_name=(
            student.full_name
            if student
            else "Unknown"
        ),

        subject_id=booking.subject_id,

        subject_name=(
            subject.name
            if subject
            else "Unknown"
        ),

        teacher_id=booking.teacher_id,

        teacher_name=(
            teacher.full_name
            if teacher
            else "Unknown"
        ),

        scheduled_at=booking.scheduled_at,

        duration_minutes=booking.duration_minutes,

        teacher_assignment_status=(
            booking.teacher_assignment_status
        ),
    )