import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ClassroomPro from "../pages/ClassroomPro";

const W = 1600;
const H = 900;
const INTERVAL = 16;

function drawPreview(ctx, stroke) {
  if (!stroke?.points?.length) return;
  const a = stroke.points[0];
  const b = stroke.points[stroke.points.length - 1];
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;
  if (["pen", "highlighter", "eraser"].includes(stroke.tool)) {
    ctx.beginPath();
    stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();
  } else if (stroke.tool === "line") {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (stroke.tool === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const head = 16 + stroke.width * 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  } else if (stroke.tool === "rect") {
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (stroke.tool === "circle") {
    ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export default function ClassroomLiveAnnotation() {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const overlayRef = useRef(null);
  const liveWsRef = useRef(null);
  const currentRef = useRef(null);
  const lastSentRef = useRef(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !user) return;
    const token = localStorage.getItem("dexmy_token");
    const base = import.meta.env.VITE_API_BASE_URL;
    if (!base || !token) return;
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${u.origin}/ws/classroom/${sessionId}?token=${encodeURIComponent(token)}`);
    liveWsRef.current = ws;

    const findCanvas = () => {
      const canvas = document.querySelector('canvas.absolute.inset-0');
      if (!canvas || canvasRef.current === canvas) return canvasRef.current;
      canvasRef.current = canvas;
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = W;
        overlay.height = H;
      }
      return canvas;
    };

    const point = (event, canvas) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(W, (event.clientX - r.left) * W / r.width)),
        y: Math.max(0, Math.min(H, (event.clientY - r.top) * H / r.height)),
      };
    };

    const sendLive = (stroke, final = false) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const now = performance.now();
      if (!final && now - lastSentRef.current < INTERVAL) return;
      lastSentRef.current = now;
      ws.send(JSON.stringify({ type: "whiteboard_live", payload: { stroke, page_number: 1, final } }));
    };

    const onDown = (event) => {
      if (user.role !== "teacher") return;
      const canvas = findCanvas();
      if (!canvas) return;
      const tool = document.querySelector('button.bg-red-600')?.textContent?.toLowerCase() || "pen";
      const color = document.querySelector('input[aria-label="Pen color"]')?.value || "#111827";
      const width = Number(document.querySelector('input[aria-label="Pen size"]')?.value || 3);
      if (["select", "text", "sticky"].some((x) => tool.includes(x))) return;
      currentRef.current = { id: crypto.randomUUID(), tool: tool.includes("highlight") ? "highlighter" : tool.includes("rectangle") ? "rect" : tool, color, width, points: [point(event, canvas)] };
      const ctx = overlayRef.current?.getContext("2d");
      if (ctx) drawPreview(ctx, currentRef.current);
      sendLive(currentRef.current);
    };

    const onMove = (event) => {
      const stroke = currentRef.current;
      const canvas = canvasRef.current || findCanvas();
      if (!stroke || !canvas) return;
      stroke.points.push(point(event, canvas));
      const ctx = overlayRef.current?.getContext("2d");
      if (ctx) drawPreview(ctx, stroke);
      sendLive({ ...stroke, points: stroke.points.slice(-48) });
    };

    const onUp = () => {
      const stroke = currentRef.current;
      if (!stroke) return;
      sendLive(stroke, true);
      currentRef.current = null;
      const ctx = overlayRef.current?.getContext("2d");
      ctx?.clearRect(0, 0, W, H);
    };

    const bind = () => {
      const canvas = findCanvas();
      if (!canvas || canvas.dataset.liveAnnotationBound === "1") return;
      canvas.dataset.liveAnnotationBound = "1";
      canvas.addEventListener("pointerdown", onDown, true);
      canvas.addEventListener("pointermove", onMove, true);
      canvas.addEventListener("pointerup", onUp, true);
      canvas.addEventListener("pointercancel", onUp, true);
      return () => {
        canvas.removeEventListener("pointerdown", onDown, true);
        canvas.removeEventListener("pointermove", onMove, true);
        canvas.removeEventListener("pointerup", onUp, true);
        canvas.removeEventListener("pointercancel", onUp, true);
        delete canvas.dataset.liveAnnotationBound;
      };
    };

    let cleanup = bind();
    const observer = new MutationObserver(() => { if (!cleanup) cleanup = bind(); });
    observer.observe(document.body, { childList: true, subtree: true });

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== "whiteboard_live" || user.role === "teacher") return;
        const p = msg.payload || {};
        const overlay = overlayRef.current;
        if (!overlay || p.page_number !== 1) return;
        const ctx = overlay.getContext("2d");
        if (p.final) {
          ctx.clearRect(0, 0, W, H);
          return;
        }
        drawPreview(ctx, p.stroke);
      } catch { /* Ignore malformed live packets; authoritative events remain intact. */ }
    };

    return () => {
      observer.disconnect();
      cleanup?.();
      ws.close();
      liveWsRef.current = null;
      overlayRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
    };
  }, [sessionId, user]);

  return (
    <div className="relative h-full w-full">
      <ClassroomPro />
      <canvas
        ref={overlayRef}
        width={W}
        height={H}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full z-30"
      />
    </div>
  );
}
