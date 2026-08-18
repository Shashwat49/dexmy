from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, UserRole

EMAIL = "admin@dexmyedu.com"
PASSWORD = "Mypass123"
FULL_NAME = "Dexmy Admin"

db = SessionLocal()

try:
    existing = (
        db.query(User)
        .filter(User.email == EMAIL)
        .first()
    )

    if existing:
        print("Admin email already exists.")
    else:
        admin = User(
            email=EMAIL,
            password_hash=hash_password(PASSWORD),
            role=UserRole.admin,
            full_name=FULL_NAME,
            is_active=True,
            email_verified=True,
        )

        db.add(admin)
        db.commit()

        print("Admin created successfully.")
        print(f"Email: {EMAIL}")

finally:
    db.close()