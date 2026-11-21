from types import SimpleNamespace
import uuid

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core.dependencies import get_current_user
from app.core.security import create_classroom_ws_token
from app.websockets.classroom_ws import _authenticate


class ActiveUserDb:
    def get(self, model, user_id):
        return SimpleNamespace(id=user_id, is_active=True)


def test_classroom_websocket_token_is_limited_to_its_session():
    db = ActiveUserDb()
    session_id = uuid.uuid4()
    token = create_classroom_ws_token("e77bf6ba-01f7-451e-86f3-479652eaf33c", "student", str(session_id))

    assert _authenticate(token, db, session_id) is not None
    assert _authenticate(token, db, uuid.uuid4()) is None


def test_classroom_websocket_token_cannot_authenticate_api_requests():
    token = create_classroom_ws_token("e77bf6ba-01f7-451e-86f3-479652eaf33c", "student", str(uuid.uuid4()))
    request = Request({
        "type": "http",
        "method": "GET",
        "scheme": "https",
        "server": ("test", 443),
        "client": ("test", 1234),
        "headers": [],
        "path": "/",
        "query_string": b"",
    })

    with pytest.raises(HTTPException) as error:
        get_current_user(request, access_cookie=token, credentials=None, db=ActiveUserDb())

    assert error.value.status_code == 401
