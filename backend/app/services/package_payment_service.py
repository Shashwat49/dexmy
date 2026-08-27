import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.payment import Payment, PaymentStatus


def get_package_plan(db: Session, package_plan_id: uuid.UUID) -> PackagePlan:
    plan = db.get(PackagePlan, package_plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package plan not found or inactive")
    if plan.class_count < 25:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package plan violates minimum class requirement")
    return plan


def get_or_create_payment(db: Session, *, payer_id: uuid.UUID, student_id: uuid.UUID, package_plan: PackagePlan, provider: str, idempotency_key: uuid.UUID) -> Payment:
    existing = db.execute(select(Payment).where(Payment.idempotency_key == idempotency_key)).scalar_one_or_none()
    if existing is not None:
        if (
            existing.payer_id != payer_id
            or existing.student_id != student_id
            or existing.package_plan_id != package_plan.id
            or existing.provider.value != provider
        ):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Idempotency key is already associated with a different payment")
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
        amount=package_plan.price,
        currency=package_plan.currency,
        provider=provider,
        status=PaymentStatus.created,
        idempotency_key=idempotency_key,
    )
    db.add(payment)
    db.flush()
    return payment


def activate_package_from_payment(db: Session, *, payment_id: uuid.UUID, provider_payment_id: str | None = None) -> StudentPackage:
    payment = db.execute(select(Payment).where(Payment.id == payment_id).with_for_update()).scalar_one_or_none()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if payment.status == PaymentStatus.paid and payment.package_id is not None:
        package = db.get(StudentPackage, payment.package_id)
        if package is not None:
            return package

    if payment.package_plan_id is None or payment.student_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is missing package purchase metadata")

    plan = db.get(PackagePlan, payment.package_plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Package plan no longer exists")

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
        total_classes=plan.class_count,
        classes_used=0,
        status="active",
    )
    db.add(package)
    db.flush()

    db.add(PackageCreditLedger(
        student_package_id=package.id,
        booking_id=None,
        delta=plan.class_count,
        reason="purchase",
        created_by=None,
    ))
    payment.package_id = package.id
    db.flush()
    return package
