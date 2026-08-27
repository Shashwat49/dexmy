from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import require_permission
from app.db.session import get_db
from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.user import User, UserRole
from app.schemas.admin_student_packages import (
    AdminCreditAdjustment,
    AdminCreditAdjustmentResponse,
    AdminStudentPackageRead,
)
from app.services.audit_service import record_admin_action
from app.services.package_credit_service import PackageCreditService

router = APIRouter()


def _package_read(package: StudentPackage, plan: PackagePlan) -> AdminStudentPackageRead:
    return AdminStudentPackageRead(
        id=package.id,
        student_id=package.student_id,
        package_plan_id=package.package_plan_id,
        payment_id=package.payment_id,
        total_classes=package.total_classes,
        classes_used=package.classes_used,
        classes_remaining=package.total_classes - package.classes_used,
        status=package.status,
        purchased_at=package.purchased_at,
        expires_at=package.expires_at,
        package_name=plan.name,
        price=plan.price,
        currency=plan.currency,
    )


@router.get("/{student_id}/packages", response_model=list[AdminStudentPackageRead])
def list_student_packages(
    student_id: UUID,
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    student = db.get(User, student_id)
    if student is None or student.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    rows = db.execute(
        select(StudentPackage, PackagePlan)
        .join(PackagePlan, PackagePlan.id == StudentPackage.package_plan_id)
        .where(StudentPackage.student_id == student_id)
        .order_by(StudentPackage.purchased_at.desc())
    ).all()
    return [_package_read(package, plan) for package, plan in rows]


@router.get("/{student_id}/packages/{package_id}/ledger")
def get_student_package_ledger(
    student_id: UUID,
    package_id: UUID,
    current_user: User = Depends(require_permission("student.read")),
    db: Session = Depends(get_db),
):
    package = db.get(StudentPackage, package_id)
    if package is None or package.student_id != student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student package not found")

    return db.execute(
        select(PackageCreditLedger)
        .where(PackageCreditLedger.student_package_id == package_id)
        .order_by(PackageCreditLedger.created_at.desc())
    ).scalars().all()


@router.post("/{student_id}/packages/{package_id}/credit-adjustment", response_model=AdminCreditAdjustmentResponse)
def adjust_student_package_credits(
    student_id: UUID,
    package_id: UUID,
    payload: AdminCreditAdjustment,
    current_user: User = Depends(require_permission("student.update")),
    db: Session = Depends(get_db),
):
    package = db.get(StudentPackage, package_id)
    if package is None or package.student_id != student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student package not found")

    ledger = PackageCreditService.adjust(
        db,
        student_package_id=package_id,
        delta=payload.delta,
        reason=payload.reason,
        created_by=current_user.id,
    )

    db.flush()
    record_admin_action(
        db,
        admin_user_id=current_user.id,
        action="package.credit_adjustment",
        resource_type="student_package",
        resource_id=package_id,
        old_values={"classes_used": package.classes_used - payload.delta},
        new_values={"classes_used": package.classes_used, "delta": payload.delta},
        reason=payload.reason,
    )
    db.commit()
    db.refresh(package)

    return AdminCreditAdjustmentResponse(
        student_package_id=package.id,
        delta=ledger.delta,
        classes_used=package.classes_used,
        classes_remaining=package.total_classes - package.classes_used,
        reason=ledger.reason,
        ledger_id=ledger.id,
    )
