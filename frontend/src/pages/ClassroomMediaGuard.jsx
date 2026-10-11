import { useEffect, useState } from "react";
import { LocalParticipant, Room, RoomEvent, Track, TrackEvent } from "livekit-client";

const desiredMedia = new WeakMap();
const PATCHED = Symbol("dexmyMediaGuardPatched");

// The LiveKit room the classroom is currently using. Set whenever Room.connect
// runs, cleared when the classroom unmounts.
let activeRoom = null;

function remember(participant, kind, enabled) {
  const state = desiredMedia.get(participant) || { camera: false, microphone: false };
  state[kind] = enabled;
  desiredMedia.set(participant, state);
}

function getDesired(participant) {
  return desiredMedia.get(participant) || { camera: false, microphone: false };
}

// --- Remote screen-share overlay -------------------------------------------
// Classroom.css turns #remote-screen into a full-board black overlay for as
// long as it contains a <video>. If a <video> is ever left behind after the
// other person stops sharing (event ordering, reconnects, a muted/ended track),
// that black layer stays on top of the whiteboard. LiveKit's real track state is
// the source of truth, so this keeps the overlay in sync with it.
function inspectRemoteScreenShares(room) {
  const result = { present: false, live: false };
  if (!room) return result;
  room.remoteParticipants?.forEach((participant) => {
    participant.trackPublications?.forEach((publication) => {
      if (publication.source !== Track.Source.ScreenShare) return;
      const track = publication.track;
      if (!track) return;
      if (track.mediaStreamTrack?.readyState === "ended") return;
      result.present = true;
      if (!publication.isMuted) result.live = true;
    });
  });
  return result;
}

function syncRemoteScreenOverlay() {
  const box = document.getElementById("remote-screen");
  if (!box) return;
  const { present, live } = inspectRemoteScreenShares(activeRoom);

  // No screen-share track exists any more: drop any leftover media elements.
  if (!present) {
    box.querySelectorAll("video, audio").forEach((element) => {
      try { element.pause?.(); } catch { /* ignore */ }
      element.remove();
    });
  }

  // Only show the overlay while a screen share is actually live. An inline
  // !important wins over the stylesheet's !important, so the whiteboard is
  // guaranteed to be visible whenever nothing is being shared.
  if (live) {
    if (box.style.getPropertyValue("display")) box.style.removeProperty("display");
  } else if (box.style.getPropertyValue("display") !== "none") {
    box.style.setProperty("display", "none", "important");
  }
}

const OVERLAY_SYNC_EVENTS = [
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.Disconnected,
  RoomEvent.Reconnected,
];

function installMediaGuard() {
  if (LocalParticipant.prototype[PATCHED]) return;
  LocalParticipant.prototype[PATCHED] = true;

  const originalCamera = LocalParticipant.prototype.setCameraEnabled;
  const originalMicrophone = LocalParticipant.prototype.setMicrophoneEnabled;
  const originalConnect = Room.prototype.connect;

  LocalParticipant.prototype.setCameraEnabled = function setCameraEnabled(enabled, ...args) {
    remember(this, "camera", enabled);
    return originalCamera.call(this, enabled, ...args);
  };

  LocalParticipant.prototype.setMicrophoneEnabled = function setMicrophoneEnabled(enabled, ...args) {
    remember(this, "microphone", enabled);
    return originalMicrophone.call(this, enabled, ...args);
  };

  Room.prototype.connect = async function connect(...args) {
    activeRoom = this;
    const result = await originalConnect.apply(this, args);
    const room = this;
    const participant = room.localParticipant;
    const boundTracks = new WeakSet();

    const bindTrackRecovery = (track) => {
      if (!track || boundTracks.has(track)) return;
      boundTracks.add(track);
      track.on?.(TrackEvent.Ended, async () => {
        const desired = getDesired(participant);
        const source = track.source;
        try {
          if (source === Track.Source.Camera && desired.camera) {
            if (!participant.isCameraEnabled) await participant.setCameraEnabled(true);
            else if (track.restartTrack) await track.restartTrack();
          } else if (source === Track.Source.Microphone && desired.microphone) {
            if (!participant.isMicrophoneEnabled) await participant.setMicrophoneEnabled(true);
            else if (track.restartTrack) await track.restartTrack();
          }
        } catch (error) {
          console.warn("Dexmy media recovery failed:", error);
        }
      });
    };

    const restoreMedia = async () => {
      const desired = getDesired(participant);
      try {
        if (desired.camera) await participant.setCameraEnabled(true);
        if (desired.microphone) await participant.setMicrophoneEnabled(true);
      } catch (error) {
        console.warn("Dexmy LiveKit reconnect media restore failed:", error);
      }
      participant.trackPublications?.forEach((publication) => bindTrackRecovery(publication.track));
    };

    participant.trackPublications?.forEach((publication) => bindTrackRecovery(publication.track));
    room.on(RoomEvent.LocalTrackPublished, (publication) => bindTrackRecovery(publication.track));
    room.on(RoomEvent.Reconnected, restoreMedia);
    room.on(RoomEvent.MediaDevicesChanged, () => {
      const desired = getDesired(participant);
      if (!desired.camera && !desired.microphone) return;
      setTimeout(restoreMedia, 150);
    });

    // Keep the remote screen-share overlay in step with the real track state.
    // These listeners are added after the classroom's own, so its handlers
    // (attach/detach) run first and this only cleans up what they missed.
    const syncOverlay = () => {
      if (activeRoom === room) syncRemoteScreenOverlay();
    };
    OVERLAY_SYNC_EVENTS.forEach((event) => room.on(event, syncOverlay));

    return result;
  };
}

export default function ClassroomMediaGuard() {
  const [Classroom, setClassroom] = useState(null);

  useEffect(() => {
    let active = true;
    installMediaGuard();
    import("./Classroom").then((module) => {
      if (active) setClassroom(() => module.default);
    });
    const playbackWatch = setInterval(() => {
      document.querySelectorAll(".classroom-video video").forEach((video) => {
        const stream = video.srcObject;
        const hasLiveTrack = stream?.getVideoTracks?.().some((track) => track.readyState === "live");
        if (hasLiveTrack && video.paused) video.play?.().catch(() => {});
      });
    }, 1000);
    // Safety net in case a LiveKit event is missed or arrives out of order.
    const overlayWatch = setInterval(syncRemoteScreenOverlay, 500);
    return () => {
      active = false;
      clearInterval(playbackWatch);
      clearInterval(overlayWatch);
      activeRoom = null;
    };
  }, []);

  if (!Classroom) {
    return <div className="min-h-screen grid place-items-center bg-[#0b1020] text-white text-sm">Connecting to classroom…</div>;
  }
  return <Classroom />;
}
