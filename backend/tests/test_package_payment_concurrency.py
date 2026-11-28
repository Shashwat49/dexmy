import uuid
import concurrent.futures
from decimal import Decimal
import pytest
from sqlalchemy import select
from fastapi import HTTPException

from app.models.package import PackagePlan, StudentPackage, PackageCreditLedger
from app.models.payment import Payment, PaymentStatus
from app.services.package_payment_service import activate_package_from_payment

def test_concurrent_package_activation(db_session, seed_data):
    # Setup a package plan and payment
    student = seed_data["student"]
    
    plan = PackagePlan(
        id=uuid.uuid4(),
        name="Test 50 Classes",
        class_count=50,
        price=Decimal("300.00"),
        currency="INR"
    )
    db_session.add(plan)
    db_session.commit()

    payment = Payment(
        id=uuid.uuid4(),
        package_plan_id=plan.id,
        student_id=student.id,
        payer_id=student.id,
        amount=Decimal("15000.00"),
        package_class_count=50,
        currency=plan.currency,
        provider="razorpay",
        status=PaymentStatus.created,
        provider_order_id="order_test_123"
    )
    db_session.add(payment)
    db_session.commit()
    payment_id = payment.id

    # We need separate sessions for concurrent tests because SQLAlchemy sessions are not thread-safe.
    # The fixture db_session is a single session. We will use the SessionLocal factory from the app.
    from app.db.session import SessionLocal

    def activate_worker():
        db = SessionLocal()
        try:
            package = activate_package_from_payment(
                db=db,
                payment_id=payment_id,
                provider_payment_id="pay_test_123"
            )
            return package.id
        except HTTPException as e:
            return e
        finally:
            db.commit()
            db.close()

    # Simulate 3 concurrent requests (e.g. 1 frontend verify + 2 webhooks)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(lambda _: activate_worker(), range(3)))

    # Exactly ONE should succeed and return the same package identifier.
    # Other requests may also return that identifier after observing activation.
    packages_created = 0
    conflicts = 0
    package_ids = set()

    for res in results:
        if isinstance(res, uuid.UUID):
            packages_created += 1
            package_ids.add(res)
        elif isinstance(res, HTTPException) and res.status_code == 409:
            conflicts += 1

    # At least one must succeed
    assert packages_created > 0
    # All successful ones must refer to the EXACT SAME package ID
    assert len(package_ids) == 1

    # Verify DB state
    db_session.expire_all()
    
    # 1. Payment status updated
    updated_payment = db_session.get(Payment, payment_id)
    assert updated_payment.status == PaymentStatus.paid
    assert updated_payment.provider_payment_id == "pay_test_123"
    
    # 2. Exactly ONE StudentPackage created for this payment
    student_packages = db_session.execute(
        select(StudentPackage).where(StudentPackage.payment_id == payment_id)
    ).scalars().all()
    assert len(student_packages) == 1
    
    # 3. Exactly ONE PackageCreditLedger created
    ledgers = db_session.execute(
        select(PackageCreditLedger).where(PackageCreditLedger.student_package_id == student_packages[0].id)
    ).scalars().all()
    assert len(ledgers) == 1
    assert ledgers[0].delta == 50
