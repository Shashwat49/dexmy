from datetime import timedelta

from livekit import api

from app.core.config import settings


def create_join_token(
    room_name: str,
    identity: str,
    name: str,
    can_publish: bool,
    publish_sources: list[str] | None = None,
) -> str:
    """Create a short-lived, least-privilege classroom token.

    ``can_publish_sources`` is enforced by LiveKit itself. This is important for
    classroom moderation: a student can initially publish camera/microphone but
    cannot publish screen-share unless the teacher explicitly grants it.
    """
    token = (
        api.AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=can_publish,
                can_subscribe=True,
                can_publish_data=True,
                can_publish_sources=publish_sources,
            )
        )
        .with_ttl(timedelta(hours=3))
        .to_jwt()
    )
    return token
