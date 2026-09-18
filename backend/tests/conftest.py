import os
import uuid

from app.models.admin import AdminPermission, AdminRolePermission
import pytest
import sqlalchemy as sa
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


load_dotenv()

base_database_url = os.environ.get("DATABASE_URL")
if not base_database_url:
    raise RuntimeError("DATABASE_URL must be set for tests")

test_database_url = sa.engine.make_url(base_database_url).set(
    database="dexmy_test"
)

from app.main import app
from app.db.base import Base
from app.db.session import get_db


# ============================================================
# TEST DATABASE
# ============================================================

TEST_DATABASE_URL = test_database_url

engine = create_engine(
    TEST_DATABASE_URL,
    pool_pre_ping=True,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ============================================================
# DATABASE SETUP
# ============================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Setup the dedicated test database for the entire test session.

    The schema is recreated from SQLAlchemy metadata and then the
    booking migration is applied.
    """

    # Reset dedicated test database schema.
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "DROP SCHEMA IF EXISTS public CASCADE"
        )
        conn.exec_driver_sql(
            "CREATE SCHEMA public"
        )

    # Create SQLAlchemy tables.
    Base.metadata.create_all(bind=engine)
    from app.models.student_subject_teacher import StudentSubjectTeacher

    # Apply booking migration.
    sql_file_path = os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "sql_migrations",
            "001_booking_constraints_and_audit.sql",
        )
    )

    if not os.path.exists(sql_file_path):
        raise FileNotFoundError(
            f"Booking migration not found: {sql_file_path}"
        )

    with open(sql_file_path, "r", encoding="utf-8") as f:
        sql = f.read()

    with engine.begin() as conn:
        conn.execute(sa.text(sql))

    yield

    # Cleanup after the complete test session.
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "DROP SCHEMA IF EXISTS public CASCADE"
        )
        conn.exec_driver_sql(
            "CREATE SCHEMA public"
        )


# ============================================================
# DATABASE SESSION
# ============================================================

@pytest.fixture(scope="function")
def db_session():
    """
    Provides one database session for test setup/assertions.

    HTTP requests do NOT reuse this session.
    Each HTTP request gets its own SQLAlchemy session.
    """

    session = TestingSessionLocal()

    # Clean database before every test.
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "SET session_replication_role = 'replica';"
            )
        )

        # Avoid Base.metadata.sorted_tables because the schema
        # contains circular foreign-key relationships.
        result = conn.execute(
            sa.text(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                """
            )
        )

        table_names = [row[0] for row in result]

        for table_name in table_names:
            conn.execute(
                sa.text(
                    f'TRUNCATE TABLE "{table_name}" '
                    "RESTART IDENTITY CASCADE;"
                )
            )

        conn.execute(
            sa.text(
                "SET session_replication_role = 'origin';"
            )
        )

    try:
        yield session
    finally:
        session.close()


# ============================================================
# FASTAPI TEST CLIENT
# ============================================================

@pytest.fixture(scope="function")
def client():
    """
    FastAPI TestClient.

    Every incoming HTTP request receives a fresh SQLAlchemy
    session, matching the production get_db() behaviour.
    """

    def override_get_db():
        db = TestingSessionLocal()

        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


# ============================================================
# AUTHENTICATION
# ============================================================

@pytest.fixture(scope="function")
def auth_headers(db_session, client):
    """
    Authenticate a test user using the same cookie/session model
    used by the application.

    No Authorization header or Bearer token is used.
    """

    from app.core.csrf import create_csrf_token
    from app.models.user import User
    from app.services.auth_session import create_auth_session

    def _auth_headers(user_id: str, role: str):
        # The role argument is retained because existing tests pass it.
        # Actual authorization comes from the User record in the DB.
        del role

        user = db_session.get(User, user_id)

        if user is None:
            raise ValueError(
                f"Test user not found: {user_id}"
            )

        (
            access_token,
            refresh_token,
            access_expires_at,
            refresh_expires_at,
        ) = create_auth_session(
            db_session,
            user,
        )

        csrf_token = create_csrf_token()

        db_session.commit()

        # Use the configured cookie names rather than hardcoding them.
        from app.core.config import settings

        client.cookies.set(
            settings.ACCESS_COOKIE_NAME,
            access_token,
        )

        client.cookies.set(
            settings.REFRESH_COOKIE_NAME,
            refresh_token,
        )

        client.cookies.set(
            settings.CSRF_COOKIE_NAME,
            csrf_token,
        )

        return {
            "X-CSRF-Token": csrf_token,
        }

    return _auth_headers


# ============================================================
# SEED DATA
# ============================================================

@pytest.fixture(scope="function")
def seed_data(db_session):
    from app.core.security import hash_password
    from app.models.teacher import (
        Subject,
        TeacherProfile,
        TeacherSubject,
    )
    from app.models.user import User, UserRole

    import uuid

    # --------------------------------------------------------
    # Users
    # --------------------------------------------------------

    admin = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash=hash_password("test"),
        role=UserRole.admin,
        full_name="Admin",
        is_active=True,
        email_verified=True,
    )

    student = User(
        id=uuid.uuid4(),
        email="student@test.com",
        password_hash=hash_password("test"),
        role=UserRole.student,
        full_name="Student",
        is_active=True,
        email_verified=True,
    )

    teacher1 = User(
        id=uuid.uuid4(),
        email="teacher1@test.com",
        password_hash=hash_password("test"),
        role=UserRole.teacher,
        full_name="Teacher 1",
        is_active=True,
        email_verified=True,
    )

    teacher2 = User(
        id=uuid.uuid4(),
        email="teacher2@test.com",
        password_hash=hash_password("test"),
        role=UserRole.teacher,
        full_name="Teacher 2",
        is_active=True,
        email_verified=True,
    )

    db_session.add_all(
        [
            admin,
            student,
            teacher1,
            teacher2,
        ]
    )

    db_session.flush()
    
    assign_teacher_permission = AdminPermission(
        id=uuid.uuid4(),
        key="booking.assign_teacher",
        description="Assign a teacher to a booking",
    )

    db_session.add(assign_teacher_permission)
    db_session.flush()

    db_session.add(
        AdminRolePermission(
            id=uuid.uuid4(),
            role=UserRole.admin.value,
            permission_id=assign_teacher_permission.id,
        )
    )

    db_session.flush()
    # --------------------------------------------------------
    # Teacher profiles
    # --------------------------------------------------------
    p1 = TeacherProfile(
        user_id=teacher1.id,
        bio="Bio",
        hourly_rate=500.0,
        is_verified=True,
    )

    p2 = TeacherProfile(
        user_id=teacher2.id,
        bio="Bio",
        hourly_rate=500.0,
        is_verified=True,
    )

    db_session.add_all([p1, p2])
    db_session.flush()

    # --------------------------------------------------------
    # Subject
    # --------------------------------------------------------

    subject = Subject(
        name="Math"
    )

    db_session.add(subject)
    db_session.flush()

    # --------------------------------------------------------
    # Teacher subjects
    # --------------------------------------------------------

    ts1 = TeacherSubject(
        teacher_id=teacher1.id,
        subject_id=subject.id,
    )

    ts2 = TeacherSubject(
        teacher_id=teacher2.id,
        subject_id=subject.id,
    )

    db_session.add_all([ts1, ts2])

    db_session.commit()

    return {
        "admin": admin,
        "student": student,
        "teacher1": teacher1,
        "teacher2": teacher2,
        "subject": subject,
    }