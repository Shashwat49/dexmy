import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException

from app.models.booking import Booking, BookingStatus
from app.models.package import PackagePlan, StudentPackage
from app.models.teacher import Subject
from app.models.user import User, UserRole
from app.services.package_credit_service import PackageCreditService


def _super_admin(db_session):
    admin = User(
        id=uuid.uuid4(),
        email=f"package-admin-{uuid.uuid4()}@test.com",
        password_hash="unused",
        role=UserRole.super_admin,
        full_name="Package Admin",
        is_active=True,
        email_verified=True,
    )
    db_session.add(admin)
    db_session.commit()
    return admin


def _create_subject(db_session, name):
    subject = Subject(name=name)
    db_session.add(subject)
    db_session.commit()
    return subject


def test_admin_can_assign_and_unassign_subjects_without_changing_plan_fields(client, db_session, auth_headers):
    admin = _super_admin(db_session)
    math = _create_subject(db_session, "Math")
    science = _create_subject(db_session, "Science")
    headers = auth_headers(str(admin.id), "super_admin")

    created = client.post(
        "/api/v1/admin/packages",
        headers=headers,
        json={"name": "Existing plan", "class_count": 25, "price": "2500.00", "currency": "INR", "subject_ids": [science.id, math.id]},
    )
    assert created.status_code == 201, created.text
    plan = created.json()
    assert plan["subject_ids"] == [math.id, science.id]
    assert plan["subjects"] == [{"id": math.id, "name": "Math"}, {"id": science.id, "name": "Science"}]
    assert plan["price"] == "2500.00"
    plan_id = plan["id"]

    unchanged = client.patch(f"/api/v1/admin/packages/{plan_id}", headers=headers, json={"name": "Existing plan"})
    assert unchanged.status_code == 200
    assert unchanged.json()["subject_ids"] == [math.id, science.id]

    removed = client.patch(f"/api/v1/admin/packages/{plan_id}", headers=headers, json={"subject_ids": []})
    assert removed.status_code == 200
    assert removed.json()["subject_ids"] == []
    assert removed.json()["subjects"] == []
    assert removed.json()["price"] == "2500.00"


def test_admin_rejects_unknown_subject_ids_without_mutating_existing_assignment(client, db_session, auth_headers):
    admin = _super_admin(db_session)
    math = _create_subject(db_session, "Math")
    plan = PackagePlan(name="Plan", class_count=25, price=Decimal("100.00"), currency="USD", subjects=[math])
    db_session.add(plan)
    db_session.commit()
    headers = auth_headers(str(admin.id), "super_admin")

    response = client.patch(f"/api/v1/admin/packages/{plan.id}", headers=headers, json={"subject_ids": [math.id, 987654]})

    assert response.status_code == 422
    db_session.refresh(plan)
    assert [subject.id for subject in plan.subjects] == [math.id]


def test_public_catalogue_keeps_unassigned_plans_and_adds_subject_details(client, db_session):
    math = _create_subject(db_session, "Math")
    legacy = PackagePlan(name="Legacy INR", class_count=25, price=Decimal("4999.00"), currency="INR", is_custom=False, is_active=True)
    assigned = PackagePlan(name="Science USD", class_count=50, price=Decimal("125.00"), currency="USD", is_custom=True, is_active=True, subjects=[math])
    db_session.add_all([legacy, assigned])
    db_session.commit()

    response = client.get("/api/v1/packages")

    assert response.status_code == 200
    catalogue = {package["name"]: package for package in response.json()}
    assert catalogue["Legacy INR"]["subject_ids"] == []
    assert catalogue["Legacy INR"]["subjects"] == []
    assert catalogue["Legacy INR"]["price"] == "4999.00"
    assert catalogue["Legacy INR"]["currency"] == "INR"
    assert catalogue["Science USD"]["subject_ids"] == [math.id]
    assert catalogue["Science USD"]["subjects"] == [{"id": math.id, "name": "Math"}]
    assert catalogue["Science USD"]["currency"] == "USD"
    assert catalogue["Science USD"]["is_custom"] is True


def test_association_metadata_and_migration_are_additive():
    from pathlib import Path

    from app.models.package import package_plan_subjects

    migration = Path(__file__).parents[1] / "alembic" / "versions" / "20261128_package_plan_subjects.py"
    source = migration.read_text(encoding="utf-8")
    assert package_plan_subjects.primary_key.columns.keys() == ["package_plan_id", "subject_id"]
    assert "op.create_table(" in source
    assert "package_plans" in source and "subjects" in source
    assert "UPDATE " not in source.upper()
    assert 'op.drop_table("package_plan_subjects")' in source
    assert "student_packages" not in source
    assert "package_plans" not in source.split("def downgrade():", 1)[1]



def _student(db_session):
    student = User(
        id=uuid.uuid4(),
        email=f"package-student-{uuid.uuid4()}@test.com",
        password_hash="unused",
        role=UserRole.student,
        full_name="Package Student",
        is_active=True,
        email_verified=True,
    )
    db_session.add(student)
    db_session.flush()
    return student


def _student_package(db_session, student, plan, *, total_classes=25):
    package = StudentPackage(
        id=uuid.uuid4(),
        student_id=student.id,
        package_plan_id=plan.id,
        total_classes=total_classes,
        classes_used=0,
        is_unlimited=False,
        status="active",
    )
    db_session.add(package)
    db_session.flush()
    return package


def test_subject_restricted_package_is_not_selected_for_another_subject(db_session):
    student = _student(db_session)
    math = _create_subject(db_session, "Math")
    science = _create_subject(db_session, "Science")
    plan = PackagePlan(
        name="Math only",
        class_count=25,
        price=Decimal("5000.00"),
        currency="INR",
        subjects=[math],
    )
    db_session.add(plan)
    db_session.flush()
    _student_package(db_session, student, plan)
    db_session.commit()

    try:
        PackageCreditService.select_active_package_for_student(
            db_session,
            student_id=student.id,
            subject_id=science.id,
        )
        assert False, "A Math-only package must not be selected for Science."
    except HTTPException as exc:
        assert exc.status_code == 402
        assert "this subject" in exc.detail.lower()


def test_unassigned_legacy_package_remains_valid_for_any_subject(db_session):
    student = _student(db_session)
    science = _create_subject(db_session, "Science")
    legacy_plan = PackagePlan(
        name="Legacy unrestricted",
        class_count=25,
        price=Decimal("5000.00"),
        currency="INR",
        subjects=[],
    )
    db_session.add(legacy_plan)
    db_session.flush()
    legacy_package = _student_package(db_session, student, legacy_plan)
    db_session.commit()

    selected = PackageCreditService.select_active_package_for_student(
        db_session,
        student_id=student.id,
        subject_id=science.id,
    )

    assert selected.id == legacy_package.id


def test_credit_consumption_rechecks_package_subject_against_booking(db_session):
    student = _student(db_session)
    math = _create_subject(db_session, "Math")
    science = _create_subject(db_session, "Science")
    math_plan = PackagePlan(
        name="Math only",
        class_count=25,
        price=Decimal("5000.00"),
        currency="INR",
        subjects=[math],
    )
    db_session.add(math_plan)
    db_session.flush()
    package = _student_package(db_session, student, math_plan)
    booking = Booking(
        id=uuid.uuid4(),
        student_id=student.id,
        subject_id=science.id,
        scheduled_at=datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc),
        booking_ends_at=datetime(2026, 12, 1, 10, 55, tzinfo=timezone.utc),
        duration_minutes=55,
        status=BookingStatus.confirmed,
        price=Decimal("200.00"),
    )
    db_session.add(booking)
    db_session.commit()

    try:
        PackageCreditService.consume(
            db_session,
            student_package_id=package.id,
            booking_id=booking.id,
            created_by=student.id,
        )
        assert False, "A Math-only package must not debit for a Science booking."
    except HTTPException as exc:
        assert exc.status_code == 409
    db_session.rollback()
    db_session.refresh(package)
    assert package.classes_used == 0
