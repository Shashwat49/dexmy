import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_admin, require_permission
from app.core.security import hash_password
from app.db.session import get_db
from app.models.admin import AdminAuditLog, AdminPermission, AdminRolePermission, AdminProfile
from app.models.booking import Booking, BookingStatus
from app.models.teacher import Subject, TeacherProfile, TeacherSubject
from app.models.user import User, UserRole
from app.schemas.admin import AdminMeRead, AdminUserCreate, AdminUserRead, AdminUserUpdate, AuditLogRead
from app.schemas.booking import PendingTeacherAssignmentRead, TeacherAssignmentRead, TeacherAssignmentRequest
from app.schemas.user import UserRead
from app.services.audit_service import record_admin_action
from app.services.booking_service import assign_teacher_atomic
from app.services.scheduling_service import can_assign_teacher

router = APIRouter()

ADMIN_ROLES = {
    UserRole.super_admin,
    UserRole.admin,
    UserRole.academic_manager,
    UserRole.teacher_manager,
    UserRole.finance_manager,
    UserRole.support_agent,
}


# ============================================================
# ADMIN IDENTITY / RBAC
# ============================================================

@router.get("/me", response_model=AdminMeRead)
def get_admin_me(
    current_user: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    permissions = db.execute(
        select(AdminPermission.key)
        .join(AdminRolePermission, AdminRolePermission.permission_id == AdminPermission.id)
        .where(AdminRolePermission.role == current_user.role.value)
        .order_by(AdminPermission.key.asc())
    ).scalars().all()

    if current_user.role == UserRole.super_admin:
        permissions = ["*"] + list(permissions)

    profile = db.execute(
        select(AdminProfile).where(AdminProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    return AdminMeRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        employee_id=profile.employee_id if profile else None,
        department=profile.department if profile else None,
        permissions=list(permissions),
    )


# ============================================================
# ADMIN USER MANAGEMENT
# ============================================================

@router.get("/admin-users", response_model=list[AdminUserRead])
def list_admin_users(
    current_user: User = Depends(require_permission("admin_user.read")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(User, AdminProfile)
        .outerjoin(AdminProfile, AdminProfile.user_id == User.id)
        .where(User.role.in_(ADMIN_ROLES))
        .order_by(User.created_at.desc())
    ).all()

    return [
        AdminUserRead(
            id=user.id, email=user.email, full_name=user.full_name, phone=user.phone,
            role=user.role, is_active=user.is_active, email_verified=user.email_verified,
            created_at=user.created_at, employee_id=profile.employee_id if profile else None,
            department=profile.department if profile else None,
        )
        for user, profile in rows
    ]


@router.post("/admin-users", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: AdminUserCreate,
    request: Request,
    current_user: User = Depends(require_permission("admin_user.create")),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a super admin can create admin users")

    email = payload.email.lower().strip()
    if db.execute(select(User).where(func.lower(User.email) == email)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    if payload.employee_id and db.execute(select(AdminProfile).where(AdminProfile.employee_id == payload.employee_id)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee ID already exists")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    db.flush()

    profile = AdminProfile(user_id=user.id, employee_id=payload.employee_id, department=payload.department)
    db.add(profile)

    record_admin_action(
        db, admin_user_id=current_user.id, action="admin_user.create", resource_type="user", resource_id=user.id,
        new_values={"role": payload.role.value, "email": email},
        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    db.refresh(user)

    return AdminUserRead(
        id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=user.role,
        is_active=user.is_active, email_verified=user.email_verified, created_at=user.created_at,
        employee_id=profile.employee_id, department=profile.department,
    )


@router.patch("/admin-users/{user_id}", response_model=AdminUserRead)
def update_admin_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdate,
    request: Request,
    current_user: User = Depends(require_permission("admin_user.update")),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a super admin can update admin users")

    user = db.get(User, user_id)
    if user is None or user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")

    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")

    if user.role == UserRole.super_admin and payload.role not in (None, UserRole.super_admin):
        count = db.execute(select(func.count()).select_from(User).where(User.role == UserRole.super_admin, User.is_active.is_(True))).scalar_one()
        if count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The last active super admin cannot be demoted")

    old_values = {"role": user.role.value, "is_active": user.is_active, "full_name": user.full_name}
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active

    profile = db.execute(select(AdminProfile).where(AdminProfile.user_id == user.id)).scalar_one_or_none()
    if profile is None:
        profile = AdminProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    if payload.employee_id is not None:
        duplicate = db.execute(select(AdminProfile).where(AdminProfile.employee_id == payload.employee_id, AdminProfile.user_id != user.id)).scalar_one_or_none()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee ID already exists")
        profile.employee_id = payload.employee_id
    if payload.department is not None:
        profile.department = payload.department

    record_admin_action(
        db, admin_user_id=current_user.id, action="admin_user.update", resource_type="user", resource_id=user.id,
        old_values=old_values,
        new_values={"role": user.role.value, "is_active": user.is_active, "full_name": user.full_name},
        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    db.refresh(user)

    return AdminUserRead(
        id=user.id, email=user.email, full_name=user.full_name, phone=user.phone, role=user.role,
        is_active=user.is_active, email_verified=user.email_verified, created_at=user.created_at,
        employee_id=profile.employee_id, department=profile.department,
    )


# ============================================================
# AUDIT LOGS
# ============================================================

@router.get("/audit-logs", response_model=list[AuditLogRead])
def list_audit_logs(
    limit: int = 100,
    current_user: User = Depends(require_permission("audit.read")),
    db: Session = Depends(get_db),
):
    limit = max(1, min(limit, 500))
    return db.execute(select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)).scalars().all()


# ============================================================
# USER MANAGEMENT
# ============================================================

@router.get("/users", response_model=list[UserRead])
def list_all_users(
    role: UserRole | None = None,
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if role is not None:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("student.suspend")),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")
    old_active = user.is_active
    user.is_active = False
    record_admin_action(db, admin_user_id=current_user.id, action="user.deactivate", resource_type="user", resource_id=user.id,
                        old_values={"is_active": old_active}, new_values={"is_active": False},
                        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit(); db.refresh(user)
    return user


@router.patch("/users/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("student.update")),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    old_active = user.is_active
    user.is_active = True
    record_admin_action(db, admin_user_id=current_user.id, action="user.activate", resource_type="user", resource_id=user.id,
                        old_values={"is_active": old_active}, new_values={"is_active": True},
                        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit(); db.refresh(user)
    return user


# ============================================================
# TEACHER MANAGEMENT
# ============================================================

@router.patch("/teachers/{teacher_id}/verify", status_code=status.HTTP_204_NO_CONTENT)
def verify_teacher(
    teacher_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("teacher.verify")),
    db: Session = Depends(get_db),
):
    profile = db.get(TeacherProfile, teacher_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher profile not found")
    old_verified = profile.is_verified
    profile.is_verified = True
    record_admin_action(db, admin_user_id=current_user.id, action="teacher.verify", resource_type="teacher", resource_id=teacher_id,
                        old_values={"is_verified": old_verified}, new_values={"is_verified": True},
                        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit()


# ============================================================
# PENDING TEACHER ASSIGNMENTS
# ============================================================

@router.get("/bookings/pending-teacher-assignment", response_model=list[PendingTeacherAssignmentRead])
def list_pending_teacher_assignments(
    current_user: User = Depends(require_permission("booking.read")),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(Booking, User.full_name.label("student_name"), Subject.name.label("subject_name"))
        .join(User, User.id == Booking.student_id).join(Subject, Subject.id == Booking.subject_id)
        .where(Booking.status == BookingStatus.confirmed, Booking.teacher_id.is_(None))
        .order_by(Booking.scheduled_at.asc())
    ).all()
    return [PendingTeacherAssignmentRead(
        booking_id=booking.id, student_id=booking.student_id, student_name=student_name,
        subject_id=booking.subject_id, subject_name=subject_name, scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes, teacher_assignment_status=booking.teacher_assignment_status,
    ) for booking, student_name, subject_name in rows]


# ============================================================
# ELIGIBLE TEACHERS
# ============================================================

@router.get("/bookings/{booking_id}/eligible-teachers", response_model=list[UserRead])
def list_eligible_teachers(
    booking_id: uuid.UUID,
    current_user: User = Depends(require_permission("booking.assign_teacher")),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only confirmed bookings can receive a teacher.")
    if booking.teacher_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A teacher is already assigned to this booking.")

    teachers = db.query(User).join(TeacherProfile, TeacherProfile.user_id == User.id).join(TeacherSubject, TeacherSubject.teacher_id == TeacherProfile.user_id).filter(
        User.role == UserRole.teacher, User.is_active.is_(True), TeacherProfile.is_verified.is_(True), TeacherSubject.subject_id == booking.subject_id
    ).distinct().all()
    eligible = []
    for teacher in teachers:
        can_assign, _ = can_assign_teacher(db=db, booking=booking, teacher_id=teacher.id)
        if can_assign:
            eligible.append(teacher)
    return eligible


# ============================================================
# ASSIGN TEACHER
# ============================================================

@router.post("/bookings/{booking_id}/assign-teacher", response_model=TeacherAssignmentRead)
def assign_teacher(
    booking_id: uuid.UUID,
    payload: TeacherAssignmentRequest,
    request: Request,
    current_user: User = Depends(require_permission("booking.assign_teacher")),
    db: Session = Depends(get_db),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found.")
    try:
        booking = assign_teacher_atomic(db=db, booking=booking, teacher_id=payload.teacher_id, admin_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))

    record_admin_action(db, admin_user_id=current_user.id, action="booking.assign_teacher", resource_type="booking", resource_id=booking.id,
                        new_values={"teacher_id": str(booking.teacher_id)},
                        ip_address=request.client.host if request.client else None, user_agent=request.headers.get("user-agent"))
    db.commit(); db.refresh(booking)

    student = db.get(User, booking.student_id); teacher = db.get(User, booking.teacher_id); subject = db.get(Subject, booking.subject_id)
    return TeacherAssignmentRead(
        booking_id=booking.id, student_id=booking.student_id, student_name=student.full_name if student else "Unknown",
        subject_id=booking.subject_id, subject_name=subject.name if subject else "Unknown", teacher_id=booking.teacher_id,
        teacher_name=teacher.full_name if teacher else "Unknown", scheduled_at=booking.scheduled_at,
        duration_minutes=booking.duration_minutes, teacher_assignment_status=booking.teacher_assignment_status,
    )
