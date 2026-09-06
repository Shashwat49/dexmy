import { Room, RoomEvent, Track } from "livekit-client";

const WHITEBOARD_TOPIC = "dexmy-whiteboard-live";
const classroomSockets = new Set();
const socketState = new WeakMap();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// High-frequency live whiteboard packets use LiveKit's low-latency lossy data
// channel. Durable stroke/page/snapshot messages continue using the existing
// classroom WebSocket path, preserving persistence and reconnect behavior.
if (!WebSocket.prototype.__dexmyWhiteboardTransportHooked) {
  WebSocket.prototype.__dexmyWhiteboardTransportHooked = true;

  const nativeSend = WebSocket.prototype.send;
  const onMessageDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");

  if (onMessageDescriptor?.get && onMessageDescriptor?.set) {
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      configurable: onMessageDescriptor.configurable,
      enumerable: onMessageDescriptor.enumerable,
      get() {
        return onMessageDescriptor.get.call(this);
      },
      set(handler) {
        const isClassroom = typeof this.url === "string" && this.url.includes("/ws/classroom/");
        if (!isClassroom || typeof handler !== "function") {
          onMessageDescriptor.set.call(this, handler);
          return;
        }

        classroomSockets.add(this);
        socketState.set(this, { annotate: false, handler });
        onMessageDescriptor.set.call(this, (event) => {
          let message;
          try {
            message = JSON.parse(event.data);
          } catch {
            handler.call(this, event);
            return;
          }

          const state = socketState.get(this);
          if (message.type === "permissions_state") {
            if (state) state.annotate = Boolean(message.permissions?.annotate);
          } else if (message.type === "permission_update" && message.permission === "annotate") {
            if (state) state.annotate = Boolean(message.granted);
          }

          // Once LiveKit is active, live packets arrive through DataReceived.
          // Other classroom messages remain on the original WebSocket.
          if (message.type !== "whiteboard_live") handler.call(this, event);
        });
      },
    });
  }

  WebSocket.prototype.send = function (data) {
    const isClassroom = typeof this.url === "string" && this.url.includes("/ws/classroom/");
    if (!isClassroom || typeof data !== "string") return nativeSend.call(this, data);

    let message;
    try {
      message = JSON.parse(data);
    } catch {
      return nativeSend.call(this, data);
    }

    if (message.type !== "whiteboard_live") return nativeSend.call(this, data);

    const state = socketState.get(this);
    const room = window.__dexmyClassroomLiveKitRoom;
    const localParticipant = room?.localParticipant;
    const canPublishData = localParticipant?.permissions?.canPublishData;

    if (!state?.annotate || !room || room.state !== "connected" || canPublishData === false) {
      return nativeSend.call(this, data);
    }

    try {
      const publish = localParticipant.publishData(encoder.encode(data), {
        reliable: false,
        topic: WHITEBOARD_TOPIC,
      });
      publish.catch(() => {
        try {
          if (this.readyState === WebSocket.OPEN) nativeSend.call(this, data);
        } catch {}
      });
      return;
    } catch {
      return nativeSend.call(this, data);
    }
  };
}

// Keep the existing camera-preview fix intact.
if (!Room.prototype.__dexmyMediaFixHooked) {
  Room.prototype.__dexmyMediaFixHooked = true;

  const originalConnect = Room.prototype.connect;

  Room.prototype.connect = async function (...args) {
    const result = await originalConnect.apply(this, args);
    const room = this;
    window.__dexmyClassroomLiveKitRoom = room;

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
      if (box.querySelector("video")) return;

      const element = cameraTrack.attach();
      element.autoplay = true;
      element.playsInline = true;
      element.muted = true;
      element.className = "absolute inset-0 w-full h-full object-contain bg-black";
      box.appendChild(element);
    };

    room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      if (topic !== WHITEBOARD_TOPIC || !participant) return;
      const data = decoder.decode(payload);
      for (const socket of classroomSockets) {
        const state = socketState.get(socket);
        const handler = state?.handler;
        if (handler && socket.readyState === WebSocket.OPEN) {
          try {
            handler.call(socket, new MessageEvent("message", { data }));
          } catch {}
        }
      }
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.source === Track.Source.Camera && publication.track) {
        cameraTrack = publication.track;
        cameraTargetId = findVideoTarget();
        if (!cameraTargetId) {
          setTimeout(() => {
            cameraTargetId = findVideoTarget();
            restoreCamera();
          }, 0);
        }
        return;
      }

      if (publication.source === Track.Source.Microphone) setTimeout(restoreCamera, 0);
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
      if (window.__dexmyClassroomLiveKitRoom === room) window.__dexmyClassroomLiveKitRoom = null;
      for (const socket of classroomSockets) socketState.delete(socket);
    });

    return result;
  };
}
