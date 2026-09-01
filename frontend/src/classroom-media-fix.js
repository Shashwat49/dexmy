import { Room, RoomEvent, Track } from "livekit-client";

// The classroom UI has separate video boxes for teacher/student, but its
// LocalTrackPublished handler historically used the same video box for every
// local publication. Publishing the microphone therefore cleared the camera
// element. Keep track of the camera preview target and restore it after any
// non-video local publication.
if (!Room.prototype.__dexmyMediaFixHooked) {
  Room.prototype.__dexmyMediaFixHooked = true;

  const originalConnect = Room.prototype.connect;

  Room.prototype.connect = async function (...args) {
    const result = await originalConnect.apply(this, args);
    const room = this;

    let cameraTargetId = null;
    let cameraTrack = null;

    const findVideoTarget = () => {
      for (const id of ["local-video", "remote-video"]) {
        const box = document.getElementById(id);
        if (box?.querySelector("video")) return id;
      }
      return null;
    };

    const restoreCamera = () => {
      if (!cameraTrack || !cameraTargetId) return;
      const box = document.getElementById(cameraTargetId);
      if (!box) return;

      const existing = box.querySelector("video");
      if (existing) return;

      const element = cameraTrack.attach();
      element.autoplay = true;
      element.playsInline = true;
      element.muted = true;
      element.className = "absolute inset-0 w-full h-full object-contain bg-black";
      box.appendChild(element);
    };

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.source === Track.Source.Camera && publication.track) {
        cameraTrack = publication.track;
        cameraTargetId = findVideoTarget();
        if (!cameraTargetId) {
          // The normal Classroom handler may run after this hook in some
          // browser/event-order combinations. Give it a tick, then detect the
          // box it populated.
          setTimeout(() => {
            cameraTargetId = findVideoTarget();
            restoreCamera();
          }, 0);
        }
        return;
      }

      // Microphone publication must never replace the camera preview.
      if (publication.source === Track.Source.Microphone) {
        setTimeout(restoreCamera, 0);
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.source === Track.Source.Camera) {
        cameraTrack = null;
        cameraTargetId = null;
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      cameraTrack = null;
      cameraTargetId = null;
    });

    return result;
  };
}
