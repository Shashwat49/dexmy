import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ClassroomPro from "../pages/ClassroomPro";

const NativeWebSocket = window.WebSocket;
if (!window.__dexmyClassroomWebSocketPatched) {
  const ClassroomWebSocket = function (url, protocols) {
    const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
    if (String(url).includes("/ws/classroom/")) window.__dexmyClassroomWS = socket;
    return socket;
  };
  ClassroomWebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket = ClassroomWebSocket;
  window.__dexmyClassroomWebSocketPatched = true;
}

const W = 1600;
const H = 900;
const INTERVAL = 16;

function drawPreview(ctx, stroke) {
  if (!stroke?.points?.length) return;
  const a = stroke.points[0]; const b = stroke.points[stroke.points.length - 1];
  if (!ctx.__dexmyLivePreserve) ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color; ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.tool === "highlighter" ? stroke.width * 5 : stroke.width;
  ctx.globalAlpha = stroke.tool === "highlighter" ? 0.24 : 1;
  if (["pen", "highlighter", "eraser"].includes(stroke.tool)) {
    ctx.beginPath(); stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  } else if (stroke.tool === "line") {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (stroke.tool === "arrow") {
    const angle = Math.atan2(b.y - a.y, b.x - a.x); const head = 16 + stroke.width * 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6)); ctx.stroke();
  } else if (stroke.tool === "rect") {
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (stroke.tool === "circle") {
    ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export default function ClassroomLiveAnnotation() {
  const { user } = useAuth(); const { sessionId } = useParams();
  const wrapperRef = useRef(null); const overlayRef = useRef(null); const currentRef = useRef(null);
  const liveStrokesRef = useRef(new Map()); const lastSentRef = useRef(0); const canvasRef = useRef(null);

  useEffect(() => {
    if (!sessionId || !user) return;
    let cancelled = false; let cleanupCanvas = null; let liveSocket = null;
    const positionOverlay = () => {
      const canvas = canvasRef.current; const overlay = overlayRef.current; const wrapper = wrapperRef.current;
      if (!canvas || !overlay || !wrapper) return;
      const cr = canvas.getBoundingClientRect(); const wr = wrapper.getBoundingClientRect();
      overlay.style.left = `${cr.left - wr.left}px`; overlay.style.top = `${cr.top - wr.top}px`;
      overlay.style.width = `${cr.width}px`; overlay.style.height = `${cr.height}px`;
    };
    const findCanvas = () => { const canvas = document.querySelector('canvas.absolute.inset-0'); if (canvas) { canvasRef.current = canvas; positionOverlay(); } return canvas; };
    const getPage = () => {
      const pageText = [...document.querySelectorAll("span")].find((el) => /^Page \d+\/\d+$/.test(el.textContent?.trim() || ""));
      return Number(pageText?.textContent?.match(/Page (\d+)/)?.[1] || 1);
    };
    const point = (event, canvas) => { const r = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(W, (event.clientX - r.left) * W / r.width)), y: Math.max(0, Math.min(H, (event.clientY - r.top) * H / r.height)) }; };
    const sendLive = (stroke, final = false, append = false) => {
      if (!liveSocket || liveSocket.readyState !== NativeWebSocket.OPEN) return;
      const now = performance.now(); if (!final && now - lastSentRef.current < INTERVAL) return;
      lastSentRef.current = now;
      liveSocket.send(JSON.stringify({ type: "whiteboard_live", payload: { stroke, page_number: getPage(), final, append } }));
    };
    const getTool = () => {
      const selected = [...document.querySelectorAll("button")].find((b) => b.className.includes("bg-red-600"));
      const label = selected?.textContent?.trim().toLowerCase() || "pen";
      if (label.includes("highlight")) return "highlighter"; if (label.includes("rectangle")) return "rect"; return label;
    };
    const onDown = (event) => {
      if (user.role !== "teacher") return; const canvas = findCanvas(); if (!canvas) return;
      const tool = getTool(); if (["select", "text", "sticky"].some((x) => tool.includes(x))) return;
      const color = document.querySelector('input[aria-label="Pen color"]')?.value || "#111827";
      const width = Number(document.querySelector('input[aria-label="Pen size"]')?.value || 3);
      currentRef.current = { id: crypto.randomUUID(), tool, color, width, points: [point(event, canvas)] };
      drawPreview(overlayRef.current.getContext("2d"), currentRef.current); sendLive(currentRef.current);
    };
    const onMove = (event) => {
      const stroke = currentRef.current; const canvas = canvasRef.current || findCanvas(); if (!stroke || !canvas) return;
      const nextPoint = point(event, canvas); stroke.points.push(nextPoint);
      drawPreview(overlayRef.current.getContext("2d"), stroke); sendLive({ ...stroke, points: [nextPoint] }, false, true);
    };
    const onUp = () => {
      const stroke = currentRef.current; if (!stroke) return; sendLive(stroke, true, false); currentRef.current = null;
      overlayRef.current?.getContext("2d")?.clearRect(0, 0, W, H);
    };
    const bind = () => {
      const canvas = findCanvas(); if (!canvas || canvas.dataset.liveAnnotationBound === "1") return null;
      canvas.dataset.liveAnnotationBound = "1";
      canvas.addEventListener("pointerdown", onDown, true); canvas.addEventListener("pointermove", onMove, true);
      canvas.addEventListener("pointerup", onUp, true); canvas.addEventListener("pointercancel", onUp, true);
      return () => { canvas.removeEventListener("pointerdown", onDown, true); canvas.removeEventListener("pointermove", onMove, true); canvas.removeEventListener("pointerup", onUp, true); canvas.removeEventListener("pointercancel", onUp, true); delete canvas.dataset.liveAnnotationBound; };
    };
    const attach = () => {
      if (cancelled) return;
      if (!liveSocket || liveSocket.readyState === NativeWebSocket.CLOSED) liveSocket = window.__dexmyClassroomWS;
      if (!cleanupCanvas) cleanupCanvas = bind(); positionOverlay();
      if (liveSocket && !liveSocket.__dexmyLiveListener) {
        liveSocket.__dexmyLiveListener = true;
        liveSocket.addEventListener("message", (event) => {
          if (user.role === "teacher") return;
          try {
            const msg = JSON.parse(event.data); if (msg.type !== "whiteboard_live") return;
            const p = msg.payload || {}; if (p.page_number !== getPage()) return;
            const ctx = overlayRef.current?.getContext("2d"); if (!ctx || !p.stroke?.id) return;
            ctx.__dexmyLivePreserve = true;
            if (p.final) {
              liveStrokesRef.current.delete(p.stroke.id); ctx.clearRect(0, 0, W, H);
              liveStrokesRef.current.forEach((item) => drawPreview(ctx, item));
            } else {
              const prior = liveStrokesRef.current.get(p.stroke.id);
              const stroke = prior ? { ...prior, points: [...prior.points, ...(p.stroke.points || [])] } : { ...p.stroke, points: p.stroke.points || [] };
              liveStrokesRef.current.set(p.stroke.id, stroke);
              ctx.clearRect(0, 0, W, H); liveStrokesRef.current.forEach((item) => drawPreview(ctx, item));
            }
            ctx.__dexmyLivePreserve = false;
          } catch { /* malformed live packets are ignored */ }
        });
      }
    };
    attach(); const interval = setInterval(attach, 50);
    const observer = new MutationObserver(() => { if (!cleanupCanvas) cleanupCanvas = bind(); positionOverlay(); });
    observer.observe(document.body, { childList: true, subtree: true }); window.addEventListener("resize", positionOverlay);
    return () => { cancelled = true; clearInterval(interval); observer.disconnect(); cleanupCanvas?.(); window.removeEventListener("resize", positionOverlay); if (liveSocket) liveSocket.__dexmyLiveListener = false; liveStrokesRef.current.clear(); overlayRef.current?.getContext("2d")?.clearRect(0, 0, W, H); };
  }, [sessionId, user]);

  return <div ref={wrapperRef} className="relative h-full w-full"><ClassroomPro /><canvas ref={overlayRef} width={W} height={H} aria-hidden="true" className="pointer-events-none absolute z-30" /></div>;
}
