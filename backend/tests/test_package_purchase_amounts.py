import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.models.package import PackageCreditLedger, PackagePlan, StudentPackage
from app.models.payment import Payment, PaymentStatus
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

    from app.services.package_credit_service import PackageCreditService
    assert PackageCreditService.get_class_price(db_session, package) == Decimal("1950.00")

    purchase_ledger = db_session.query(PackageCreditLedger).filter_by(
        student_package_id=package.id,
        reason="purchase",
    ).one()
    assert purchase_ledger.delta == 50



def test_first_package_checkout_response_accepts_provider_string_from_new_payment(
    db_session, seed_data, monkeypatch
):
    from app.api.v1.endpoints.package_payments import package_checkout
    from app.schemas.package_payment import PackageCheckoutRequest

    student = seed_data["student"]
    plan = PackagePlan(
        name="Checkout response package",
        class_count=25,
        price=Decimal("2000.00"),
        currency="INR",
    )
    db_session.add(plan)
    db_session.flush()
    monkeypatch.setattr(
        "app.api.v1.endpoints.package_payments.razorpay_service.create_order",
        lambda amount, currency, receipt: {"id": "order_checkout_test"},
    )
    response = package_checkout(
        PackageCheckoutRequest(
            package_plan_id=plan.id,
            provider="razorpay",
            idempotency_key=uuid.uuid4(),
            currency="INR",
        ),
        current_user=student,
        db=db_session,
    )

    assert response.provider == "razorpay"
    assert response.amount == Decimal("50000.00")
    assert response.razorpay_amount == 5_000_000


def test_idempotency_key_cannot_change_selected_subject(db_session, seed_data):
    from app.models.teacher import Subject
    from app.services.package_payment_service import get_or_create_payment

    student = seed_data["student"]
    math = seed_data["subject"]
    science = Subject(name="Payment Science")
    plan = PackagePlan(
        name="Choice package",
        class_count=25,
        price=Decimal("2000.00"),
        currency="INR",
    )
    db_session.add_all([math, science, plan])
    db_session.flush()
    idempotency_key = uuid.uuid4()
    payment = get_or_create_payment(
        db_session,
        payer_id=student.id,
        student_id=student.id,
        package_plan=plan,
        provider="razorpay",
        idempotency_key=idempotency_key,
        selected_subject_id=math.id,
    )
    db_session.flush()

    with pytest.raises(HTTPException) as error:
        get_or_create_payment(
            db_session,
            payer_id=student.id,
            student_id=student.id,
            package_plan=plan,
            provider="razorpay",
            idempotency_key=idempotency_key,
            selected_subject_id=science.id,
        )

    assert error.value.status_code == 409
    assert payment.selected_subject_id == math.id


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
    payment = Payment(
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
