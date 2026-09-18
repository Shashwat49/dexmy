import uuid

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole


def test_refresh_token_replay_revokes_session(client, db_session):
    # Create test user
    user = User(
        id=uuid.uuid4(),
        email="refresh@test.com",
        password_hash=hash_password("test"),
        role=UserRole.student,
        full_name="Refresh Test",
        is_active=True,
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()

    # Login
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "refresh@test.com",
            "password": "test",
        },
    )

    assert response.status_code == 200

    # Save the original refresh token
    old_refresh_token = client.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert old_refresh_token is not None

    # First refresh rotates the refresh token
    response = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-CSRF-Token": client.cookies.get(settings.CSRF_COOKIE_NAME)
        },
    )

    assert response.status_code == 200

    # New refresh token should be different
    new_refresh_token = client.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert new_refresh_token is not None
    assert new_refresh_token != old_refresh_token

    # Try to reuse the old refresh token
    client.cookies.set(settings.REFRESH_COOKIE_NAME, old_refresh_token)

    response = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-CSRF-Token": client.cookies.get(settings.CSRF_COOKIE_NAME)
        },
    )

    assert response.status_code in (401, 403)