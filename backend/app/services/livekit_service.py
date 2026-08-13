from datetime import timedelta

from livekit import api

from app.core.config import settings


def create_join_token(room_name: str, identity: str, name: str, can_publish: bool) -> str:
    """can_publish controls camera/mic. Screen-share and annotate are handled
    separately at the app layer (see permission_events) since LiveKit grants
    are coarse — we gate those finer actions in our own WebSocket handler."""
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
            )
        )
        .with_ttl(timedelta(hours=3))
        .to_jwt()
    )
    return token