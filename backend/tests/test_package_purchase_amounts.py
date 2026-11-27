import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.payment import PaymentStatus
from app.services.package_payment_service import activate_package_from_payment, get_or_create_payment


def test_package_checkout_stores_total_and_snapshots_class_count(db_session, seed_data):
    student = seed_data["student"]
    plan = PackagePlan(
        id=uuid.uuid4(),
        name="50 Classes Package",
        class_count=50,
        price=Decimal("1950.00"),
        currency="INR",
        is_active=True,
    )
    db_session.add(plan)
    db_session.flush()

    payment = get_or_create_payment(
        db_session,
        payer_id=student.id,
        student_id=student.id,
        package_plan=plan,
        provider="razorpay",
        idempotency_key=uuid.uuid4(),
    )

    assert payment.amount == Decimal("97500.00")
    assert payment.package_class_count == 50

    # An admin changing the plan after checkout must not alter the paid entitlement.
    plan.class_count = 100
    package = activate_package_from_payment(db_session, payment_id=payment.id, provider_payment_id="pay_test")
    db_session.commit()

    assert package.total_classes == 50
    assert package.classes_used == 0
    assert payment.status == PaymentStatus.paid

    purchase_ledger = db_session.query(PackageCreditLedger).filter_by(
        student_package_id=package.id,
        reason="purchase",
    ).one()
    assert purchase_ledger.delta == 50



def test_legacy_underpriced_payment_cannot_activate_full_package(db_session, seed_data):
    student = seed_data["student"]
    plan = PackagePlan(
        id=uuid.uuid4(),
        name="Legacy 25 Classes Package",
        class_count=25,
        price=Decimal("2000.00"),
        currency="INR",
        is_active=True,
    )
    db_session.add(plan)
    payment = __import__("app.models.payment", fromlist=["Payment"]).Payment(
        id=uuid.uuid4(),
        package_plan_id=plan.id,
        student_id=student.id,
        payer_id=student.id,
        amount=Decimal("2000.00"),
        currency="INR",
        provider="razorpay",
        status=PaymentStatus.created,
        package_class_count=None,
    )
    db_session.add(payment)
    db_session.commit()

    with pytest.raises(HTTPException) as error:
        activate_package_from_payment(db_session, payment_id=payment.id, provider_payment_id="pay_legacy")

    assert error.value.status_code == 409
    assert db_session.query(StudentPackage).filter_by(payment_id=payment.id).count() == 0
