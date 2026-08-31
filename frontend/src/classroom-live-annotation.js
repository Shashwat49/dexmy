import { Room, RoomEvent } from "livekit-client";

const TOPIC = "dexmy-whiteboard-live-v1";
const W = 1600;
const H = 900;
const LIVE_TOOLS = new Set(["pen", "highlighter", "eraser"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let activeRoom = null;
let outgoing = null;
let outgoingRaf = 0;
const incoming = new Map();
let incomingRaf = 0;

const canvas = () => document.querySelector('canvas[width="1600"][height="900"]');

function currentTool() {
  const buttons = [...document.querySelectorAll("button")];
  const selected = buttons.find((button) => {
    const text = button.textContent?.trim().toLowerCase();
    return LIVE_TOOLS.has(text) && button.className?.includes("bg-red-600");
  });
  return selected?.textContent?.trim().toLowerCase() || null;
}

function currentPage() {
  const node = [...document.querySelectorAll("span")].find((el) => /^Slide\\s+\\d+\\/\\d+$/i.test(el.textContent?.trim() || ""));
  const match = node?.textContent?.trim().match(/^Slide\\s+(\\d+)\\//i);
  return match ? Number(match[1]) : 1;
}

function pointFromEvent(event, target) {
  const rect = target.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((event.clientX - rect.left) * W) / rect.width)),
    y: Math.max(0, Math.min(H, ((event.clientY - rect.top) * H) / rect.height)),
  };
}

function publish(message) {
  if (!activeRoom?.localParticipant || activeRoom.state !== "connected") return;
  const payload = encoder.encode(JSON.stringify(message));
  if (payload.byteLength > 1200) return;
  activeRoom.localParticipant.publishData(payload, {
    reliable: false,
    topic: TOPIC,
  }).catch(() => {});
}

function flushOutgoing() {
  outgoingRaf = 0;
  if (!outgoing || !outgoing.points.length) return;
  const points = outgoing.points.splice(0, 12);
  publish({
    v: 1,
    type: "stroke",
    id: outgoing.id,
    page: outgoing.page,
    tool: outgoing.tool,
    color: outgoing.color,
    width: outgoing.width,
    seq: outgoing.seq++,
    points,
    final: false,
  });
  if (outgoing.points.length) scheduleOutgoing();
}

function scheduleOutgoing() {
  if (!outgoingRaf) outgoingRaf = requestAnimationFrame(flushOutgoing);
}

function drawSegment(stroke, points) {
  const ctx = canvas()?.getContext("2d");
  if (!ctx || !points?.length || !LIVE_TOOLS.has(stroke.tool)) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;
  ctx.beginPath();
  if (stroke.last) ctx.moveTo(stroke.last.x, stroke.last.y);
  points.forEach((p, i) => {
    if (i === 0 && !stroke.last) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
  ctx.stroke();
  ctx.restore();
  stroke.last = points[points.length - 1];
}

function renderIncoming() {
  incomingRaf = 0;
  const page = currentPage();
  for (const [id, stroke] of incoming) {
    if (stroke.page !== page) continue;
    const points = stroke.queue.splice(0, 24);
    if (points.length) drawSegment(stroke, points);
    if (stroke.done && !stroke.queue.length) incoming.delete(id);
  }
  if (incoming.size) incomingRaf = requestAnimationFrame(renderIncoming);
}

function scheduleIncoming() {
  if (!incomingRaf) incomingRaf = requestAnimationFrame(renderIncoming);
}

function handleData(payload, topic) {
  if (topic !== TOPIC) return;
  let message;
  try {
    message = JSON.parse(decoder.decode(payload));
  } catch {
    return;
  }
  if (message?.v !== 1 || message.type !== "stroke" || !message.id) return;
  if (message.page !== currentPage()) return;

  let stroke = incoming.get(message.id);
  if (!stroke) {
    stroke = {
      id: message.id,
      page: message.page,
      tool: message.tool,
      color: message.color,
      width: message.width,
      last: null,
      queue: [],
      lastSeq: -1,
      done: false,
    };
    incoming.set(message.id, stroke);
  }

  if (typeof message.seq === "number" && message.seq <= stroke.lastSeq) return;
  if (typeof message.seq === "number") stroke.lastSeq = message.seq;
  if (Array.isArray(message.points)) stroke.queue.push(...message.points);
  if (message.final) stroke.done = true;
  scheduleIncoming();
}

function installRoomHook() {
  if (Room.prototype.__dexmyLiveAnnotationHooked) return;
  Room.prototype.__dexmyLiveAnnotationHooked = true;
  const originalConnect = Room.prototype.connect;
  Room.prototype.connect = async function (...args) {
    const result = await originalConnect.apply(this, args);
    activeRoom = this;
    this.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      if (participant?.identity === this.localParticipant.identity) return;
      handleData(payload, topic);
    });
    this.on(RoomEvent.Disconnected, () => {
      if (activeRoom === this) activeRoom = null;
      incoming.clear();
      outgoing = null;
    });
    return result;
  };
}

function installWebSocketFilter() {
  const NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket || NativeWebSocket.__dexmyWhiteboardFilter) return;

  class ClassroomWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      const url = String(args[0] || "");
      if (!url.includes("/ws/classroom/")) return;
      const descriptor = Object.getOwnPropertyDescriptor(NativeWebSocket.prototype, "onmessage");
      if (!descriptor?.get || !descriptor?.set) return;
      let handler = null;
      Object.defineProperty(this, "onmessage", {
        configurable: true,
        enumerable: true,
        get: () => handler,
        set: (next) => {
          handler = typeof next === "function" ? (event) => {
            try {
              const message = JSON.parse(event.data);
              if (message?.type === "whiteboard_live") return;
            } catch {
              // Preserve normal WebSocket behavior for non-JSON messages.
            }
            next(event);
          } : next;
          descriptor.set.call(this, handler);
        },
      });
    }
  }

  Object.defineProperty(ClassroomWebSocket, "CONNECTING", { value: NativeWebSocket.CONNECTING });
  Object.defineProperty(ClassroomWebSocket, "OPEN", { value: NativeWebSocket.OPEN });
  Object.defineProperty(ClassroomWebSocket, "CLOSING", { value: NativeWebSocket.CLOSING });
  Object.defineProperty(ClassroomWebSocket, "CLOSED", { value: NativeWebSocket.CLOSED });
  ClassroomWebSocket.__dexmyWhiteboardFilter = true;
  window.WebSocket = ClassroomWebSocket;
}

function installPointerCapture() {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    const tool = currentTool();
    if (!LIVE_TOOLS.has(tool) || !activeRoom) return;
    const point = pointFromEvent(event, target);
    outgoing = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      page: currentPage(),
      tool,
      color: "#111827",
      width: 3,
      seq: 0,
      points: [point],
    };
    publish({
      v: 1,
      type: "stroke",
      id: outgoing.id,
      page: outgoing.page,
      tool: outgoing.tool,
      color: outgoing.color,
      width: outgoing.width,
      seq: outgoing.seq++,
      points: [point],
      final: false,
    });
  }, true);

  document.addEventListener("pointermove", (event) => {
    const target = event.target;
    if (!outgoing || !(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    outgoing.points.push(pointFromEvent(event, target));
    scheduleOutgoing();
  }, true);

  const finish = (event) => {
    if (!outgoing) return;
    const target = event.target instanceof HTMLCanvasElement ? event.target : canvas();
    if (target?.width === W && target?.height === H) outgoing.points.push(pointFromEvent(event, target));
    flushOutgoing();
    publish({
      v: 1,
      type: "stroke",
      id: outgoing.id,
      page: outgoing.page,
      tool: outgoing.tool,
      color: outgoing.color,
      width: outgoing.width,
      seq: outgoing.seq++,
      points: outgoing.points.splice(0, 12),
      final: true,
    });
    outgoing = null;
  };

  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
}

installRoomHook();
installWebSocketFilter();
installPointerCapture();
