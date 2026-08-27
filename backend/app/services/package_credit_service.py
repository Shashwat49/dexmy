from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage


class PackageCreditService:
    """Transactional package-credit operations."""

    @staticmethod
    def _lock_package(db: Session, student_package_id: UUID) -> StudentPackage:
        package = db.execute(
            select(StudentPackage)
            .where(StudentPackage.id == student_package_id)
            .with_for_update()
        ).scalar_one_or_none()
        if package is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student package not found")
        return package

    @staticmethod
    def consume(db: Session, *, student_package_id: UUID, booking_id: UUID, created_by: UUID | None = None) -> PackageCreditLedger:
        package = PackageCreditService._lock_package(db, student_package_id)
        if package.status != "active":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student package is not active")
        if package.expires_at is not None and package.expires_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student package has expired")
        if package.classes_used >= package.total_classes:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No package credits remaining")

        existing = db.execute(
            select(PackageCreditLedger.id).where(
                PackageCreditLedger.student_package_id == student_package_id,
                PackageCreditLedger.booking_id == booking_id,
                PackageCreditLedger.delta < 0,
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking has already consumed a package credit")

        package.classes_used += 1
        ledger = PackageCreditLedger(
            student_package_id=student_package_id,
            booking_id=booking_id,
            delta=-1,
            reason="booking_debit",
            created_by=created_by,
        )
        db.add(ledger)
        db.flush()
        return ledger

    @staticmethod
    def select_active_package_for_student(db: Session, *, student_id: UUID) -> StudentPackage:
        """Lock and select the earliest-expiring eligible package."""
        now = datetime.now(timezone.utc)
        package = db.execute(
            select(StudentPackage)
            .where(
                StudentPackage.student_id == student_id,
                StudentPackage.status == "active",
                StudentPackage.classes_used < StudentPackage.total_classes,
                (StudentPackage.expires_at.is_(None)) | (StudentPackage.expires_at > now),
            )
            .order_by(
                StudentPackage.expires_at.is_(None).asc(),
                StudentPackage.expires_at.asc(),
                StudentPackage.purchased_at.asc(),
                StudentPackage.id.asc(),
            )
            .with_for_update()
            .limit(1)
        ).scalar_one_or_none()

        if package is None:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="No active package credits are available for this booking.",
            )
        return package

    @staticmethod
    def consume_for_student(
        db: Session,
        *,
        student_id: UUID,
        booking_id: UUID,
        created_by: UUID | None = None,
    ) -> tuple[StudentPackage, PackageCreditLedger, Decimal]:
        """Consume one credit from the student's best eligible package."""
        package = PackageCreditService.select_active_package_for_student(db, student_id=student_id)
        ledger = PackageCreditService.consume(
            db,
            student_package_id=package.id,
            booking_id=booking_id,
            created_by=created_by,
        )
        plan = db.execute(
            select(PackagePlan).where(PackagePlan.id == package.package_plan_id)
        ).scalar_one_or_none()
        if plan is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Package plan for the active student package could not be found.",
            )
        return package, ledger, plan.price / package.total_classes

    @staticmethod
    def refund(db: Session, *, student_package_id: UUID, booking_id: UUID, created_by: UUID | None = None) -> PackageCreditLedger:
        package = PackageCreditService._lock_package(db, student_package_id)
        debited = db.execute(
            select(PackageCreditLedger.id).where(
                PackageCreditLedger.student_package_id == student_package_id,
                PackageCreditLedger.booking_id == booking_id,
                PackageCreditLedger.delta == -1,
                PackageCreditLedger.reason == "booking_debit",
            )
        ).scalar_one_or_none()
        if debited is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No package debit exists for this booking")

        already_refunded = db.execute(
            select(PackageCreditLedger.id).where(
                PackageCreditLedger.student_package_id == student_package_id,
                PackageCreditLedger.booking_id == booking_id,
                PackageCreditLedger.delta == 1,
                PackageCreditLedger.reason == "booking_refund",
            )
        ).scalar_one_or_none()
        if already_refunded is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This booking credit has already been refunded")

        package.classes_used = max(0, package.classes_used - 1)
        ledger = PackageCreditLedger(
            student_package_id=student_package_id,
            booking_id=booking_id,
            delta=1,
            reason="booking_refund",
            created_by=created_by,
        )
        db.add(ledger)
        db.flush()
        return ledger

    @staticmethod
    def adjust(db: Session, *, student_package_id: UUID, delta: int, reason: str, created_by: UUID) -> PackageCreditLedger:
        if delta == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Credit adjustment cannot be zero")
        if not reason or len(reason.strip()) < 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A meaningful adjustment reason is required")

        package = PackageCreditService._lock_package(db, student_package_id)
        new_used = package.classes_used - delta
        if new_used < 0 or new_used > package.total_classes:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Adjustment would create an invalid package balance")

        package.classes_used = new_used
        ledger = PackageCreditLedger(
            student_package_id=student_package_id,
            delta=delta,
            reason=reason.strip(),
            created_by=created_by,
        )
        db.add(ledger)
        db.flush()
        return ledger
