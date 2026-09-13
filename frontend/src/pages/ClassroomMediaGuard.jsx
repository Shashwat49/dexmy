import { useEffect, useState } from "react";
import { LocalParticipant, Room, RoomEvent, Track, TrackEvent } from "livekit-client";

const desiredMedia = new WeakMap();
const PATCHED = Symbol("dexmyMediaGuardPatched");

function remember(participant, kind, enabled) {
  const state = desiredMedia.get(participant) || { camera: false, microphone: false };
  state[kind] = enabled;
  desiredMedia.set(participant, state);
}

function getDesired(participant) {
  return desiredMedia.get(participant) || { camera: false, microphone: false };
}

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
    return () => {
      active = false;
      clearInterval(playbackWatch);
    };
  }, []);

  if (!Classroom) {
    return <div className="min-h-screen grid place-items-center bg-[#0b1020] text-white text-sm">Connecting to classroom…</div>;
  }
  return <Classroom />;
}
