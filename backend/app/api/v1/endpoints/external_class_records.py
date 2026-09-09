import math
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.external_class_record import ExternalClassRecord
from app.models.package import PackagePlan, StudentPackage
from app.models.user import User, UserRole
from app.schemas.external_class_record import (
    ExternalClassRecordCreate,
    ExternalClassRecordRead,
    ExternalStudentPackageRead,
)

router = APIRouter()


def _record_read(record: ExternalClassRecord, db: Session) -> ExternalClassRecordRead:
    student = db.get(User, record.student_id)
    teacher = db.get(User, record.teacher_id)
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
        created_at=record.created_at,
    )


@router.get("/teacher/students", response_model=list[ExternalStudentPackageRead])
def teacher_students(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(StudentPackage, PackagePlan, User)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .join(User, User.id == StudentPackage.student_id)
        .where(StudentPackage.status == "active", User.role == UserRole.student)
        .order_by(User.full_name.asc(), StudentPackage.purchased_at.desc())
    ).all()

    seen = set()
    result = []
    for package, plan, student in rows:
        if student.id in seen:
            continue
        seen.add(student.id)
        result.append(ExternalStudentPackageRead(
            id=package.id,
            student_id=student.id,
            student_name=student.full_name,
            student_email=student.email,
            total_classes=package.total_classes,
            completed_classes=package.classes_used,
            remaining_classes=max(0, package.total_classes - package.classes_used),
            status=package.status,
            package_name=plan.name,
            currency=plan.currency,
            price=float(plan.price),
        ))
    return result


@router.get("/teacher", response_model=list[ExternalClassRecordRead])
def teacher_records(
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    records = db.scalars(
        select(ExternalClassRecord)
        .where(ExternalClassRecord.teacher_id == current_user.id)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()
    return [_record_read(record, db) for record in records]


@router.post("/teacher", response_model=ExternalClassRecordRead, status_code=status.HTTP_201_CREATED)
def create_teacher_record(
    payload: ExternalClassRecordCreate,
    current_user: User = Depends(require_role(UserRole.teacher)),
    db: Session = Depends(get_db),
):
    student = db.get(User, payload.student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="Student not found")

    package = db.get(StudentPackage, payload.student_package_id)
    if package is None or package.student_id != student.id or package.status != "active":
        raise HTTPException(status_code=404, detail="Active student package not found")

    if payload.ended_at <= payload.started_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    if payload.started_at.tzinfo is None or payload.ended_at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Start and end times must include a timezone")

    if payload.status == "completed" and package.classes_used >= package.total_classes:
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
    db.commit()
    db.refresh(record)
    return _record_read(record, db)


@router.get("/me", response_model=dict)
def student_records(
    current_user: User = Depends(require_role(UserRole.student)),
    db: Session = Depends(get_db),
):
    package_row = db.execute(
        select(StudentPackage, PackagePlan)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .where(StudentPackage.student_id == current_user.id, StudentPackage.status == "active")
        .order_by(StudentPackage.purchased_at.desc())
        .limit(1)
    ).first()
    package = package_row[0] if package_row else None
    plan = package_row[1] if package_row else None
    records = db.scalars(
        select(ExternalClassRecord)
        .where(ExternalClassRecord.student_id == current_user.id)
        .order_by(ExternalClassRecord.started_at.desc())
    ).all()
    return {
        "package": {
            "id": package.id,
            "name": plan.name,
            "total_classes": package.total_classes,
            "completed_classes": package.classes_used,
            "remaining_classes": max(0, package.total_classes - package.classes_used),
            "status": package.status,
            "currency": plan.currency,
            "price": float(plan.price),
        } if package and plan else None,
        "classes": [_record_read(record, db) for record in records],
    }
