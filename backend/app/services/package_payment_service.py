import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.payment import Payment, PaymentStatus
from app.models.teacher import Subject


def validate_package_selection(db: Session, package_plan: PackagePlan, *, currency: str | None, subject_id: int | None) -> None:
    if currency is not None and currency != package_plan.currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected currency does not match the package currency")
    if subject_id is None:
        return
    if db.get(Subject, subject_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected subject does not exist")
    if package_plan.subjects and subject_id not in {subject.id for subject in package_plan.subjects}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Package is not available for the selected subject")


def get_package_plan(db: Session, package_plan_id: uuid.UUID) -> PackagePlan:
    plan = db.get(PackagePlan, package_plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package plan not found or inactive")
    if plan.class_count < 25:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package plan violates minimum class requirement")
    return plan


def get_or_create_payment(
    db: Session,
    *,
    payer_id: uuid.UUID,
    student_id: uuid.UUID,
    package_plan: PackagePlan,
    provider: str,
    idempotency_key: uuid.UUID,
    selected_subject_id: int | None = None,
) -> Payment:
    existing = db.execute(select(Payment).where(Payment.idempotency_key == idempotency_key)).scalar_one_or_none()
    if existing is not None:
        existing_provider = getattr(existing.provider, "value", existing.provider)
        if (
            existing.payer_id != payer_id
            or existing.student_id != student_id
            or existing.package_plan_id != package_plan.id
            or existing_provider != provider
            or existing.selected_subject_id != selected_subject_id
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Idempotency key is already associated with a different payment")
        expected_total = (package_plan.price * package_plan.class_count).quantize(Decimal("0.01"))
        if existing.status == PaymentStatus.created and existing.amount != expected_total:
            if existing.provider_order_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This checkout was created with previous pricing. Start a new checkout.")
            existing.amount = expected_total
            existing.package_class_count = package_plan.class_count
            db.flush()
        return existing

    if provider == "razorpay" and package_plan.currency != "INR":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay package checkout requires an INR package")
    if provider == "stripe" and package_plan.currency != "USD":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe package checkout requires a USD package")

    payment = Payment(
        booking_id=None,
        package_id=None,
        package_plan_id=package_plan.id,
        student_id=student_id,
        payer_id=payer_id,
        amount=(Decimal(package_plan.price) * package_plan.class_count).quantize(Decimal("0.01")),
        package_class_count=package_plan.class_count,
        selected_subject_id=selected_subject_id,
        currency=package_plan.currency,
        provider=provider,
        status=PaymentStatus.created,
        idempotency_key=idempotency_key,
    )
    try:
        with db.begin_nested():
            db.add(payment)
            db.flush()
    except IntegrityError:
        existing = db.execute(
            select(Payment).where(Payment.idempotency_key == idempotency_key)
        ).scalar_one_or_none()
        if existing is None:
            raise
        existing_provider = getattr(existing.provider, "value", existing.provider)
        if (
            existing.payer_id != payer_id
            or existing.student_id != student_id
            or existing.package_plan_id != package_plan.id
            or existing_provider != provider
            or existing.selected_subject_id != selected_subject_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Idempotency key is already associated with a different payment",
            )
        return existing
    return payment


def activate_package_from_payment(db: Session, *, payment_id: uuid.UUID, provider_payment_id: str | None = None) -> StudentPackage:
    payment = db.execute(select(Payment).where(Payment.id == payment_id).with_for_update()).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if payment.status == PaymentStatus.paid:
        if payment.package_id is not None:
            package = db.get(StudentPackage, payment.package_id)
            if package is not None:
                return package
        existing_package = db.execute(select(StudentPackage).where(StudentPackage.payment_id == payment.id)).scalar_one_or_none()
        if existing_package is not None:
            payment.package_id = existing_package.id
            db.flush()
            return existing_package

    if payment.package_plan_id is None or payment.student_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is missing package purchase metadata")

    plan = db.get(PackagePlan, payment.package_plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package plan no longer exists")
    if payment.package_class_count is None:
        legacy_expected_total = (plan.price * plan.class_count).quantize(Decimal("0.01"))
        if payment.amount != legacy_expected_total:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This payment was created with the previous per-class checkout amount and cannot activate a full package. Contact Dexmy support for reconciliation.")

    payment.status = PaymentStatus.paid
    if provider_payment_id:
        payment.provider_payment_id = provider_payment_id

    existing_package = db.execute(select(StudentPackage).where(StudentPackage.payment_id == payment.id).with_for_update()).scalar_one_or_none()
    if existing_package is not None:
        payment.package_id = existing_package.id
        db.flush()
        return existing_package

    package = StudentPackage(
        student_id=payment.student_id,
        package_plan_id=plan.id,
        payment_id=payment.id,
        selected_subject_id=payment.selected_subject_id,
        total_classes=payment.package_class_count or plan.class_count,
        classes_used=0,
        status="active",
    )
    try:
        with db.begin_nested():
            db.add(package)
            db.flush()
    except IntegrityError:
        existing_package = db.execute(
            select(StudentPackage).where(StudentPackage.payment_id == payment.id)
        ).scalar_one_or_none()
        if existing_package is not None:
            payment.package_id = existing_package.id
            db.flush()
            return existing_package
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Concurrent package activation detected. Please retry or wait.")

    db.add(PackageCreditLedger(
        student_package_id=package.id,
        booking_id=None,
        delta=payment.package_class_count or plan.class_count,
        reason="purchase",
        created_by=None,
    ))
    payment.package_id = package.id
    db.flush()
    return package
