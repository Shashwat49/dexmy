import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.core.constants import BOOKING_END_HOUR, BOOKING_START_HOUR, CLASS_DURATION_MINUTES, SLOT_DURATION_MINUTES
from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus, TeacherAssignmentStatus
from app.models.package import PackagePlan, StudentPackage
from app.models.package_schedule import PackageSchedule
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.services.package_credit_service import PackageCreditService
from app.services.scheduling_service import can_assign_teacher

router = APIRouter()
IST = ZoneInfo("Asia/Kolkata")
MAX_SCHEDULE_HORIZON_DAYS = 365
MAX_SCHEDULE_CLASSES = 120


class ScheduleRequest(BaseModel):
    student_package_id: uuid.UUID
    subject_id: int
    teacher_id: uuid.UUID
    start_date: date
    start_time: time
    weekdays: list[int] = Field(min_length=1, max_length=7)
    duration_minutes: int = Field(default=CLASS_DURATION_MINUTES, ge=15, le=120)
    class_count: int = Field(ge=1, le=MAX_SCHEDULE_CLASSES)

    @field_validator("weekdays")
    @classmethod
    def validate_weekdays(cls, value: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in value):
            raise ValueError("Weekdays must use 0=Sunday through 6=Saturday.")
        if len(set(value)) != len(value):
            raise ValueError("Choose each weekday only once.")
        return sorted(value)

    @field_validator("start_time")
    @classmethod
    def validate_hourly_start(cls, value: time) -> time:
        if value.minute != 0 or value.second != 0 or value.microsecond != 0:
            raise ValueError("Classes must start on the hour to match Dexmy's existing slot system.")
        if not BOOKING_START_HOUR <= value.hour < BOOKING_END_HOUR:
            raise ValueError("Class start time must be between 10:00 AM and 9:00 PM IST.")
        return value


class ApproveScheduleRequest(ScheduleRequest):
    idempotency_key: uuid.UUID


def _active_package(db: Session, package_id: uuid.UUID, *, lock: bool = False) -> tuple[StudentPackage, User, PackagePlan]:
    query = (
        select(StudentPackage, User, PackagePlan)
        .join(User, User.id == StudentPackage.student_id)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .where(StudentPackage.id == package_id)
    )
    if lock:
        query = query.with_for_update(of=StudentPackage)
    row = db.execute(query).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Student package not found.")
    package, student, plan = row
    if student.role != UserRole.student or not student.is_active:
        raise HTTPException(status_code=409, detail="The package owner is not an active student.")
    if package.status != "active":
        raise HTTPException(status_code=409, detail="This student package is not active.")
    if package.expires_at and package.expires_at <= datetime.now(IST):
        raise HTTPException(status_code=409, detail="This student package has expired.")
    return package, student, plan


def _occurrence_dates(start_date: date, weekdays: list[int], count: int) -> list[date]:
    if start_date < datetime.now(IST).date():
        raise HTTPException(status_code=422, detail="Start date cannot be in the past.")
    if (start_date - datetime.now(IST).date()).days > MAX_SCHEDULE_HORIZON_DAYS:
        raise HTTPException(status_code=422, detail="Start date is too far in the future.")
    dates: list[date] = []
    cursor = start_date
    while len(dates) < count:
        if (cursor.weekday() + 1) % 7 in weekdays:
            dates.append(cursor)
        cursor += timedelta(days=1)
        if (cursor - start_date).days > MAX_SCHEDULE_HORIZON_DAYS:
            raise HTTPException(status_code=422, detail="This schedule exceeds the one-year scheduling window.")
    return dates


def _validate_schedule(db: Session, payload: ScheduleRequest, package: StudentPackage, student: User) -> tuple[Subject, User, list[datetime], list[str]]:
    subject = db.get(Subject, payload.subject_id)
    if subject is None:
        raise HTTPException(status_code=404, detail="Subject not found.")
    teacher = db.get(User, payload.teacher_id)
    profile = db.get(TeacherProfile, payload.teacher_id)
    teaches_subject = db.execute(
        select(TeacherSubject.teacher_id).where(
            TeacherSubject.teacher_id == payload.teacher_id,
            TeacherSubject.subject_id == payload.subject_id,
        )
    ).scalar_one_or_none()
    if teacher is None or teacher.role != UserRole.teacher or not teacher.is_active or profile is None or not profile.is_verified or teaches_subject is None:
        raise HTTPException(status_code=409, detail="Selected teacher must be active, verified and qualified for this subject.")
    if package.is_unlimited:
        remaining = MAX_SCHEDULE_CLASSES
    else:
        remaining = max(0, package.total_classes - package.classes_used)
    if payload.class_count > remaining:
        raise HTTPException(status_code=409, detail=f"Schedule requests {payload.class_count} classes but only {remaining} package credits remain.")
    if payload.duration_minutes > SLOT_DURATION_MINUTES:
        raise HTTPException(status_code=422, detail=f"Class duration cannot exceed the existing {SLOT_DURATION_MINUTES}-minute booking slot.")
    dates = _occurrence_dates(payload.start_date, payload.weekdays, payload.class_count)
    starts = [datetime.combine(day, payload.start_time, tzinfo=IST) for day in dates]
    errors: list[str] = []
    for start in starts:
        probe = Booking(
            id=uuid.uuid4(),
            student_id=student.id,
            teacher_id=payload.teacher_id,
            subject_id=payload.subject_id,
            student_package_id=package.id,
            scheduled_at=start,
            booking_ends_at=start + timedelta(minutes=payload.duration_minutes),
            duration_minutes=payload.duration_minutes,
            status=BookingStatus.confirmed,
            teacher_assignment_status=TeacherAssignmentStatus.assigned.value,
        )
        allowed, reason = can_assign_teacher(db, booking=probe, teacher_id=payload.teacher_id)
        if not allowed:
            errors.append(f"{start.strftime('%a, %d %b %Y %I:%M %p')} IST: {reason}")
    return subject, teacher, starts, errors


@router.get("")
def list_package_schedules(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    student_user = aliased(User)
    teacher_user = aliased(User)
    rows = db.execute(
        select(PackageSchedule, student_user.full_name, teacher_user.full_name, Subject.name)
        .join(student_user, student_user.id == PackageSchedule.student_id)
        .join(teacher_user, teacher_user.id == PackageSchedule.teacher_id)
        .join(Subject, Subject.id == PackageSchedule.subject_id)
        .order_by(PackageSchedule.created_at.desc())
        .limit(50)
    ).all()
    weekday_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    result = []
    for schedule, student_name, teacher_name, subject_name in rows:
        created_classes = db.execute(
            select(Booking.id).where(Booking.schedule_id == schedule.id)
        ).scalars().all()
        result.append({
            "id": str(schedule.id),
            "student_name": student_name,
            "teacher_name": teacher_name,
            "subject_name": subject_name,
            "weekdays": schedule.weekdays,
            "weekday_labels": [weekday_names[day] for day in schedule.weekdays],
            "start_date": schedule.start_date.isoformat(),
            "start_time": schedule.start_time.strftime("%I:%M %p"),
            "duration_minutes": schedule.duration_minutes,
            "class_count": schedule.class_count,
            "created_classes": len(created_classes),
            "status": schedule.status,
            "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        })
    return result


@router.get("/options")
def get_schedule_options(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(IST)
    package_rows = db.execute(
        select(StudentPackage, User, PackagePlan)
        .join(User, User.id == StudentPackage.student_id)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .where(
            StudentPackage.status == "active",
            User.role == UserRole.student,
            User.is_active.is_(True),
            (StudentPackage.expires_at.is_(None)) | (StudentPackage.expires_at > now),
        )
        .order_by(User.full_name.asc(), StudentPackage.purchased_at.desc())
    ).all()
    packages = []
    for package, student, plan in package_rows:
        remaining = None if package.is_unlimited else max(0, package.total_classes - package.classes_used)
        if package.is_unlimited or remaining > 0:
            packages.append({
                "id": str(package.id),
                "student_id": str(student.id),
                "student_name": student.full_name,
                "student_email": student.email,
                "package_name": plan.name,
                "total_classes": package.total_classes,
                "classes_used": package.classes_used,
                "remaining_classes": remaining,
                "is_unlimited": package.is_unlimited,
            })
    subjects = [
        {"id": item.id, "name": item.name}
        for item in db.execute(select(Subject).order_by(Subject.name.asc())).scalars().all()
    ]
    teacher_rows = db.execute(
        select(User, TeacherProfile)
        .join(TeacherProfile, TeacherProfile.user_id == User.id)
        .where(User.role == UserRole.teacher, User.is_active.is_(True), TeacherProfile.is_verified.is_(True))
        .order_by(User.full_name.asc())
    ).all()
    teachers = []
    for teacher, profile in teacher_rows:
        subject_ids = db.execute(
            select(TeacherSubject.subject_id).where(TeacherSubject.teacher_id == teacher.id)
        ).scalars().all()
        teachers.append({
            "id": str(teacher.id),
            "name": teacher.full_name,
            "email": teacher.email,
            "subject_ids": subject_ids,
        })
    return {"packages": packages, "subjects": subjects, "teachers": teachers}


@router.post("/preview")
def preview_package_schedule(
    payload: ScheduleRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    package, student, _ = _active_package(db, payload.student_package_id)
    _, teacher, starts, errors = _validate_schedule(db, payload, package, student)
    return {
        "valid": not errors,
        "student_name": student.full_name,
        "teacher_name": teacher.full_name,
        "subject_id": payload.subject_id,
        "class_count": len(starts),
        "duration_minutes": payload.duration_minutes,
        "dates": [start.isoformat() for start in starts],
        "conflicts": errors,
        "message": "All occurrences passed validation." if not errors else "Resolve every conflict before approving this schedule.",
    }


@router.post("/approve", status_code=status.HTTP_201_CREATED)
def approve_package_schedule(
    payload: ApproveScheduleRequest,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(PackageSchedule).where(PackageSchedule.idempotency_key == payload.idempotency_key)
    ).scalar_one_or_none()
    if existing:
        bookings = db.execute(select(Booking.id).where(Booking.schedule_id == existing.id).order_by(Booking.scheduled_at)).scalars().all()
        return {"schedule_id": str(existing.id), "status": existing.status, "booking_ids": [str(item) for item in bookings], "idempotent_replay": True}

    try:
        package, student, plan = _active_package(db, payload.student_package_id, lock=True)
        _, teacher, starts, errors = _validate_schedule(db, payload, package, student)
        if errors:
            raise HTTPException(status_code=409, detail={"message": "Schedule conflicts must be resolved before approval.", "conflicts": errors})

        schedule = PackageSchedule(
            student_id=student.id,
            student_package_id=package.id,
            teacher_id=teacher.id,
            subject_id=payload.subject_id,
            start_date=payload.start_date,
            start_time=payload.start_time,
            weekdays=payload.weekdays,
            duration_minutes=payload.duration_minutes,
            class_count=payload.class_count,
            status="approved",
            idempotency_key=payload.idempotency_key,
            approved_by=current_user.id,
        )
        db.add(schedule)
        db.flush()

        created = []
        for start in starts:
            booking = Booking(
                student_id=student.id,
                teacher_id=teacher.id,
                subject_id=payload.subject_id,
                student_package_id=package.id,
                schedule_id=schedule.id,
                scheduled_at=start,
                booking_ends_at=start + timedelta(minutes=payload.duration_minutes),
                duration_minutes=payload.duration_minutes,
                status=BookingStatus.confirmed,
                teacher_assignment_status=TeacherAssignmentStatus.assigned.value,
            )
            db.add(booking)
            db.flush()
            PackageCreditService.consume(
                db,
                student_package_id=package.id,
                booking_id=booking.id,
                created_by=current_user.id,
            )
            created.append(booking.id)

        db.commit()
        return {
            "schedule_id": str(schedule.id),
            "status": schedule.status,
            "class_count": len(created),
            "booking_ids": [str(item) for item in created],
            "idempotent_replay": False,
        }
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        # If a retry raced with the first request, return the committed result
        # for the same idempotency key instead of inviting a duplicate attempt.
        existing = db.execute(
            select(PackageSchedule).where(PackageSchedule.idempotency_key == payload.idempotency_key)
        ).scalar_one_or_none()
        if existing:
            booking_ids = db.execute(
                select(Booking.id).where(Booking.schedule_id == existing.id).order_by(Booking.scheduled_at)
            ).scalars().all()
            return {
                "schedule_id": str(existing.id),
                "status": existing.status,
                "class_count": len(booking_ids),
                "booking_ids": [str(item) for item in booking_ids],
                "idempotent_replay": True,
            }
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Schedule could not be committed because a slot was claimed or conflicted concurrently. Refresh the preview and resolve the conflict before retrying.",
        ) from exc
    except Exception:
        db.rollback()
        raise
