import { Room, RoomEvent } from "livekit-client";

const TOPIC = "dexmy-whiteboard-stroke-v3";
const W = 1600;
const H = 900;

let activeRoom = null;
let overlay = null;
let outgoing = null;
let installed = false;
const incoming = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function canvas() {
  return document.querySelector('canvas[width="1600"][height="900"]');
}

function ensureOverlay() {
  const source = canvas();
  if (!source?.parentElement) return null;
  if (overlay?.isConnected) return overlay;
  const parent = source.parentElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  overlay = document.createElement("canvas");
  overlay.width = W;
  overlay.height = H;
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "20",
  });
  parent.appendChild(overlay);
  return overlay;
}

function point(event, target) {
  const r = target.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(W, ((event.clientX - r.left) * W) / r.width)),
    y: Math.max(0, Math.min(H, ((event.clientY - r.top) * H) / r.height)),
  };
}

function tool() {
  const active = [...document.querySelectorAll("button")].find((b) => {
    const t = b.textContent?.trim().toLowerCase();
    return ["pen", "highlight", "line", "arrow", "rectangle", "circle", "eraser"].includes(t) && /bg-red-600/.test(b.className || "");
  });
  const t = active?.textContent?.trim().toLowerCase();
  return t === "highlight" ? "highlighter" : t;
}

function color() {
  return document.querySelector('input[type="color"]')?.value || "#111827";
}

function width() {
  return Number(document.querySelector('input[type="range"][min="1"][max="18"]')?.value || 3);
}

function page() {
  const match = [...document.querySelectorAll("*")].map((el) => el.textContent?.trim()).find((text) => /^Slide\s+\d+\s*\/\s*\d+$/i.test(text || ""))?.match(/^Slide\s+(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function send(message) {
  if (!activeRoom?.localParticipant || activeRoom.state !== "connected") return;
  activeRoom.localParticipant.publishData(encoder.encode(JSON.stringify(message)), {
    reliable: true,
    topic: TOPIC,
  }).catch(() => {});
}

function drawSegment(ctx, stroke, a, b) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#fff" : stroke.color;
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;
  if (["pen", "highlighter", "eraser"].includes(stroke.tool)) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  } else if (stroke.tool === "line" || stroke.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (stroke.tool === "arrow") {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const head = 16 + stroke.width * 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  } else if (stroke.tool === "rect") {
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (stroke.tool === "circle") {
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderIncoming(message) {
  const target = ensureOverlay();
  const ctx = target?.getContext("2d");
  if (!ctx) return;
  if (message.page !== page()) return;
  let stroke = incoming.get(message.id);
  if (!stroke) {
    stroke = { tool: message.tool, color: message.color, width: message.width, lastSeq: -1, lastPoint: null };
    incoming.set(message.id, stroke);
  }
  if (message.seq <= stroke.lastSeq) return;
  stroke.lastSeq = message.seq;
  for (const p of message.points || []) {
    if (stroke.lastPoint) drawSegment(ctx, stroke, stroke.lastPoint, p);
    else drawSegment(ctx, stroke, p, { x: p.x + 0.01, y: p.y + 0.01 });
    stroke.lastPoint = p;
  }
  if (message.final) incoming.delete(message.id);
}

function installRoomHook() {
  if (Room.prototype.__dexmyLiveAnnotationV3) return;
  Room.prototype.__dexmyLiveAnnotationV3 = true;
  const originalConnect = Room.prototype.connect;
  Room.prototype.connect = async function (...args) {
    const result = await originalConnect.apply(this, args);
    activeRoom = this;
    this.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      if (!participant || participant.identity === this.localParticipant?.identity) return;
      if (topic !== TOPIC) return;
      try {
        const message = JSON.parse(decoder.decode(payload));
        if (message?.v === 3 && message.type === "stroke_segment") renderIncoming(message);
      } catch {}
    });
    this.on(RoomEvent.Disconnected, () => {
      if (activeRoom === this) activeRoom = null;
      incoming.clear();
      overlay?.getContext("2d")?.clearRect(0, 0, W, H);
    });
    return result;
  };
}

function installPointerBridge() {
  if (installed) return;
  installed = true;

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    if (!activeRoom) return;
    const selectedTool = tool();
    if (!selectedTool || selectedTool === "text" || selectedTool === "sticky") return;
    if (event.pointerId != null && typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(event.pointerId)) return;
    const p = point(event, target);
    outgoing = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      page: page(),
      tool: selectedTool,
      color: color(),
      width: width(),
      seq: 0,
      last: p,
    };
    send({ v: 3, type: "stroke_segment", id: outgoing.id, page: outgoing.page, tool: outgoing.tool, color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points: [p], final: false });
  });

  document.addEventListener("pointermove", (event) => {
    if (!outgoing) return;
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    const p = point(event, target);
    if (p.x === outgoing.last.x && p.y === outgoing.last.y) return;
    outgoing.last = p;
    send({ v: 3, type: "stroke_segment", id: outgoing.id, page: outgoing.page, tool: outgoing.tool, color: outgoing.color, width: outgoing.width, seq: outgoing.seq++, points: [p], final: false });
  });

  const finish = (event) => {
    if (!outgoing) return;
    const current = outgoing;
    outgoing = null;
    send({ v: 3, type: "stroke_segment", id: current.id, page: current.page, tool: current.tool, color: current.color, width: current.width, seq: current.seq++, points: [], final: true });
  };
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}

installRoomHook();
installPointerBridge();
