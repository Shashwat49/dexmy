"""Reliability shim for LiveKit participant permission updates.

The classroom has two independent realtime connections: the classroom WebSocket
and the LiveKit room. A student can therefore be present in the WebSocket while
LiveKit is still finishing participant registration. In that small window an
UpdateParticipant call can fail with a participant-not-found/connection error.

This module wraps the LiveKit RoomService update operation with a short bounded
retry so permission changes made by the teacher are applied once the participant
is actually present. It does not grant any additional permissions; the caller's
ParticipantPermission remains authoritative.
"""

import asyncio

from livekit.api.room_service import RoomService


_original_update_participant = RoomService.update_participant


async def _update_participant_with_retry(self, update):
    last_error = None

    for attempt in range(8):
        try:
            return await _original_update_participant(self, update)
        except Exception as exc:
            last_error = exc
            if attempt == 7:
                raise

            # Give LiveKit a moment to finish registering the participant. We
            # intentionally keep this short so a real error is still surfaced.
            await asyncio.sleep(0.25)

    raise last_error


if RoomService.update_participant is _original_update_participant:
    RoomService.update_participant = _update_participant_with_retry
