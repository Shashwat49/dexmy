import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.models.external_class_record import ExternalClassRecord
from app.models.package import PackagePlan, StudentPackage
from app.models.user import User, UserRole
from app.schemas.external_class_record import ExternalClassRecordRead
from app.services.teacher_verification import is_verified_teacher_email

router = APIRouter()


class AdminNoShowCreate(BaseModel):
    student_id: uuid.UUID
    student_package_id: uuid.UUID
    teacher_id: uuid.UUID
    subject: str = Field(min_length=1, max_length=150)
    started_at: datetime
    ended_at: datetime
    admin_notes: str | None = Field(default=None, max_length=10000)


class AdminNoShowStudentRead(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_package_id: uuid.UUID
    student_name: str
    student_email: str
    package_name: str
    remaining_classes: int


class AdminNoShowTeacherRead(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str


def _record_read(record: ExternalClassRecord, db: Session) -> ExternalClassRecordRead:
    student = db.get(User, record.student_id)
    teacher = db.get(User, record.teacher_id)
    admin = db.get(User, record.created_by_admin_id) if record.created_by_admin_id else None
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


@router.get("/options/students", response_model=list[AdminNoShowStudentRead])
def no_show_students(
    current_user: User = Depends(get_current_admin),
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
        result.append(AdminNoShowStudentRead(
            id=package.id,
            student_id=student.id,
            student_package_id=package.id,
            student_name=student.full_name,
            student_email=student.email,
            package_name=plan.name,
            remaining_classes=max(0, package.total_classes - package.classes_used),
        ))
    return result


@router.get("/options/teachers", response_model=list[AdminNoShowTeacherRead])
def no_show_teachers(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    teachers = db.scalars(
        select(User)
        .where(User.role == UserRole.teacher, User.is_active.is_(True))
        .order_by(User.full_name.asc())
    ).all()
    return [
        AdminNoShowTeacherRead(id=t.id, full_name=t.full_name, email=t.email)
        for t in teachers
        if is_verified_teacher_email(t.email)
    ]


@router.post("", response_model=ExternalClassRecordRead, status_code=status.HTTP_201_CREATED)
def create_no_show(
    payload: AdminNoShowCreate,
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if payload.ended_at <= payload.started_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    if payload.started_at.tzinfo is None or payload.ended_at.tzinfo is None:
        raise HTTPException(status_code=400, detail="Start and end times must include a timezone")

    student = db.get(User, payload.student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=404, detail="Student not found")

    teacher = db.get(User, payload.teacher_id)
    if teacher is None or teacher.role != UserRole.teacher or not teacher.is_active or not is_verified_teacher_email(teacher.email):
        raise HTTPException(status_code=400, detail="Only active verified teachers can be selected")

    package = db.get(StudentPackage, payload.student_package_id)
    if package is None or package.student_id != student.id or package.status != "active":
        raise HTTPException(status_code=404, detail="Active student package not found")
    if package.classes_used >= package.total_classes:
        raise HTTPException(status_code=409, detail="No remaining classes in this package")

    duration = max(1, math.ceil((payload.ended_at - payload.started_at).total_seconds() / 60))
    record = ExternalClassRecord(
        student_id=student.id,
        teacher_id=teacher.id,
        student_package_id=package.id,
        subject=payload.subject.strip(),
        topic="Student did not join",
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_minutes=duration,
        status="no_show",
        teacher_notes=(f"Student did not join. Teacher was present.\nAdmin note: {payload.admin_notes.strip()}" if payload.admin_notes and payload.admin_notes.strip() else "Student did not join. Teacher was present."),
        homework=None,
        google_meet_link=None,
        created_by_admin_id=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _record_read(record, db)
