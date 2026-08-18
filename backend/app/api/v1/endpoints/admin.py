import uuid
from datetime import timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

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
    """

    bookings = (
        db.query(Booking)
        .filter(
            Booking.status
            == BookingStatus.confirmed,

            Booking.teacher_id.is_(None),

            Booking.teacher_assignment_status
            == "pending",
        )
        .order_by(
            Booking.scheduled_at.asc()
        )
        .all()
    )

    results = []

    for booking in bookings:

        student = db.get(
            User,
            booking.student_id,
        )

        subject = db.get(
            Subject,
            booking.subject_id,
        )

        results.append(
            PendingTeacherAssignmentRead(
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

                scheduled_at=(
                    booking.scheduled_at
                ),

                duration_minutes=(
                    booking.duration_minutes
                ),

                teacher_assignment_status=(
                    booking.teacher_assignment_status
                ),
            )
        )

    return results


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
    Return teachers who can be assigned to this booking.

    Requirements:
        - teacher account
        - active
        - verified
        - teaches the subject
        - no overlapping class
    """

    booking = db.get(
        Booking,
        booking_id,
    )

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.status != BookingStatus.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only confirmed bookings can "
                "receive a teacher."
            ),
        )

    if booking.teacher_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A teacher is already assigned.",
        )

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

    available_teachers = []

    booking_start = booking.scheduled_at

    booking_end = (
        booking_start
        + timedelta(
            minutes=booking.duration_minutes
        )
    )

    for teacher in teachers:

        existing_bookings = (
            db.query(Booking)
            .filter(
                Booking.teacher_id
                == teacher.id,

                Booking.status.in_(
                    [
                        BookingStatus.pending,
                        BookingStatus.confirmed,
                    ]
                ),

                Booking.id != booking.id,

                Booking.scheduled_at
                < booking_end,
            )
            .all()
        )

        has_conflict = False

        for existing in existing_bookings:

            existing_end = (
                existing.scheduled_at
                + timedelta(
                    minutes=existing.duration_minutes
                )
            )

            if existing_end > booking_start:
                has_conflict = True
                break

        if not has_conflict:
            available_teachers.append(
                teacher
            )

    return available_teachers


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
    """

    # --------------------------------------------------------
    # Booking
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
    # Booking status
    # --------------------------------------------------------

    if booking.status != BookingStatus.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only confirmed bookings can "
                "receive a teacher."
            ),
        )

    # --------------------------------------------------------
    # Already assigned
    # --------------------------------------------------------

    if booking.teacher_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A teacher is already assigned "
                "to this booking."
            ),
        )

    # --------------------------------------------------------
    # Teacher
    # --------------------------------------------------------

    teacher = db.get(
        User,
        payload.teacher_id,
    )

    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found.",
        )

    if teacher.role != UserRole.teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected user is not a teacher.",
        )

    if not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher is inactive.",
        )

    # --------------------------------------------------------
    # Teacher profile
    # --------------------------------------------------------

    teacher_profile = db.get(
        TeacherProfile,
        teacher.id,
    )

    if teacher_profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher profile not found.",
        )

    if not teacher_profile.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher is not verified.",
        )

    # --------------------------------------------------------
    # Subject eligibility
    # --------------------------------------------------------

    teaches_subject = (
        db.query(TeacherSubject)
        .filter(
            TeacherSubject.teacher_id
            == teacher.id,

            TeacherSubject.subject_id
            == booking.subject_id,
        )
        .first()
    )

    if teaches_subject is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Teacher does not teach "
                "this subject."
            ),
        )

    # --------------------------------------------------------
    # Teacher scheduling conflict
    # --------------------------------------------------------

    booking_start = booking.scheduled_at

    booking_end = (
        booking_start
        + timedelta(
            minutes=booking.duration_minutes
        )
    )

    existing_bookings = (
        db.query(Booking)
        .filter(
            Booking.teacher_id
            == teacher.id,

            Booking.status.in_(
                [
                    BookingStatus.pending,
                    BookingStatus.confirmed,
                ]
            ),

            Booking.id != booking.id,

            Booking.scheduled_at
            < booking_end,
        )
        .all()
    )

    for existing in existing_bookings:

        existing_end = (
            existing.scheduled_at
            + timedelta(
                minutes=existing.duration_minutes
            )
        )

        if existing_end > booking_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Teacher is already assigned "
                    "to another class at this time."
                ),
            )

    # --------------------------------------------------------
    # Student scheduling conflict
    # --------------------------------------------------------

    student_conflicts = (
        db.query(Booking)
        .filter(
            Booking.student_id
            == booking.student_id,

            Booking.status.in_(
                [
                    BookingStatus.pending,
                    BookingStatus.confirmed,
                ]
            ),

            Booking.id != booking.id,

            Booking.scheduled_at
            < booking_end,
        )
        .all()
    )

    for existing in student_conflicts:

        existing_end = (
            existing.scheduled_at
            + timedelta(
                minutes=existing.duration_minutes
            )
        )

        if existing_end > booking_start:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Student already has "
                    "another class at this time."
                ),
            )

    # --------------------------------------------------------
    # Assign teacher to booking
    # --------------------------------------------------------

    booking.teacher_id = teacher.id

    booking.teacher_assignment_status = (
        "assigned"
    )

    # --------------------------------------------------------
    # Maintain persistent student-subject-teacher
    # relationship
    # --------------------------------------------------------

    relationship = (
        db.query(StudentSubjectTeacher)
        .filter(
            StudentSubjectTeacher.student_id
            == booking.student_id,

            StudentSubjectTeacher.subject_id
            == booking.subject_id,
        )
        .first()
    )

    if relationship is None:

        relationship = StudentSubjectTeacher(
            student_id=booking.student_id,

            subject_id=booking.subject_id,

            teacher_id=teacher.id,

            status="active",
        )

        db.add(relationship)

    else:

        relationship.teacher_id = teacher.id

        relationship.status = "active"

    db.commit()

    db.refresh(booking)

    # --------------------------------------------------------
    # Response data
    # --------------------------------------------------------

    student = db.get(
        User,
        booking.student_id,
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

        teacher_id=teacher.id,

        teacher_name=teacher.full_name,

        scheduled_at=booking.scheduled_at,

        duration_minutes=booking.duration_minutes,

        teacher_assignment_status=(
            booking.teacher_assignment_status
        ),
    )