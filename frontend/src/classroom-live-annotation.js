import { Room, RoomEvent } from "livekit-client";

const TOPIC = "dexmy-whiteboard-live-v1";
const W = 1600;
const H = 900;
const LIVE_TOOLS = new Set(["pen", "highlighter", "line", "arrow", "rect", "circle", "eraser"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let activeRoom = null;
let outgoing = null;
let outgoingRaf = 0;
const incoming = new Map();
let incomingRaf = 0;
let overlay = null;

const canvas = () => document.querySelector('canvas[width="1600"][height="900"]');

function ensureOverlay() {
  const source = canvas();
  if (!source?.parentElement) return null;
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement("canvas");
  overlay.width = W;
  overlay.height = H;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "6";
  source.parentElement.appendChild(overlay);
  return overlay;
}

function currentTool() {
  const buttons = [...document.querySelectorAll("button")];
  const selected = buttons.find((button) => {
    const text = button.textContent?.trim().toLowerCase();
    return LIVE_TOOLS.has(text) && button.className?.includes("bg-red-600");
  });
  return selected?.textContent?.trim().toLowerCase() || null;
}

function currentColor() {
  return document.querySelector('input[type="color"]')?.value || "#111827";
}

function currentWidth() {
  return Number(document.querySelector('input[type="range"][min="1"][max="18"]')?.value || 3);
}

function currentPage() {
  const node = [...document.querySelectorAll("span")].find((el) => /^Slide\s+\d+\/\d+$/i.test(el.textContent?.trim() || ""));
  const match = node?.textContent?.trim().match(/^Slide\s+(\d+)\//i);
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
  activeRoom.localParticipant.publishData(payload, { reliable: false, topic: TOPIC }).catch(() => {});
}

function flushOutgoing() {
  outgoingRaf = 0;
  if (!outgoing || !outgoing.points.length) return;
  const points = outgoing.points.splice(0, 10);
  publish({
    v: 1, type: "stroke", id: outgoing.id, page: outgoing.page, tool: outgoing.tool,
    color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points, final: false,
  });
  if (outgoing.points.length) scheduleOutgoing();
}

function scheduleOutgoing() {
  if (!outgoingRaf) outgoingRaf = requestAnimationFrame(flushOutgoing);
}

function drawLiveStroke(ctx, stroke) {
  const points = stroke.points;
  if (!points?.length) return;
  const a = points[0];
  const b = points[points.length - 1];
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;

  if (stroke.tool === "line") {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (stroke.tool === "rect") {
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (stroke.tool === "circle") {
    ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke();
  } else if (stroke.tool === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = 16 + stroke.width * 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (["pen", "highlighter", "eraser"].includes(stroke.tool)) {
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y + 0.01);
    ctx.stroke();
  }
  ctx.restore();
}

function renderIncoming() {
  incomingRaf = 0;
  const target = ensureOverlay();
  const ctx = target?.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const page = currentPage();
  for (const [id, stroke] of incoming) {
    if (stroke.page !== page) continue;
    drawLiveStroke(ctx, stroke);
    if (stroke.done) incoming.delete(id);
  }
  if (incoming.size) incomingRaf = requestAnimationFrame(renderIncoming);
}

function scheduleIncoming() {
  if (!incomingRaf) incomingRaf = requestAnimationFrame(renderIncoming);
}

function handleData(payload, topic) {
  if (topic !== TOPIC) return;
  let message;
  try { message = JSON.parse(decoder.decode(payload)); } catch { return; }
  if (message?.v !== 1 || message.type !== "stroke" || !message.id) return;
  if (message.page !== currentPage()) return;

  let stroke = incoming.get(message.id);
  if (!stroke) {
    stroke = {
      id: message.id, page: message.page, tool: message.tool, color: message.color,
      width: message.width, points: [], lastSeq: -1, done: false,
    };
    incoming.set(message.id, stroke);
  }
  if (typeof message.seq === "number" && message.seq <= stroke.lastSeq) return;
  if (typeof message.seq === "number") stroke.lastSeq = message.seq;
  if (Array.isArray(message.points)) stroke.points.push(...message.points);
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
      if (overlay?.isConnected) overlay.getContext("2d")?.clearRect(0, 0, W, H);
    });
    return result;
  };
}

function installWebSocketFilter() {
  const NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket || NativeWebSocket.__dexmyWhiteboardFilter) return;
  const descriptor = Object.getOwnPropertyDescriptor(NativeWebSocket.prototype, "onmessage");
  if (!descriptor?.get || !descriptor?.set) return;

  class ClassroomWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      const url = String(args[0] || "");
      if (!url.includes("/ws/classroom/")) return;
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
              // Keep normal WebSocket behavior for non-JSON payloads.
            }
            next(event);
          } : next;
          descriptor.set.call(this, handler);
        },
      });
    }
  }
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    Object.defineProperty(ClassroomWebSocket, key, { value: NativeWebSocket[key] });
  }
  ClassroomWebSocket.__dexmyWhiteboardFilter = true;
  window.WebSocket = ClassroomWebSocket;
}

function installPointerCapture() {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    const tool = currentTool();
    if (!tool || !activeRoom) return;
    const point = pointFromEvent(event, target);
    outgoing = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      page: currentPage(), tool, color: currentColor(), width: currentWidth(), seq: 0, points: [point],
    };
    publish({
      v: 1, type: "stroke", id: outgoing.id, page: outgoing.page, tool: outgoing.tool,
      color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points: [point], final: false,
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
    if (target?.width === W && target.height === H) outgoing.points.push(pointFromEvent(event, target));
    if (outgoingRaf) { cancelAnimationFrame(outgoingRaf); outgoingRaf = 0; }
    while (outgoing.points.length > 10) {
      const points = outgoing.points.splice(0, 10);
      publish({
        v: 1, type: "stroke", id: outgoing.id, page: outgoing.page, tool: outgoing.tool,
        color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points, final: false,
      });
    }
    publish({
      v: 1, type: "stroke", id: outgoing.id, page: outgoing.page, tool: outgoing.tool,
      color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points: outgoing.points.splice(0, 10), final: true,
    });
    outgoing = null;
  };

  document.addEventListener("pointerup", finish, true);
  document.addEventListener("pointercancel", finish, true);
}

installRoomHook();
installWebSocketFilter();
installPointerCapture();
