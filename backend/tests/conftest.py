import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sqlalchemy as sa
from dotenv import load_dotenv

# Load env variables from .env if present
load_dotenv()

# Must set the environment to test before importing the app
os.environ["ENVIRONMENT"] = "test"

# Optional: Ensure it uses a test DB, but for now we expect DATABASE_URL to be set correctly in env
if not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:///./test.db" # Fallback, though tests might fail on Postgres constraints

from app.main import app
from app.db.session import get_db
from app.db.base import Base

# Test database URL
TEST_DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Setup the database for the entire test session.
    Runs raw SQL migrations to ensure the DB schema and constraints match production.
    """
    # Create tables that are in Base.metadata
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    # Run the raw sql migration file to apply DB-specific constraints (e.g. EXCLUDE USING GIST)
    sql_file_path = os.path.join(os.path.dirname(__file__), "..", "sql_migrations", "001_booking_constraints_and_audit.sql")
    if os.path.exists(sql_file_path):
        with open(sql_file_path, "r") as f:
            sql = f.read()
            # Execute the sql file
            with engine.connect() as conn:
                conn.execute(sa.text(sql))
                conn.commit()

    yield

    # Teardown
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    """
    Provides a SQLAlchemy session for a single test.
    We truncate all tables before each test to guarantee isolation.
    """
    session = TestingSessionLocal()
    
    with engine.begin() as conn:
        conn.execute(sa.text("SET session_replication_role = 'replica';"))
        
        tables = Base.metadata.sorted_tables
        for table in tables:
            conn.execute(sa.text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE;'))
            
        # Also truncate the audit table since it might not be in Base.metadata initially
        conn.execute(sa.text('TRUNCATE TABLE "booking_assignment_audits" RESTART IDENTITY CASCADE;'))
        
        conn.execute(sa.text("SET session_replication_role = 'origin';"))
    
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="function")
def client(db_session):
    """
    FastAPI TestClient that overrides the get_db dependency.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def auth_headers():
    from app.core.security import create_access_token
    def _auth_headers(user_id: str, role: str):
        token = create_access_token(subject=str(user_id), role=role)
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers

@pytest.fixture(scope="function")
def seed_data(db_session):
    from app.models.user import User, UserRole
    from app.models.teacher import Subject, TeacherProfile, TeacherSubject
    from app.core.security import hash_password
    import uuid

    # Create admin
    admin = User(id=uuid.uuid4(), email="admin@test.com", password_hash=hash_password("test"), role=UserRole.admin, full_name="Admin", is_active=True, email_verified=True)
    
    # Create student
    student = User(id=uuid.uuid4(), email="student@test.com", password_hash=hash_password("test"), role=UserRole.student, full_name="Student", is_active=True, email_verified=True)
    
    # Create teachers
    teacher1 = User(id=uuid.uuid4(), email="teacher1@test.com", password_hash=hash_password("test"), role=UserRole.teacher, full_name="Teacher 1", is_active=True, email_verified=True)
    teacher2 = User(id=uuid.uuid4(), email="teacher2@test.com", password_hash=hash_password("test"), role=UserRole.teacher, full_name="Teacher 2", is_active=True, email_verified=True)
    
    db_session.add_all([admin, student, teacher1, teacher2])
    db_session.flush()

    # Profiles
    p1 = TeacherProfile(user_id=teacher1.id, bio="Bio", hourly_rate=500.0, is_verified=True)
    p2 = TeacherProfile(user_id=teacher2.id, bio="Bio", hourly_rate=500.0, is_verified=True)
    db_session.add_all([p1, p2])
    db_session.flush()

    # Subject
    subject = Subject(name="Math")
    db_session.add(subject)
    db_session.flush()

    # Teacher subjects
    ts1 = TeacherSubject(teacher_id=teacher1.id, subject_id=subject.id)
    ts2 = TeacherSubject(teacher_id=teacher2.id, subject_id=subject.id)
    db_session.add_all([ts1, ts2])
    
    db_session.commit()

    return {
        "admin": admin,
        "student": student,
        "teacher1": teacher1,
        "teacher2": teacher2,
        "subject": subject
    }

