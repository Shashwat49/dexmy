import uuid
from decimal import Decimal
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.package_payments import package_checkout
from app.models.package import PackagePlan
from app.models.teacher import Subject
from app.models.user import User, UserRole
from app.schemas.package_payment import PackageCheckoutRequest
from app.services.package_payment_service import validate_package_selection


def _checkout(db, plan, *, currency, subject_id):
    student = User(
        id=uuid.uuid4(), email="student@example.test", password_hash="unused",
        role=UserRole.student, full_name="Test Student",
    )
    payload = PackageCheckoutRequest(
        package_plan_id=plan.id,
        provider="razorpay",
        idempotency_key=uuid.uuid4(),
        student_id=student.id,
        currency=currency,
        selected_subject_id=subject_id,
    )
    return package_checkout(payload, current_user=student, db=db)


def test_selected_subject_rejects_plan_outside_explicit_associations():
    math = Subject(id=1, name="Math")
    science = Subject(id=2, name="Science")
    plan = PackagePlan(name="Math plan", class_count=25, price=Decimal("10.00"), currency="USD", subjects=[math])
    db = Mock()
    db.get.side_effect = lambda model, _id: plan if model is PackagePlan else science

    with pytest.raises(HTTPException) as error:
        validate_package_selection(db, plan, currency="USD", subject_id=science.id)
    assert error.value.status_code == 400
    assert error.value.detail == "Package is not available for the selected subject"


def test_legacy_unassigned_plan_accepts_any_real_selected_subject():
    math = Subject(id=1, name="Math")
    plan = PackagePlan(name="Legacy plan", class_count=25, price=Decimal("10.00"), currency="INR", subjects=[])
    db = Mock()
    db.get.return_value = math

    validate_package_selection(db, plan, currency="INR", subject_id=math.id)
    validate_package_selection(db, plan, currency=None, subject_id=None)


def test_checkout_rejects_selected_currency_that_differs_from_plan():
    plan = PackagePlan(id=uuid.uuid4(), name="USD plan", class_count=25, price=Decimal("10.00"), currency="USD", is_active=True)
    db = Mock()
    db.get.return_value = plan

    with pytest.raises(HTTPException) as error:
        _checkout(db, plan, currency="INR", subject_id=None)
    assert error.value.status_code == 400
    assert error.value.detail == "Selected currency does not match the package currency"


def test_checkout_rejects_subject_not_associated_with_plan():
    math = Subject(id=1, name="Math")
    science = Subject(id=2, name="Science")
    plan = PackagePlan(id=uuid.uuid4(), name="Math plan", class_count=25, price=Decimal("10.00"), currency="INR", is_active=True, subjects=[math])
    db = Mock()
    db.get.side_effect = lambda model, _id: plan if model is PackagePlan else science

    with pytest.raises(HTTPException) as error:
        _checkout(db, plan, currency="INR", subject_id=science.id)
    assert error.value.status_code == 400
    assert error.value.detail == "Package is not available for the selected subject"
