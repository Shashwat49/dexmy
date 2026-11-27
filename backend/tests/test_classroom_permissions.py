from types import SimpleNamespace
import uuid

from livekit import api

from app.websockets.classroom_ws import _allowed_sources


def test_livekit_permission_uses_track_source_enum_values():
    student_id = uuid.uuid4()
    room = SimpleNamespace(permissions={
        str(student_id): {"camera", "mic", "screen_share"},
    })

    sources = _allowed_sources(room, student_id)
    permission = api.ParticipantPermission(
        can_subscribe=True,
        can_publish=bool(sources),
        can_publish_data=True,
        can_publish_sources=sources,
    )

    assert list(permission.can_publish_sources) == [
        api.TrackSource.CAMERA,
        api.TrackSource.MICROPHONE,
        api.TrackSource.SCREEN_SHARE,
    ]


def test_livekit_permission_omits_revoked_screen_share_source():
    student_id = uuid.uuid4()
    room = SimpleNamespace(permissions={
        str(student_id): {"camera", "mic"},
    })

    sources = _allowed_sources(room, student_id)

    assert sources == [api.TrackSource.CAMERA, api.TrackSource.MICROPHONE]
