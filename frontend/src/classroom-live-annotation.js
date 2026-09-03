import { Room, RoomEvent } from "livekit-client";

const TOPIC = "dexmy-whiteboard-stroke-v3";
const W = 1600;
const H = 900;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let activeRoom = null;
let outgoing = null;
let overlay = null;
const incoming = new Map();

const getCanvas = () => document.querySelector('canvas[width="1600"][height="900"]');

function ensureOverlay() {
  const source = getCanvas();
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
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "20"
  });
  parent.appendChild(overlay);
  return overlay;
}

function currentTool() {
  const labels = {
    pen: "pen",
    highlighter: "highlight",
    line: "line",
    arrow: "arrow",
    rect: "rectangle",
    circle: "circle",
    eraser: "eraser"
  };
  const selected = [...document.querySelectorAll("button")].find((button) => {
    const text = button.textContent?.trim().toLowerCase();
    return Object.values(labels).includes(text) && button.className?.includes("bg-red-600");
  });
  if (!selected) return null;
  const label = selected.textContent?.trim().toLowerCase();
  return Object.entries(labels).find(([, value]) => value === label)?.[0] || null;
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
    y: Math.max(0, Math.min(H, ((event.clientY - rect.top) * H) / rect.height))
  };
}

function publish(message) {
  if (!activeRoom?.localParticipant || activeRoom.state !== "connected") return;
  activeRoom.localParticipant
    .publishData(encoder.encode(JSON.stringify(message)), { reliable: true, topic: TOPIC })
    .catch(() => {});
}

function drawSegment(ctx, stroke, points) {
  if (!points?.length) return;
  const tool = stroke.tool;
  const color = tool === "eraser" ? "#fff" : stroke.color;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = tool === "highlighter" ? 0.24 : 1;

  if (["pen", "highlighter", "eraser"].includes(tool)) {
    ctx.beginPath();
    if (points.length === 1) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  } else if (points.length >= 2) {
    const a = points[0];
    const b = points[points.length - 1];
    if (tool === "line") {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (tool === "rect") {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (tool === "circle") {
      ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke();
    } else if (tool === "arrow") {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const head = 16 + stroke.width * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function renderIncomingStroke(stroke) {
  const target = ensureOverlay();
  const ctx = target?.getContext("2d");
  if (!ctx || stroke.page !== currentPage()) return;
  drawSegment(ctx, stroke, stroke.points);
  stroke.points.length = 0;
}

function handleData(payload, topic, participant) {
  if (topic !== TOPIC || !participant) return;
  let message;
  try { message = JSON.parse(decoder.decode(payload)); } catch { return; }
  if (message?.v !== 3 || message.type !== "stroke" || !message.id || message.page !== currentPage()) return;

  let stroke = incoming.get(message.id);
  if (!stroke) {
    stroke = {
      id: message.id,
      page: message.page,
      tool: message.tool,
      color: message.color,
      width: message.width,
      lastSeq: -1,
      points: []
    };
    incoming.set(message.id, stroke);
  }

  if (typeof message.seq === "number" && message.seq <= stroke.lastSeq) return;
  if (typeof message.seq === "number") stroke.lastSeq = message.seq;
  if (Array.isArray(message.points)) stroke.points.push(...message.points);
  renderIncomingStroke(stroke);
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
      if (participant?.identity === this.localParticipant.identity) return;
      handleData(payload, topic, participant);
    });
    this.on(RoomEvent.Disconnected, () => {
      if (activeRoom === this) activeRoom = null;
      outgoing = null;
      incoming.clear();
      if (overlay) overlay.getContext("2d")?.clearRect(0, 0, W, H);
    });
    return result;
  };
}

function installLegacyLiveFilter() {
  const NativeWebSocket = window.WebSocket;
  if (!NativeWebSocket || NativeWebSocket.__dexmyWhiteboardV3Filter) return;
  class ClassroomWebSocket extends NativeWebSocket {
    constructor(...args) {
      super(...args);
      const url = String(args[0] || "");
      if (!url.includes("/ws/classroom/")) return;
      const nativeSend = this.send.bind(this);
      this.send = (data) => {
        try {
          const message = typeof data === "string" ? JSON.parse(data) : null;
          if (message?.type === "whiteboard_live") return;
        } catch {}
        return nativeSend(data);
      };
    }
  }
  for (const key of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) {
    Object.defineProperty(ClassroomWebSocket, key, { value: NativeWebSocket[key] });
  }
  ClassroomWebSocket.__dexmyWhiteboardV3Filter = true;
  window.WebSocket = ClassroomWebSocket;
}

function installPointerPublisher() {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    const tool = currentTool();
    if (!tool || !activeRoom) return;
    if (event.pointerId != null && typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(event.pointerId)) return;

    outgoing = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      page: currentPage(),
      tool,
      color: currentColor(),
      width: currentWidth(),
      seq: 0,
      lastPoint: pointFromEvent(event, target)
    };

    publish({
      v: 3,
      type: "stroke",
      id: outgoing.id,
      page: outgoing.page,
      tool: outgoing.tool,
      color: outgoing.color,
      width: outgoing.width,
      seq: outgoing.seq++,
      points: [outgoing.lastPoint],
      final: false
    });
  });

  document.addEventListener("pointermove", (event) => {
    if (!outgoing) return;
    const target = event.target;
    if (!(target instanceof HTMLCanvasElement) || target.width !== W || target.height !== H) return;
    const point = pointFromEvent(event, target);
    outgoing.lastPoint = point;
    publish({
      v: 3,
      type: "stroke",
      id: outgoing.id,
      page: outgoing.page,
      tool: outgoing.tool,
      color: outgoing.color,
      width: outgoing.width,
      seq: outgoing.seq++,
      points: [point],
      final: false
    });
  });

  const finish = (event) => {
    if (!outgoing) return;
    const target = event.target instanceof HTMLCanvasElement ? event.target : getCanvas();
    if (target?.width === W && target?.height === H) {
      const point = pointFromEvent(event, target);
      publish({
        v: 3,
        type: "stroke",
        id: outgoing.id,
        page: outgoing.page,
        tool: outgoing.tool,
        color: outgoing.color,
        width: outgoing.width,
        seq: outgoing.seq++,
        points: [point],
        final: true
      });
    } else {
      publish({
        v: 3,
        type: "stroke",
        id: outgoing.id,
        page: outgoing.page,
        tool: outgoing.tool,
        color: outgoing.color,
        width: outgoing.width,
        seq: outgoing.seq++,
        points: [],
        final: true
      });
    }
    outgoing = null;
  };

  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}

installRoomHook();
installLegacyLiveFilter();
installPointerPublisher();
