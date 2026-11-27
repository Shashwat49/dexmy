import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.booking import Booking
from app.models.external_class_record import ExternalClassRecord
from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.user import User, UserRole
from app.models.teacher import TeacherProfile
from app.schemas.external_class_record import (
    ExternalClassRecordCreate,
    ExternalClassRecordRead,
    ExternalStudentPackageRead,
)

router = APIRouter()


def _record_read(record: ExternalClassRecord, db: Session) -> ExternalClassRecordRead:
    student = db.get(User, record.student_id)
    teacher = db.get(User, record.teacher_id)
    admin = db.get(User, record.created_by_admin_id) if record.created_by_admin_id else None
    return _record_read_with_users(record, student, teacher, admin)


def _record_read_with_users(record, student, teacher, admin):
    return ExternalClassRecordRead(
        id=record.id,
        student_id=record.student_id,
        student_package_id=record.student_package_id,
        teacher_id=record.teacher_id,
        student_name=student.full_name if student else "Unknown",
        student_email=student.email if student else "",
        teacher_name=teacher.full_name if teacher else "Unknown",
        subject=record.subject,
        topic=record.topic,
        started_at=record.started_at,
        ended_at=record.ended_at,
        duration_minutes=record.duration_minutes,
        status=record.status,
        teacher_notes=record.teacher_notes,
        homework=record.homework,
        google_meet_link=record.google_meet_link,
        created_by_admin_id=record.created_by_admin_id,
        created_by_admin_name=admin.full_name if admin else None,
        created_at=record.created_at,
    )


@router.get("/teacher/students", response_model=list[ExternalStudentPackageRead])
def teacher_class_students(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    """Return all active students with an active package for class recording.

    The selector is intentionally not limited to students previously assigned
    to this teacher; teachers may need to record historical Meet classes.
    """
    now = datetime.now(timezone.utc)
    rows = db.execute(
        select(StudentPackage, PackagePlan, User)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .join(User, User.id == StudentPackage.student_id)
        .where(
            StudentPackage.status == "active",
            ((StudentPackage.is_unlimited.is_(True)) | (StudentPackage.classes_used < StudentPackage.total_classes)),
            ((StudentPackage.expires_at.is_(None)) | (StudentPackage.expires_at > now)),
            User.role == UserRole.student,
            User.is_active.is_(True),
        )
        .order_by(User.full_name.asc(), StudentPackage.expires_at.is_(None).asc(), StudentPackage.expires_at.asc(), StudentPackage.purchased_at.asc())
    ).all()

    # Show each student once, choosing the earliest-expiring eligible package used by booking allocation.
    result = []
    seen_student_ids = set()
    for package, plan, student in rows:
        if student.id in seen_student_ids:
            continue
        seen_student_ids.add(student.id)
        result.append(
            ExternalStudentPackageRead(
                id=package.id,
                student_id=student.id,
                student_name=student.full_name,
                student_email=student.email,
                total_classes=package.total_classes,
                completed_classes=package.classes_used,
                remaining_classes=(
                    package.total_classes
                    if package.is_unlimited
                    else max(0, package.total_classes - package.classes_used)
                ),
                status=package.status,
                package_name=plan.name,
                currency=plan.currency,
                price=float(plan.price),
            )
        )
    return result

@router.get("/teacher", response_model=list[ExternalClassRecordRead])
def teacher_records(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    student_user = aliased(User)
    teacher_user = aliased(User)
    admin_user = aliased(User)
    rows = db.execute(
        select(ExternalClassRecord, student_user, teacher_user, admin_user)
        .join(student_user, ExternalClassRecord.student_id == student_user.id)
        .join(teacher_user, ExternalClassRecord.teacher_id == teacher_user.id)
        .outerjoin(admin_user, ExternalClassRecord.created_by_admin_id == admin_user.id)
        .where(ExternalClassRecord.teacher_id == current_user.id)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()
    return [_record_read_with_users(record, student, teacher, admin) for record, student, teacher, admin in rows]


@router.post("/teacher", response_model=ExternalClassRecordRead, status_code=status.HTTP_201_CREATED)
def create_teacher_record(
    payload: ExternalClassRecordCreate,
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    profile = db.get(TeacherProfile, current_user.id)
    if profile is None or not profile.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only verified teachers can record Google Meet classes.")

    student = db.get(User, payload.student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="Student not found")

    package = db.execute(select(StudentPackage).where(StudentPackage.id == payload.student_package_id).with_for_update()).scalar_one_or_none()
    if package is None or package.student_id != student.id or package.status != "active":
        raise HTTPException(status_code=404, detail="Active student package not found")

    if payload.ended_at <= payload.started_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    if payload.started_at.tzinfo is None or payload.ended_at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Start and end times must include a timezone")

    if package.expires_at is not None and package.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="This student package has expired")
    consumes_credit = payload.status in ("completed", "no_show")
    if consumes_credit and not package.is_unlimited and package.classes_used >= package.total_classes:
        raise HTTPException(status_code=409, detail="No remaining classes in this package")

    duration = max(1, math.ceil((payload.ended_at - payload.started_at).total_seconds() / 60))
    record = ExternalClassRecord(
        student_id=student.id,
        teacher_id=current_user.id,
        student_package_id=package.id,
        subject=payload.subject.strip(),
        topic=payload.topic.strip(),
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_minutes=duration,
        status=payload.status,
        teacher_notes=payload.teacher_notes.strip() if payload.teacher_notes else None,
        homework=payload.homework.strip() if payload.homework else None,
        google_meet_link=payload.google_meet_link.strip() if payload.google_meet_link else None,
    )
    db.add(record)
    db.flush()
    if consumes_credit:
        db.add(PackageCreditLedger(
            student_package_id=package.id,
            external_class_record_id=record.id,
            delta=-1,
            reason="external_class_debit" if payload.status == "completed" else "external_class_no_show",
            created_by=current_user.id,
        ))
    db.commit()
    db.refresh(record)
    return _record_read(record, db)


@router.get("/me", response_model=dict)
def student_records(
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    package_rows = db.execute(
        select(StudentPackage, PackagePlan)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .where(
            StudentPackage.student_id == current_user.id,
            StudentPackage.status == "active",
            (StudentPackage.expires_at.is_(None)) | (StudentPackage.expires_at > now),
        )
        .order_by(StudentPackage.purchased_at.desc())
    ).all()
    package = package_rows[0][0] if package_rows else None
    plan = package_rows[0][1] if package_rows else None
    total_classes = sum(row.total_classes for row, _ in package_rows)
    completed_classes = sum(row.classes_used for row, _ in package_rows)
    has_unlimited_package = any(row.is_unlimited for row, _ in package_rows)

    student_user = aliased(User)
    teacher_user = aliased(User)
    admin_user = aliased(User)
    rows = db.execute(
        select(ExternalClassRecord, student_user, teacher_user, admin_user)
        .join(student_user, ExternalClassRecord.student_id == student_user.id)
        .join(teacher_user, ExternalClassRecord.teacher_id == teacher_user.id)
        .outerjoin(admin_user, ExternalClassRecord.created_by_admin_id == admin_user.id)
        .where(ExternalClassRecord.student_id == current_user.id)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()
    records = [
        _record_read_with_users(record, student, teacher, admin)
        for record, student, teacher, admin in rows
    ]
    if package and plan:
        package_data = {
            "id": package.id,
            "name": plan.name if len(package_rows) == 1 else f"{len(package_rows)} active packages",
            "total_classes": total_classes,
            "completed_classes": completed_classes,
            "remaining_classes": max(0, total_classes - completed_classes),
            "is_unlimited": has_unlimited_package,
            "status": package.status,
            "currency": plan.currency,
            "price": float(plan.price),
        }
    else:
        package_data = None

    return {
        "student_email": current_user.email,
        "package": package_data,
        "classes": records,
    }
