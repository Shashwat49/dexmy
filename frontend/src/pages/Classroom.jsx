import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import "./Classroom.css";

const attachMedia = (track, containerId, muted = false) => {
  if (!track) return;
  const box = document.getElementById(containerId);
  if (!box) return;
  const selector = track.kind === Track.Kind.Video ? "video" : "audio";
  const trackSid = track.sid || track.publication?.trackSid || "";
  const existing = Array.from(box.querySelectorAll(selector));
  if (trackSid && existing.some((el) => el.dataset.dexmyTrackSid === trackSid)) return;
  existing.forEach((el) => {
    if (!trackSid || el.dataset.dexmyTrackSid !== trackSid) el.remove();
  });
  const el = track.attach();
  el.autoplay = true;
  el.playsInline = true;
  el.muted = muted;
  if (trackSid) el.dataset.dexmyTrackSid = trackSid;
  if (track.kind === Track.Kind.Video) el.className = "absolute inset-0 w-full h-full object-contain bg-black";
  box.appendChild(el);
  if (track.kind === Track.Kind.Audio && !muted) el.play?.().catch(() => {});
};

const detachMedia = (track) => {
  if (!track) return;
  track.detach().forEach((el) => el.remove());
};

const W = 1600, H = 900;
const LIVE_TOPIC = "dexmy-whiteboard-live";
const COMMIT_TOPIC = "dexmy-whiteboard-commit";
const CONTROL_TOPIC = "dexmy-classroom-control";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOOLS = [["select", "Select"], ["pen", "Pen"], ["highlighter", "Highlight"], ["line", "Line"], ["arrow", "Arrow"], ["rect", "Rectangle"], ["circle", "Circle"], ["text", "Text"], ["eraser", "Eraser"]];
const DRAW_TOOLS = new Set(TOOLS.map(([id]) => id).filter((id) => id !== "select"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const makeWhiteboardPage = (page_number = 1) => ({ page_id: newId(), page_number, page_type: "whiteboard", image_url: null });
const strokeBounds = (stroke) => { const pts = stroke?.points || []; if (!pts.length) return null; const xs = pts.map(p => p.x), ys = pts.map(p => p.y); const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys); if (stroke.tool === "circle") { const radius = Math.hypot((pts[pts.length-1]?.x || 0) - pts[0].x, (pts[pts.length-1]?.y || 0) - pts[0].y); return { minX: pts[0].x-radius, minY: pts[0].y-radius, maxX: pts[0].x+radius, maxY: pts[0].y+radius }; } if (["text","sticky"].includes(stroke.tool)) return { minX, minY: minY-36, maxX: Math.max(maxX, minX + (stroke.tool === "sticky" ? 160 : 80)), maxY: Math.max(maxY, minY + (stroke.tool === "sticky" ? 100 : 12)) }; return { minX, minY, maxX, maxY }; };
const strokeHit = (stroke, p, tolerance = 16) => { const b = strokeBounds(stroke); if (!b || p.x < b.minX-tolerance || p.x > b.maxX+tolerance || p.y < b.minY-tolerance || p.y > b.maxY+tolerance) return false; const pts = stroke.points || []; if (["line","arrow"].includes(stroke.tool) && pts.length > 1) { const a=pts[0], z=pts[pts.length-1], dx=z.x-a.x, dy=z.y-a.y, len=dx*dx+dy*dy, t=len ? clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len,0,1) : 0; return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy)) <= tolerance; } if (["pen","highlighter","eraser"].includes(stroke.tool) && pts.length > 1) return pts.some((q,i) => i===0 ? Math.hypot(p.x-q.x,p.y-q.y)<=tolerance : (()=>{const a=pts[i-1],dx=q.x-a.x,dy=q.y-a.y,len=dx*dx+dy*dy,t=len?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/len,0,1):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))<=tolerance;})()); return true; };
const transformStroke = (stroke, from, to, mode) => { const bounds=strokeBounds(stroke); if(!bounds) return stroke; const next={...stroke,points:stroke.points.map(p=> mode==="move" ? ({x:p.x+to.x-from.x,y:p.y+to.y-from.y}) : ({x:bounds.minX===bounds.maxX?to.x:bounds.minX+(p.x-bounds.minX)*(to.x-bounds.minX)/(bounds.maxX-bounds.minX),y:bounds.minY===bounds.maxY?to.y:bounds.minY+(p.y-bounds.minY)*(to.y-bounds.minY)/(bounds.maxY-bounds.minY)}))}; return next; };

const normalizePages = (pages) => (pages?.length ? pages : [makeWhiteboardPage(1)]).map((p,i) => ({ ...p, page_id: p.page_id || newId(), page_number: i+1, page_type: p.page_type || (p.image_url ? "pdf" : "whiteboard") }));

function PageThumbnail({ page, strokes, number, active, canSelect, canDelete, onSelect, onDelete, version }) {
  const canvasRef = useRef(null);
  const [imageSize, setImageSize] = useState(null);
  useEffect(() => {
    if (!page.image_url) { setImageSize(null); return; }
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) setImageSize({ width: image.naturalWidth, height: image.naturalHeight }); };
    image.src = page.image_url;
    return () => { cancelled = true; };
  }, [page.image_url]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    if (!page.image_url) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
    }
    let cancelled = false;
    const drawStrokes = () => {
      if (cancelled) return;
      const fitScale = imageSize?.width && imageSize?.height ? Math.min(width / imageSize.width, height / imageSize.height) : Math.min(width / W, height / H);
      const contentWidth = imageSize?.width ? imageSize.width * fitScale : width;
      const contentHeight = imageSize?.height ? imageSize.height * fitScale : height;
      const contentX = (width - contentWidth) / 2, contentY = (height - contentHeight) / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(contentX, contentY, contentWidth, contentHeight); ctx.clip();
      ctx.translate(contentX, contentY);
      ctx.scale(contentWidth / W, contentHeight / H);
      (strokes || []).forEach((stroke) => {
        const points = stroke.points || [];
        if (!points.length) return;
        const first = points[0], last = points[points.length - 1];
        ctx.save();
        ctx.strokeStyle = stroke.tool === "eraser" ? "#fff" : (stroke.color || "#111827");
        ctx.fillStyle = stroke.color || "#111827";
        ctx.lineWidth = Math.max(2, (stroke.width || 3) * (stroke.tool === "highlighter" ? 4 : 1));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (["pen", "highlighter", "eraser"].includes(stroke.tool)) {
          ctx.beginPath();
          points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
          ctx.stroke();
        } else if (["line", "arrow"].includes(stroke.tool)) {
          ctx.beginPath(); ctx.moveTo(first.x, first.y); ctx.lineTo(last.x, last.y); ctx.stroke();
        } else if (stroke.tool === "rect") {
          ctx.strokeRect(first.x, first.y, last.x - first.x, last.y - first.y);
        } else if (stroke.tool === "circle") {
          ctx.beginPath(); ctx.arc(first.x, first.y, Math.hypot(last.x - first.x, last.y - first.y), 0, Math.PI * 2); ctx.stroke();
        } else if (stroke.tool === "text") {
          ctx.font = "48px sans-serif"; ctx.fillText(stroke.text || "Text", first.x, first.y);
        } else if (stroke.tool === "sticky") {
          ctx.fillStyle = "#fff7a8"; ctx.fillRect(first.x, first.y, Math.max(160, last.x - first.x), Math.max(100, last.y - first.y));
        }
        ctx.restore();
      });
      ctx.restore();
    };
    drawStrokes();
    return () => { cancelled = true; };
  }, [page.image_url, strokes, version, imageSize]);
  return <div className={`relative shrink-0 w-[144px] rounded-lg border overflow-hidden bg-white transition-colors ${active ? "border-red-500 ring-2 ring-red-500/40" : "border-white/15"}`}>
    <button type="button" disabled={!canSelect} onClick={onSelect} title={`Go to page ${number}`} className="relative block w-full aspect-video bg-white disabled:cursor-default">
      {page.image_url && <img src={page.image_url} alt={`Preview of page ${number}`} loading="lazy" draggable="false" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />}
      <canvas ref={canvasRef} width={240} height={135} className="absolute inset-0 block w-full h-full pointer-events-none" />
    </button>
    <span className="absolute right-1 bottom-1 min-w-6 h-6 px-1 rounded-md bg-black/80 text-white text-[11px] font-semibold grid place-items-center">{number}</span>
    {canDelete && <button type="button" title={`Delete page ${number}`} aria-label={`Delete page ${number}`} onClick={(event) => { event.stopPropagation(); onDelete(); }} className="absolute right-1 top-1 w-6 h-6 rounded-md bg-red-600 text-white text-sm font-bold shadow hover:bg-red-500">×</button>}
  </div>;
}

export default function Classroom() {
  const { user } = useAuth(); const { sessionId } = useParams(); const navigate = useNavigate();
  const isTeacher = user?.role === "teacher"; const email = user?.email || "";
  const canvasRef = useRef(null), wsRef = useRef(null), roomRef = useRef(null), drawRef = useRef(null), drawBaseRef = useRef(null);
  const slidesRef = useRef([makeWhiteboardPage(1)]), strokesByPageRef = useRef(new Map()), slideRef = useRef(1);
  const liveRef = useRef(new Map()), committedRef = useRef(new Set()), pendingLiveRef = useRef(null), snapshotTimerRef = useRef(null), disposedRef = useRef(false), imageCacheRef = useRef(new Map()), reliableStrokeTimerRef = useRef(null), slideControlActiveRef = useRef(false);
  const mediaBusyRef = useRef(false);
  const whiteboardStateInitializedRef = useRef(false);
  const selectedStrokeRef = useRef(null), selectInteractionRef = useRef(null), seenWhiteboardActionIdsRef = useRef(new Set());
  const micStateRef = useRef(false);
  const cameraStateRef = useRef(false);
  const gridRef = useRef(false);
  const [status, setStatus] = useState("Connecting…"), [notice, setNotice] = useState(""), [tool, setTool] = useState("pen"), [color, setColor] = useState("#111827"), [width, setWidth] = useState(3), [grid, setGrid] = useState(false);
  const [slides, setSlides] = useState(() => [makeWhiteboardPage(1)]), [slide, setSlide] = useState(1), [chat, setChat] = useState([]), [message, setMessage] = useState("");
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const [textModal, setTextModal] = useState(null), [textDraft, setTextDraft] = useState("");
  const activeBackground = slides[slide - 1]?.image_url || null;
  const [backgroundSize, setBackgroundSize] = useState(null);
  const backgroundSizeRef = useRef(null);
  backgroundSizeRef.current = backgroundSize;
  const [mic, setMic] = useState(false), [camera, setCamera] = useState(false), [screen, setScreen] = useState(false), [studentId, setStudentId] = useState(null), [peerName, setPeerName] = useState("");
  const [permissions, setPermissions] = useState({ mic: true, camera: true, annotate: false, screen_share: false }), [pdfLoading, setPdfLoading] = useState(false), [ending, setEnding] = useState(false), [notesUrl, setNotesUrl] = useState(null), [timer, setTimer] = useState(null), [deadline, setDeadline] = useState(null);
  const [classTitle, setClassTitle] = useState("Class"), [showPermissions, setShowPermissions] = useState(false), [backPrompt, setBackPrompt] = useState(false);
  const [hasEntered, setHasEntered] = useState(false), [cameraDevices, setCameraDevices] = useState([]), [microphoneDevices, setMicrophoneDevices] = useState([]), [selectedCameraId, setSelectedCameraId] = useState(""), [selectedMicrophoneId, setSelectedMicrophoneId] = useState(""), [deviceError, setDeviceError] = useState("");
  const previewRef = useRef(null), previewStreamRef = useRef(null);
  useEffect(() => { let cancelled = false; const prepareDevices = async () => { try { let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); previewStreamRef.current = stream; if (previewRef.current) previewRef.current.srcObject = stream; } catch (error) { setDeviceError(error?.message || "Allow camera and microphone access to choose devices."); } const devices = await navigator.mediaDevices.enumerateDevices(); if (cancelled) { stream?.getTracks().forEach((track) => track.stop()); return; } const cameras = devices.filter((device) => device.kind === "videoinput"); const microphones = devices.filter((device) => device.kind === "audioinput"); setCameraDevices(cameras); setMicrophoneDevices(microphones); setSelectedCameraId((current) => current || cameras[0]?.deviceId || ""); setSelectedMicrophoneId((current) => current || microphones[0]?.deviceId || ""); } catch (error) { if (!cancelled) setDeviceError(error?.message || "Unable to list media devices."); } }; prepareDevices(); return () => { cancelled = true; previewStreamRef.current?.getTracks().forEach((track) => track.stop()); previewStreamRef.current = null; }; }, []);
  useEffect(() => { if (hasEntered || (!selectedCameraId && !selectedMicrophoneId)) return; let cancelled = false; let stream; const updatePreview = async () => { try { stream = await navigator.mediaDevices.getUserMedia({ video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true, audio: selectedMicrophoneId ? { deviceId: { exact: selectedMicrophoneId } } : true }); if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; } previewStreamRef.current?.getTracks().forEach((track) => track.stop()); previewStreamRef.current = stream; if (previewRef.current) previewRef.current.srcObject = stream; } catch (error) { if (!cancelled) setDeviceError(error?.message || "Could not preview the selected devices."); } }; updatePreview(); return () => { cancelled = true; if (stream) stream.getTracks().forEach((track) => track.stop()); }; }, [selectedCameraId, selectedMicrophoneId, hasEntered]);
  const enterClassroom = () => { previewStreamRef.current?.getTracks().forEach((track) => track.stop()); previewStreamRef.current = null; setHasEntered(true); };
  const wsUrl = useMemo(() => { const base = import.meta.env.VITE_API_BASE_URL; if (!base || !sessionId) return null; const url = new URL(base); url.protocol = url.protocol === "https:" ? "wss:" : "ws:"; return `${url.origin}/ws/classroom/${sessionId}`; }, [sessionId]);
  const canAnnotate = isTeacher || permissions.annotate;
  useEffect(() => { slidesRef.current = slides; }, [slides]); useEffect(() => { slideRef.current = slide; }, [slide]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => {
    if (!activeBackground) { setBackgroundSize(null); return; }
    let cancelled = false;
    let image = imageCacheRef.current.get(activeBackground);
    if (!image) { image = new Image(); imageCacheRef.current.set(activeBackground, image); }
    const updateSize = () => {
      if (!cancelled && image.naturalWidth > 0 && image.naturalHeight > 0)
        setBackgroundSize({ src: activeBackground, width: image.naturalWidth, height: image.naturalHeight });
    };
    const clearSize = () => { if (!cancelled) setBackgroundSize(null); };
    image.addEventListener("load", updateSize);
    image.addEventListener("error", clearSize);
    if (image.complete && image.naturalWidth > 0) updateSize();
    else if (!image.src) image.src = activeBackground;
    return () => { cancelled = true; image.removeEventListener("load", updateSize); image.removeEventListener("error", clearSize); };
  }, [activeBackground]);
  const getSlideContentRect = useCallback(() => {
    const currentPage = slidesRef.current[slideRef.current - 1];
    const measuredSize = backgroundSizeRef.current;
    const size = measuredSize?.src === currentPage?.image_url ? measuredSize : null;
    if (!size?.width || !size?.height) return { x: 0, y: 0, width: W, height: H };
    const scale = Math.min(W / size.width, H / size.height);
    const width = size.width * scale, height = size.height * scale;
    return { x: (W - width) / 2, y: (H - height) / 2, width, height };
  }, []);
  useEffect(() => { if (!deadline) return; const tick = () => setTimer(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, [deadline]);
  useEffect(() => { let active = true; api.get(`/classroom/sessions/${sessionId}`).then(({ data }) => { if (active) setClassTitle(data.subject_name || "Class"); }).catch(() => {}); return () => { active = false; }; }, [sessionId]);
  useEffect(() => { if (!sessionId) return; const state = { dexmyClassroom: true, sessionId }; window.history.pushState(state, "", window.location.href); const onPopState = () => { window.history.pushState(state, "", window.location.href); if (isTeacher) setBackPrompt(true); else setNotice("You cannot go back while a class is in progress."); }; window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, [sessionId, isTeacher]);
  useEffect(() => { const root = document.querySelector(".dexmy-classroom-shell"); const toolbar = root?.querySelector("main section > div:first-child"); if (!toolbar) return; toolbar.classList.add("classroom-toolbar"); let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0; const onDown = (event) => { if (event.target.closest("button,input,label")) return; dragging = true; toolbar.classList.add("is-dragging"); startX = event.clientX; startY = event.clientY; const r = toolbar.getBoundingClientRect(); originX = r.left; originY = r.top; toolbar.setPointerCapture?.(event.pointerId); }; const onMove = (event) => { if (!dragging) return; const x = clamp(originX + event.clientX - startX, 8, window.innerWidth - toolbar.offsetWidth - 8); const y = clamp(originY + event.clientY - startY, 58, window.innerHeight - toolbar.offsetHeight - 8); toolbar.style.left = `${x}px`; toolbar.style.top = `${y}px`; }; const onUp = () => { dragging = false; toolbar.classList.remove("is-dragging"); }; toolbar.addEventListener("pointerdown", onDown); toolbar.addEventListener("pointermove", onMove); toolbar.addEventListener("pointerup", onUp); toolbar.addEventListener("pointercancel", onUp); return () => { toolbar.removeEventListener("pointerdown", onDown); toolbar.removeEventListener("pointermove", onMove); toolbar.removeEventListener("pointerup", onUp); toolbar.removeEventListener("pointercancel", onUp); }; }, []);
  const send = useCallback((payload) => { if (wsRef.current?.readyState !== WebSocket.OPEN) return false; try { wsRef.current.send(JSON.stringify(payload)); return true; } catch { return false; } }, []);
  const publishControl = useCallback((payload) => { const participant = roomRef.current?.localParticipant; if (!participant || roomRef.current?.state !== "connected") return false; participant.publishData(encoder.encode(JSON.stringify({ type: "classroom_control", payload })), { reliable: true, topic: CONTROL_TOPIC }).catch(() => {}); return true; }, []);
  const publishWhiteboardAction = useCallback((payload) => { const participant = roomRef.current?.localParticipant; if (!participant || roomRef.current?.state !== "connected") return false; participant.publishData(encoder.encode(JSON.stringify({ type: "whiteboard_action", payload })), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); return true; }, []);
  const currentPageId = useCallback((n = slideRef.current) => slidesRef.current[n - 1]?.page_id || null, []);
  const strokesFor = useCallback((n = slideRef.current) => strokesByPageRef.current.get(currentPageId(n)) || [], [currentPageId]);
  const currentStrokes = useCallback(() => strokesFor(), [strokesFor]);
  const renderStroke = useCallback((s, record = false) => { const ctx = canvasRef.current?.getContext("2d"); if (!ctx || !s?.points?.length) return; const a = s.points[0], b = s.points[s.points.length - 1]; const content = getSlideContentRect(); ctx.save(); ctx.beginPath(); ctx.rect(content.x, content.y, content.width, content.height); ctx.clip(); ctx.translate(content.x, content.y); ctx.scale(content.width / W, content.height / H); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.tool === "eraser" ? "#fff" : s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width; ctx.globalAlpha = s.tool === "highlighter" ? 0.24 : 1; if (["pen", "highlighter", "eraser"].includes(s.tool)) { ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); } else if (s.tool === "line") { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } else if (s.tool === "arrow") { const angle = Math.atan2(b.y - a.y, b.x - a.x), head = 16 + s.width * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6)); ctx.stroke(); } else if (s.tool === "rect") ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); else if (s.tool === "circle") { ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke(); } else if (s.tool === "text") { ctx.globalAlpha = 1; ctx.font = `${Math.max(18, s.width * 6)}px sans-serif`; ctx.fillText(s.text || "Text", a.x, a.y); } else if (s.tool === "sticky") { ctx.globalAlpha = 0.92; ctx.fillStyle = "#fff7a8"; ctx.fillRect(a.x, a.y, Math.max(160, b.x - a.x), Math.max(100, b.y - a.y)); ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.font = "20px sans-serif"; String(s.text || "Note").split("\n").forEach((line, i) => ctx.fillText(line.slice(0, 45), a.x + 12, a.y + 28 + i * 24)); } ctx.restore(); if (record) { const list = currentStrokes(); if (!list.some((x) => x.id === s.id)) list.push(s); } }, [currentStrokes]);
  const redraw = useCallback(async () => { const canvas = canvasRef.current; if (!canvas) return; const pageAtStart = slideRef.current; const ctx = canvas.getContext("2d"); const bg = slidesRef.current[pageAtStart - 1]?.image_url; ctx.clearRect(0, 0, W, H); if (!bg) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); } if (pageAtStart !== slideRef.current) return; if (gridRef.current) { const content = getSlideContentRect(); ctx.save(); ctx.beginPath(); ctx.rect(content.x, content.y, content.width, content.height); ctx.clip(); ctx.translate(content.x, content.y); ctx.scale(content.width / W, content.height / H); ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore(); } (strokesByPageRef.current.get(currentPageId(pageAtStart)) || []).forEach((s) => renderStroke(s)); liveRef.current.forEach((s) => { if (s.page_id === currentPageId(pageAtStart) || (s.page_id == null && s.page_number === pageAtStart)) renderStroke(s); }); const selected=(strokesByPageRef.current.get(currentPageId(pageAtStart))||[]).find(s=>s.id===selectedStrokeRef.current); const bounds=strokeBounds(selected); if(bounds){ctx.save();ctx.strokeStyle="#2563eb";ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.strokeRect(bounds.minX-8,bounds.minY-8,Math.max(16,bounds.maxX-bounds.minX+16),Math.max(16,bounds.maxY-bounds.minY+16));ctx.setLineDash([]);ctx.fillStyle="#fff";ctx.strokeStyle="#2563eb";ctx.lineWidth=3;ctx.fillRect(bounds.maxX+1,bounds.maxY+1,14,14);ctx.strokeRect(bounds.maxX+1,bounds.maxY+1,14,14);ctx.restore();} }, [renderStroke, currentPageId]);
  useEffect(() => { redraw(); }, [slide, slides, grid, redraw]);
  useEffect(() => { redraw(); }, [backgroundSize, redraw]);
  useEffect(() => {
    const id = requestAnimationFrame(() => { redraw(); });
    return () => cancelAnimationFrame(id);
  }, [screen, redraw]);
  const saveSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(async () => { const pageNumber = slideRef.current; const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: strokesFor(pageNumber).map((s) => ({ ...s })) }, image_base64: imageBase64, page_id: currentPageId(pageNumber) }); }, 500); }, [send, strokesFor, currentPageId]);
  const saveSnapshotNow = useCallback((pageNumber) => { clearTimeout(snapshotTimerRef.current); const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: strokesFor(pageNumber).map((s) => ({ ...s })) }, image_base64: imageBase64, page_id: currentPageId(pageNumber) }); }, [send, strokesFor, currentPageId]);
  const publishLive = useCallback((stroke, points, pageNumber, final = false) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected" || !Array.isArray(points) || !points.length) return; const packet = { type: "whiteboard_live", payload: { stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points }, page_number: pageNumber, page_id: currentPageId(pageNumber), final } }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: false, topic: LIVE_TOPIC }).catch(() => {}); }, []);
  const publishCommit = useCallback((stroke, pageNumber) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected") return; const packet = { type: "whiteboard_commit", stroke, page_number: pageNumber, page_id: currentPageId(pageNumber) }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const publishStrokeCheckpoint = useCallback(() => { const d = drawRef.current; const room = roomRef.current; const participant = room?.localParticipant; if (!d || !participant || room.state !== "connected" || !d.points?.length || !["pen", "highlighter", "eraser"].includes(d.tool)) return; const packet = { type: "whiteboard_checkpoint", stroke: { ...d, points: d.points.slice() }, page_number: slideRef.current, page_id: currentPageId() }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const queueLive = useCallback((stroke, points, final = false) => { const pending = pendingLiveRef.current; const isShape = ["line", "arrow", "rect", "circle", "text"].includes(stroke.tool); if (pending?.id === stroke.id) { if (isShape) pending.points = points.slice(-2); else pending.points.push(...points); pending.final = final; } else pendingLiveRef.current = { id: stroke.id, stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width }, points: [...points], page_number: slideRef.current, page_id: currentPageId(), final }; }, []);
  const flushLive = useCallback((force = false) => { const pending = pendingLiveRef.current; if (!pending || (!force && !pending.points.length)) return; const points = pending.points.splice(0, 32); if (!points.length) return; publishLive(pending.stroke, points, pending.page_number, pending.final && pending.points.length === 0); if (!pending.points.length) pendingLiveRef.current = null; }, [publishLive]);
  useEffect(() => { let rafId; const tick = () => { flushLive(false); rafId = requestAnimationFrame(tick); }; rafId = requestAnimationFrame(tick); return () => { cancelAnimationFrame(rafId); flushLive(true); clearTimeout(snapshotTimerRef.current); clearTimeout(reliableStrokeTimerRef.current); }; }, [flushLive]);
  useEffect(() => { if (!isTeacher) return; const id = setInterval(() => { if (drawRef.current?.points?.length) publishStrokeCheckpoint(); }, 250); reliableStrokeTimerRef.current = id; return () => clearInterval(id); }, [isTeacher, publishStrokeCheckpoint]);
  const point = (event, allowOutside = false) => { const r = canvasRef.current.getBoundingClientRect(); if (!r.width || !r.height) return null; const boardX = (event.clientX - r.left) * W / r.width; const boardY = (event.clientY - r.top) * H / r.height; const content = getSlideContentRect(); if (!allowOutside && (boardX < content.x || boardX > content.x + content.width || boardY < content.y || boardY > content.y + content.height)) return null; return { x: clamp((boardX - content.x) * W / content.width, 0, W), y: clamp((boardY - content.y) * H / content.height, 0, H) }; };
  const onPointerDown = (event) => { if (!canAnnotate) return setNotice("The teacher has not enabled annotation for you."); const p = point(event); if (!p) return; if (tool === "text") { const hit = [...currentStrokes()].reverse().find((stroke) => stroke.tool === "text" && strokeHit(stroke, p)); if (hit) { selectedStrokeRef.current = hit.id; setTextDraft(hit.text || ""); setTextModal({ x: hit.points[0].x, y: hit.points[0].y, strokeId: hit.id }); } else { setTextDraft(""); setTextModal({ x: p.x, y: p.y, strokeId: null }); } redraw(); return; } if(tool==="eraser"){const list=currentStrokes();const hit=[...list].reverse().find(s=>strokeHit(s,p));if(!hit)return;strokesByPageRef.current.set(currentPageId(),list.filter(s=>s.id!==hit.id));if(selectedStrokeRef.current===hit.id)selectedStrokeRef.current=null;const action = { kind:"stroke_delete", stroke_id:hit.id, page_number:slideRef.current, page_id:currentPageId(), action_id:newId() };publishWhiteboardAction(action);send({type:"whiteboard_event",payload:action});redraw();setThumbnailVersion(v=>v+1);saveSnapshot();return;} if(tool==="select"){const list=currentStrokes(), selected=list.find(s=>s.id===selectedStrokeRef.current), bounds=strokeBounds(selected); if(bounds&&p.x>=bounds.maxX-10&&p.x<=bounds.maxX+24&&p.y>=bounds.maxY-10&&p.y<=bounds.maxY+24){selectInteractionRef.current={mode:"resize",start:p,original:JSON.parse(JSON.stringify(selected))};}else{const hit=[...list].reverse().find(s=>strokeHit(s,p));selectedStrokeRef.current=hit?.id||null;selectInteractionRef.current=hit?{mode:hit.tool==="text"?"maybe-text":"move",start:p,original:JSON.parse(JSON.stringify(hit))}:null;} canvasRef.current.setPointerCapture(event.pointerId); redraw(); return;} if(!DRAW_TOOLS.has(tool))return; const ctx = canvasRef.current?.getContext("2d"); drawBaseRef.current = ctx?.getImageData(0, 0, W, H) || null; drawRef.current = { id: newId(), tool, color, width, points: [p] }; canvasRef.current.setPointerCapture(event.pointerId); if (["pen", "highlighter", "eraser"].includes(tool)) queueLive(drawRef.current, [p]); };
  const onPointerMove = (event) => { const interaction=selectInteractionRef.current; if(interaction){const p=point(event,true);if(!p)return;if(interaction.mode==="maybe-text"){if(Math.hypot(p.x-interaction.start.x,p.y-interaction.start.y)<6)return;interaction.mode="move";}const list=currentStrokes(),index=list.findIndex(s=>s.id===interaction.original.id);if(index<0)return;list[index]=transformStroke(interaction.original,interaction.start,p,interaction.mode);redraw();return;} const d = drawRef.current; if (!d) return; const nextPoint = point(event, true); if (!nextPoint) return; d.points.push(nextPoint); if (["pen", "highlighter", "eraser"].includes(d.tool)) { const n = d.points.length; renderStroke({ ...d, points: [d.points[n - 2], d.points[n - 1]] }); queueLive(d, [d.points[n - 1]]); } else { const ctx = canvasRef.current?.getContext("2d"); if (ctx && drawBaseRef.current) ctx.putImageData(drawBaseRef.current, 0, 0); renderStroke(d); queueLive(d, [d.points[0], d.points[d.points.length - 1]]); } };
  const onPointerUp = (event) => { canvasRef.current?.releasePointerCapture?.(event.pointerId); const interaction=selectInteractionRef.current; if(interaction){selectInteractionRef.current=null;if(interaction.mode==="maybe-text"){setTextDraft(interaction.original.text||"");setTextModal({x:interaction.original.points[0].x,y:interaction.original.points[0].y,strokeId:interaction.original.id});redraw();return;}const list=currentStrokes(),index=list.findIndex(s=>s.id===interaction.original.id);if(index>=0){const updated=list[index];strokesByPageRef.current.set(currentPageId(),list);liveRef.current.delete(updated.id);committedRef.current.add(updated.id);publishCommit(updated,slideRef.current);const action = {kind:"stroke_update",stroke:updated,page_number:slideRef.current,page_id:currentPageId(),action_id:newId()};publishWhiteboardAction(action);send({type:"whiteboard_event",payload:action});setThumbnailVersion(v=>v+1);saveSnapshot();}redraw();return;} const d = drawRef.current; drawRef.current = null; if (!d) return;  const pageNumber = slideRef.current; const pageId = currentPageId(pageNumber); if (!["pen", "highlighter", "eraser"].includes(d.tool)) { if (drawBaseRef.current) canvasRef.current?.getContext("2d")?.putImageData(drawBaseRef.current, 0, 0); queueLive(d, d.points, true); flushLive(true); } else { queueLive(d, [], true); flushLive(true); } renderStroke(d, true); drawBaseRef.current = null; publishCommit(d, pageNumber); send({ type: "whiteboard_event", payload: { kind: "stroke", stroke: d, page_number: pageNumber, page_id: pageId } }); setThumbnailVersion((version) => version + 1); saveSnapshot(); };
  const saveTextModal = () => { if (!textModal) return; const text = textDraft.trim(); if (!text) { setTextModal(null); setTextDraft(""); redraw(); return; } const list = currentStrokes(); let stroke; if (textModal.strokeId) { const index = list.findIndex((item) => item.id === textModal.strokeId); if (index >= 0) { stroke = { ...list[index], text }; list[index] = stroke; } } if (!stroke) { stroke = { id: newId(), tool: "text", color, width, text, points: [{ x: textModal.x, y: textModal.y }] }; list.push(stroke); } selectedStrokeRef.current = stroke.id; publishCommit(stroke, slideRef.current); const action = { kind: textModal.strokeId ? "stroke_update" : "stroke", stroke, page_number: slideRef.current, page_id: currentPageId(), ...(textModal.strokeId ? { action_id: newId() } : {}) }; if (textModal.strokeId) publishWhiteboardAction(action); send({ type: "whiteboard_event", payload: action }); setTextModal(null); setTextDraft(""); setThumbnailVersion((version) => version + 1); redraw(); saveSnapshot(); };
  const changeSlide = (target) => { if (!isTeacher) return; const current = slideRef.current; const next = clamp(target, 1, slidesRef.current.length); if (next === current) return; saveSnapshotNow(current); slideControlActiveRef.current = true; slideRef.current = next; setSlide(next); strokesByPageRef.current.set(currentPageId(next), strokesByPageRef.current.get(currentPageId(next)) || []); publishControl({ kind: "page", page_number: next, page_id: currentPageId(next) }); };
  const addSlide = async () => {
    if (!isTeacher) return;
    const current = slideRef.current;
    const currentPageId = slidesRef.current[current - 1]?.page_id;
    const optimisticPage = makeWhiteboardPage(current + 1);
    const beforePages = slidesRef.current.slice();
    const beforeStrokes = new Map(strokesByPageRef.current);
    const insertAt = Math.max(0, current);
    const optimisticPages = [...beforePages.slice(0, insertAt), optimisticPage, ...beforePages.slice(insertAt)]
      .map((page, index) => ({ ...page, page_number: index + 1 }));
    const optimisticStrokes = new Map(optimisticPages.map((page) => [page.page_id, beforeStrokes.get(page.page_id) || []]));
    optimisticStrokes.set(optimisticPage.page_id, []);
    strokesByPageRef.current = optimisticStrokes;
    slidesRef.current = optimisticPages;
    slideRef.current = insertAt + 1;
    setSlides(optimisticPages);
    setSlide(insertAt + 1);
    setThumbnailVersion((version) => version + 1);
    try {
      const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pages?after_page_id=${encodeURIComponent(currentPageId || "")}`);
      if (!Array.isArray(data?.pages) || !data.pages.length || !data.page_id) {
        throw new Error("The server did not return the new slide. Please try again.");
      }
      const updated = normalizePages(data.pages);
      const next = updated.findIndex((page) => page.page_id === data.page_id) + 1;
      if (next < 1) throw new Error("The new slide was not included in the server response.");
      const currentStrokes = strokesByPageRef.current;
      const nextStrokes = new Map(updated.map((page) => [page.page_id, currentStrokes.get(page.page_id) || beforeStrokes.get(page.page_id) || []]));
      nextStrokes.set(data.page_id, []);
      strokesByPageRef.current = nextStrokes;
      slidesRef.current = updated;
      slideRef.current = next;
      setSlides(updated);
      setSlide(next);
      slideControlActiveRef.current = true;
      publishControl({ kind: "slides", pages: updated, page_number: next, page_id: data.page_id });
      setThumbnailVersion((version) => version + 1);
      setNotice("Slide added.");
    } catch (error) {
      if (slidesRef.current.some((page) => page.page_id === optimisticPage.page_id)) {
        strokesByPageRef.current = beforeStrokes;
        slidesRef.current = beforePages;
        slideRef.current = clamp(current, 1, beforePages.length);
        setSlides(beforePages);
        setSlide(slideRef.current);
        setThumbnailVersion((version) => version + 1);
      }
      setNotice(error.response?.data?.detail || error.message || "Could not add slide.");
    }
  };
  const deleteSlide = async (page) => {
    if (!isTeacher || slidesRef.current.length <= 1) return;
    const beforePages = slidesRef.current.slice();
    const beforeStrokes = new Map(strokesByPageRef.current);
    const beforeSlide = slideRef.current;
    const targetIndex = beforePages.findIndex((item) => item.page_id === page.page_id);
    if (targetIndex < 0) return;
    const remaining = beforePages.filter((item) => item.page_id !== page.page_id);
    const activeBefore = beforePages[beforeSlide - 1];
    const activeAfter = activeBefore?.page_id === page.page_id
      ? remaining[Math.min(targetIndex, remaining.length - 1)]
      : activeBefore;
    const next = Math.max(1, remaining.findIndex((item) => item.page_id === activeAfter?.page_id) + 1);
    const optimisticPages = remaining.map((item, index) => ({ ...item, page_number: index + 1 }));
    strokesByPageRef.current = new Map(optimisticPages.map((item) => [item.page_id, beforeStrokes.get(item.page_id) || []]));
    slidesRef.current = optimisticPages;
    slideRef.current = next;
    setSlides(optimisticPages);
    setSlide(next);
    setThumbnailVersion((version) => version + 1);
    try {
      const activePageId = activeAfter?.page_id;
      const query = activePageId ? `?active_page_id=${encodeURIComponent(activePageId)}` : "";
      const { data } = await api.delete(`/classroom/sessions/${sessionId}/whiteboard-pages/${page.page_id}${query}`);
      const updated = normalizePages(data.pages);
      const latestStrokes = strokesByPageRef.current;
      strokesByPageRef.current = new Map(updated.map((item) => [item.page_id, latestStrokes.get(item.page_id) || beforeStrokes.get(item.page_id) || []]));
      slidesRef.current = updated;
      setSlides(updated);
      const serverNext = clamp(Number(data.page_number) || 1, 1, updated.length);
      slideRef.current = serverNext;
      setSlide(serverNext);
      slideControlActiveRef.current = true;
      publishControl({ kind: "slides", pages: updated, page_number: serverNext, page_id: updated[serverNext - 1]?.page_id });
      setThumbnailVersion((version) => version + 1);
      setNotice("Slide deleted.");
    } catch (error) {
      // Only roll back if this optimistic deletion is still the current local slide set.
      if (!slidesRef.current.some((item) => item.page_id === page.page_id)) {
        strokesByPageRef.current = beforeStrokes;
        slidesRef.current = beforePages;
        slideRef.current = clamp(beforeSlide, 1, beforePages.length);
        setSlides(beforePages);
        setSlide(slideRef.current);
        setThumbnailVersion((version) => version + 1);
      }
      setNotice(error.response?.data?.detail || "Could not delete slide.");
    }
  };
  const undo = () => { if (!isTeacher) return; const list = currentStrokes(); if (!list.length) return; list.pop(); redraw(); setThumbnailVersion((version) => version + 1); const payload = { kind: "undo", page_number: slideRef.current, page_id: currentPageId(), action_id: newId() }; publishWhiteboardAction(payload); send({ type: "whiteboard_event", payload }); saveSnapshot(); };
  const clearBoard = () => { if (!isTeacher) return; strokesByPageRef.current.set(currentPageId(), []); redraw(); setThumbnailVersion((version) => version + 1); const payload = { kind: "clear", page_number: slideRef.current, page_id: currentPageId(), action_id: newId() }; publishWhiteboardAction(payload); send({ type: "whiteboard_event", payload }); saveSnapshot(); };
  const uploadPdf = async (file) => { if (!isTeacher || !file) return; if (file.size > 30 * 1024 * 1024) return setNotice("PDFs are limited to 30 MB."); if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setNotice("Please select a PDF file."); setPdfLoading(true); try { const form = new FormData(); form.append("file", file); const afterPageId = currentPageId(); const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf?after_page_id=${encodeURIComponent(afterPageId || "")}`, form); const next = normalizePages(data.pages); const firstInserted = next.findIndex((p) => data.inserted_page_ids?.includes(p.page_id)); const insertedPage = firstInserted >= 0 ? firstInserted + 1 : slideRef.current; slidesRef.current = next; setSlides(next); strokesByPageRef.current = new Map(next.map((p) => [p.page_id, strokesByPageRef.current.get(p.page_id) || []])); slideRef.current = insertedPage; setSlide(insertedPage); slideControlActiveRef.current = true; publishControl({ kind: "slides", pages: next, page_number: insertedPage, page_id: next[insertedPage - 1]?.page_id }); setNotice(`${data.inserted_count} PDF page${data.inserted_count === 1 ? "" : "s"} inserted after the current page.`); } catch (error) { setNotice(error.response?.data?.detail || "PDF upload failed."); } finally { setPdfLoading(false); } };
  const uploadChatFile = async (file) => { if (!file) return; if (file.size > 20 * 1024 * 1024) return setNotice("Chat files are limited to 20 MB."); try { const form = new FormData(); form.append("file", file); const { data } = await api.post(`/classroom/sessions/${sessionId}/chat-file`, form); send({ type: "chat", file_url: data.file_url, file_name: data.file_name, message_text: "" }); setChat((items) => [...items, { mine: true, file_url: data.file_url, file_name: data.file_name }]); } catch (error) { setNotice(error.response?.data?.detail || "Upload failed."); } };
  const media = async (kind) => { const participant = roomRef.current?.localParticipant; if (!participant || mediaBusyRef.current) return; if (kind === "mic" && !isTeacher && !permissions.mic) return setNotice("Microphone permission is disabled."); if (kind === "camera" && !isTeacher && !permissions.camera) return setNotice("Camera permission is disabled."); if (kind === "screen" && !isTeacher && !permissions.screen_share) return setNotice("Screen sharing is disabled."); mediaBusyRef.current = true; try { if (kind === "mic") { const publication = participant.getTrackPublication?.(Track.Source.Microphone); const next = !(publication?.track && !publication.isMuted); await participant.setMicrophoneEnabled(next, selectedMicrophoneId ? { deviceId: selectedMicrophoneId } : undefined); micStateRef.current = next; setMic(next); } else if (kind === "camera") { const publication = participant.getTrackPublication?.(Track.Source.Camera); const next = !(publication?.track && !publication.isMuted); await participant.setCameraEnabled(next, selectedCameraId ? { deviceId: selectedCameraId } : undefined); cameraStateRef.current = next; setCamera(next); } else if (kind === "screen") { const publication = participant.getTrackPublication?.(Track.Source.ScreenShare); const next = !(publication?.track && !publication.isMuted); await participant.setScreenShareEnabled(next, { contentHint: "detail", selfBrowserSurface: "exclude" }); setScreen(next); } } catch (error) { if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") setNotice("Camera/microphone access was blocked. Please allow the device permission in your browser and try again."); else setNotice(error?.message || "Could not change media."); } finally { mediaBusyRef.current = false; } };
  useEffect(() => {
    if (!hasEntered || !sessionId || !user || !wsUrl) return;
    disposedRef.current = false;
    let reconnectTimer;
    let socket = null;

    const connectWebSocket = () => {
      if (disposedRef.current) return;
      const token = localStorage.getItem("dexmy_token");
      const nextSocket = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token || "")}`);
      socket = nextSocket;
      wsRef.current = nextSocket;

      nextSocket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "heartbeat") return;
        if (msg.type === "waiting_for_teacher") setStatus("Waiting for teacher…");
        if (msg.type === "admitted" || msg.type === "class_started") {
          setStatus("Live");
          if (msg.deadline) setDeadline(msg.deadline);
          if (msg.student_id) setStudentId(msg.student_id);
        }
        if (msg.type === "student_joined") {
          setStudentId(msg.user_id);
          setPeerName(msg.name || "Student");
        }
        if (msg.type === "participant_info") setPeerName(msg.name || "Participant");
        if (msg.type === "chat") setChat((items) => [...items, { mine: msg.sender_id === String(user.id), text: msg.message_text || "", file_url: msg.file_url, file_name: msg.file_name }]);
        if (msg.type === "permissions_state") setPermissions((p) => ({ ...p, ...(msg.permissions || {}) }));
        if (msg.type === "permission_update") {
          setPermissions((p) => ({ ...p, [msg.permission]: msg.granted }));
          if (!isTeacher && !msg.granted && msg.permission === "mic") {
            micStateRef.current = false;
            roomRef.current?.localParticipant.setMicrophoneEnabled(false).then(() => setMic(false)).catch(() => {});
          }
          if (!isTeacher && !msg.granted && msg.permission === "camera") {
            cameraStateRef.current = false;
            roomRef.current?.localParticipant.setCameraEnabled(false).then(() => setCamera(false)).catch(() => {});
          }
          if (!isTeacher && !msg.granted && msg.permission === "screen_share") {
            roomRef.current?.localParticipant.setScreenShareEnabled(false).then(() => setScreen(false)).catch(() => {});
          }
        }
        if (msg.type === "pdf_pages_ready" || msg.type === "whiteboard_pages_updated") {
          const p = normalizePages(msg.pages);
          const oldStrokes = strokesByPageRef.current;
          const activeId = msg.page_id || slidesRef.current[slideRef.current - 1]?.page_id;
          slidesRef.current = p;
          setSlides(p);
          strokesByPageRef.current = new Map(p.map((item) => [item.page_id, oldStrokes.get(item.page_id) || []]));
          const selected = p.findIndex((item) => item.page_id === activeId);
          const next = selected >= 0 ? selected + 1 : clamp(Number(msg.page_number) || 1, 1, p.length);
          slideRef.current = next;
          setSlide(next);
          setThumbnailVersion((version) => version + 1);
        }
        if (msg.type === "whiteboard_state") {
          // The server sends this on every WebSocket connection. After the teacher has
          // initialized the board, a reconnect snapshot can be older than the live local
          // state and must not replace the teacher's in-progress whiteboard.
          if (isTeacher && whiteboardStateInitializedRef.current) return;
          if (slideControlActiveRef.current) return;
          whiteboardStateInitializedRef.current = true;
          const p = msg.pages?.length ? msg.pages : [{ page_number: msg.page_number || 1, image_url: msg.image_url || null }];
          slidesRef.current = p;
          setSlides(p);
          slideRef.current = msg.page_number || 1;
          setSlide(msg.page_number || 1);
          strokesByPageRef.current = new Map(normalizePages(p).map((x) => [x.page_id, Array.isArray(x.strokes) ? x.strokes : []]));
          strokesByPageRef.current.set(msg.page_id || currentPageId(msg.page_number || 1), msg.canvas_json?.strokes || strokesByPageRef.current.get(msg.page_id || currentPageId(msg.page_number || 1)) || []);
          setTimeout(redraw, 0);
        }
        if (msg.type === "whiteboard_event") {
          const p = msg.payload || {};
          if (p.action_id) { if (seenWhiteboardActionIdsRef.current.has(p.action_id)) return; seenWhiteboardActionIdsRef.current.add(p.action_id); if (seenWhiteboardActionIdsRef.current.size > 500) seenWhiteboardActionIdsRef.current.delete(seenWhiteboardActionIdsRef.current.values().next().value); }
          if (p.kind === "page" || p.kind === "slides" || p.kind === "pdf") return;
          if (p.kind === "stroke_delete" && p.stroke_id) { const pageId=p.page_id||currentPageId(p.page_number||1),list=strokesByPageRef.current.get(pageId)||[];strokesByPageRef.current.set(pageId,list.filter(s=>s.id!==p.stroke_id));if(selectedStrokeRef.current===p.stroke_id)selectedStrokeRef.current=null;if((Number(p.page_number)||1)===slideRef.current)redraw();setThumbnailVersion(v=>v+1); }
          if (p.kind === "stroke_update" && p.stroke) { const pageId=p.page_id||currentPageId(p.page_number||1),list=strokesByPageRef.current.get(pageId)||[],index=list.findIndex(s=>s.id===p.stroke.id);if(index>=0)list[index]=p.stroke;else list.push(p.stroke);strokesByPageRef.current.set(pageId,list);if((Number(p.page_number)||1)===slideRef.current)redraw();setThumbnailVersion(v=>v+1); }
          if (p.kind === "stroke" && p.stroke) {
            const pageNumber = Number(p.page_number) || 1; const pageId = p.page_id || currentPageId(pageNumber);
            const list = strokesByPageRef.current.get(pageId) || [];
            const isNewStroke = !list.some((s) => s.id === p.stroke.id);
            if (isNewStroke) list.push(p.stroke);
            strokesByPageRef.current.set(pageId, list);
            committedRef.current.add(p.stroke.id);
            liveRef.current.delete(p.stroke.id);
            if (isNewStroke && pageNumber === slideRef.current) renderStroke(p.stroke);
          }
          if (p.kind === "undo" && p.page_number === slideRef.current) {
            currentStrokes().pop();
            redraw();
          }
          if (p.kind === "clear" && p.page_number === slideRef.current) {
            strokesByPageRef.current.set(currentPageId(), []);
            redraw();
          }
          if (p.kind === "slides") {
            const next = normalizePages(p.pages);
            const oldStrokes = strokesByPageRef.current;
            slidesRef.current = next;
            setSlides(next);
            const nextPage = clamp(Number(p.page_number) || 1, 1, next.length);
            slideRef.current = nextPage;
            setSlide(nextPage);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_id, oldStrokes.get(x.page_id) || []]));
            setThumbnailVersion((version) => version + 1);
            redraw();
          }
          if (p.kind === "pdf") {
            const next = normalizePages(p.pages);
            const oldStrokes = strokesByPageRef.current;
            slidesRef.current = next;
            setSlides(next);
            slideRef.current = 1;
            setSlide(1);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_id, oldStrokes.get(x.page_id) || []]));
            setThumbnailVersion((version) => version + 1);
            redraw();
          }
          if (p.kind === "page") {
            const next = clamp(Number(p.page_number) || 1, 1, slidesRef.current.length);
            slideRef.current = next;
            setSlide(next);
            strokesByPageRef.current.set(currentPageId(next), strokesByPageRef.current.get(currentPageId(next)) || []);
            redraw();
          }
        }
        if (msg.type === "extend_prompt") setNotice(`Class ends in about ${Math.ceil(msg.seconds_remaining / 60)} minutes.`);
        if (msg.type === "class_extended") setDeadline(msg.new_deadline);
        if (msg.type === "session_ended") {
          setEnding(true);
          api.get(`/classroom/sessions/${sessionId}/notes`).then((r) => setNotesUrl(r.data.pdf_url)).catch(() => {});
          setTimeout(() => navigate("/dashboard"), 2200);
        }
      };

      nextSocket.onclose = (event) => {
        if (disposedRef.current) return;
        if (![4401, 4403, 4404, 4409].includes(event.code)) {
          reconnectTimer = setTimeout(connectWebSocket, 2500);
        }
      };
    };

    const connectLiveKit = async () => {
      try {
        setStatus("Authorizing…");
        const { data } = await api.post("/classroom/join-token", { session_id: sessionId });
        if (disposedRef.current) return;

        if (roomRef.current) {
          roomRef.current.disconnect();
          roomRef.current = null;
        }

        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const localVideoTarget = isTeacher ? "local-video" : "remote-video";
        const remoteVideoTarget = isTeacher ? "remote-video" : "local-video";
        const attachLocalPublication = (publication) => {
          const track = publication?.track;
          if (!track) return;
          if (publication.source === Track.Source.Camera) {
            attachMedia(track, localVideoTarget, true);
            setCamera(!publication.isMuted);
          } else if (publication.source === Track.Source.Microphone) {
            attachMedia(track, "local-audio", true);
            setMic(!publication.isMuted);
          } else if (publication.source === Track.Source.ScreenShare) {
            attachMedia(track, "local-screen", true);
            setScreen(!publication.isMuted);
          }
        };
        const attachRemotePublication = (publication, participant) => {
          const track = publication?.track;
          if (!track) return;
          if (publication.source === Track.Source.Camera) {
            attachMedia(track, remoteVideoTarget, false);
            if (participant?.name) setPeerName(participant.name);
          } else if (publication.source === Track.Source.Microphone) {
            attachMedia(track, "remote-audio", false);
          } else if (publication.source === Track.Source.ScreenShare) {
            attachMedia(track, "remote-screen", false);
          }
        };
        const reattachTracks = () => {
          room.localParticipant.trackPublications.forEach(attachLocalPublication);
          room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => attachRemotePublication(publication, participant)));
        };
        const restoreMediaState = async () => {
          const participant = room.localParticipant;
          if (!participant) return;
          try {
            await participant.setMicrophoneEnabled(micStateRef.current);
            setMic(micStateRef.current);
          } catch {}
          try {
            await participant.setCameraEnabled(cameraStateRef.current);
            setCamera(cameraStateRef.current);
          } catch {}
          reattachTracks();
        };

        room.on(RoomEvent.Reconnecting, () => setStatus("Reconnecting video…"));
        room.on(RoomEvent.Reconnected, () => {
          setStatus("Live");
          setTimeout(() => { restoreMediaState(); }, 0);
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!disposedRef.current) setStatus("Reconnecting video…");
        });
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (!participant || participant.identity === String(user.id)) return;
          attachRemotePublication(publication, participant);
        });
        room.on(RoomEvent.LocalTrackPublished, (publication) => attachLocalPublication(publication));
        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          detachMedia(publication.track);
          if (publication.source === Track.Source.Camera) setCamera(false);
          else if (publication.source === Track.Source.Microphone) setMic(false);
          else if (publication.source === Track.Source.ScreenShare) {
            setScreen(false);
            // Restore the existing whiteboard canvas after the local share is removed.
            requestAnimationFrame(() => redraw());
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
          detachMedia(track);
          if (publication?.source === Track.Source.ScreenShare) {
            // Remote screen sharing can end without changing this client's local screen state.
            requestAnimationFrame(() => redraw());
          }
        });
        room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (!participant || !topic) return;
          let msg;
          try { msg = JSON.parse(decoder.decode(payload)); } catch { return; }
          if (msg.type === "classroom_control" && topic === CONTROL_TOPIC) {
            const p = msg.payload || {};
            if (p.kind === "grid") {
              setGrid(Boolean(p.enabled));
              return;
            }
            slideControlActiveRef.current = true;
            if (p.kind === "slides") {
              const next = normalizePages(p.pages);
              slidesRef.current = next;
              setSlides(next);
              const nextPage = clamp(Number(p.page_number) || 1, 1, next.length);
              slideRef.current = nextPage;
              setSlide(nextPage);
              strokesByPageRef.current = new Map(next.map((x) => [x.page_id, strokesByPageRef.current.get(x.page_id) || []]));
              setTimeout(redraw, 0);
            } else if (p.kind === "page") {
              const next = clamp(Number(p.page_number) || 1, 1, slidesRef.current.length);
              slideRef.current = next;
              setSlide(next);
              strokesByPageRef.current.set(currentPageId(next), strokesByPageRef.current.get(currentPageId(next)) || []);
              setTimeout(redraw, 0);
            } else if (p.kind === "pdf") {
              const next = normalizePages(p.pages);
              slidesRef.current = next;
              setSlides(next);
              slideRef.current = 1;
              setSlide(1);
              strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []]));
              setTimeout(redraw, 0);
            }
            return;
          }
          if (msg.type === "whiteboard_action" && topic === COMMIT_TOPIC) {
            const p = msg.payload || {};
            if (p.action_id) { if (seenWhiteboardActionIdsRef.current.has(p.action_id)) return; seenWhiteboardActionIdsRef.current.add(p.action_id); if (seenWhiteboardActionIdsRef.current.size > 500) seenWhiteboardActionIdsRef.current.delete(seenWhiteboardActionIdsRef.current.values().next().value); }
            const pageNumber = Number(p.page_number) || 1;
            const pageId = p.page_id || currentPageId(pageNumber);
            const list = strokesByPageRef.current.get(pageId) || [];
            if (p.kind === "undo") {
              if (list.length) list.pop();
              strokesByPageRef.current.set(pageId, list);
            } else if (p.kind === "clear") {
              strokesByPageRef.current.set(pageId, []);
            } else if (p.kind === "stroke_update" && p.stroke?.id) {
              const index = list.findIndex((stroke) => stroke.id === p.stroke.id);
              if (index >= 0) list[index] = p.stroke; else list.push(p.stroke);
              strokesByPageRef.current.set(pageId, list);
            } else if (p.kind === "stroke_delete" && p.stroke_id) {
              strokesByPageRef.current.set(pageId, list.filter((stroke) => stroke.id !== p.stroke_id));
              if (selectedStrokeRef.current === p.stroke_id) selectedStrokeRef.current = null;
            } else {
              return;
            }
            if (pageNumber === slideRef.current) redraw();
            setThumbnailVersion((version) => version + 1);
            return;
          }
          if (msg.type === "whiteboard_live" && topic === LIVE_TOPIC) {
            const p = msg.payload || {}, stroke = p.stroke;
            if (!stroke?.id || committedRef.current.has(stroke.id)) return;
            if (p.page_number !== slideRef.current) {
              let live = liveRef.current.get(stroke.id);
              if (!live) {
                live = { ...stroke, points: [], page_number: p.page_number };
                liveRef.current.set(stroke.id, live);
              }
              const fresh = Array.isArray(stroke.points) ? stroke.points : [];
              if (fresh.length) live.points.push(...fresh);
              if (p.final) liveRef.current.delete(stroke.id);
              return;
            }
            let live = liveRef.current.get(stroke.id);
            if (!live) {
              live = { ...stroke, points: [], page_number: p.page_number };
              liveRef.current.set(stroke.id, live);
            }
            const fresh = Array.isArray(stroke.points) ? stroke.points : [];
  if (fresh.length) {
    if (["line", "arrow", "rect", "circle", "text", "sticky"].includes(stroke.tool)) {
      live.points = fresh.slice(-2);
      redraw();
      setTimeout(() => {
        if (!committedRef.current.has(stroke.id) && slideRef.current === Number(p.page_number)) renderStroke(live);
      }, 0);
    } else {
      const previous = live.points.length ? live.points[live.points.length - 1] : null;
      renderStroke({ ...live, points: previous ? [previous, ...fresh] : fresh });
      live.points.push(...fresh);
    }
  }
  if (p.final) liveRef.current.delete(stroke.id);
            return;
          }
          if (msg.type === "whiteboard_checkpoint" && topic === COMMIT_TOPIC) {
            const stroke = msg.stroke;
            const pageNumber = Number(msg.page_number) || 1; const pageId = msg.page_id || currentPageId(pageNumber);
            if (!stroke?.id || !stroke?.points?.length) return;
            const existing = liveRef.current.get(stroke.id);
            if (existing && existing.points.length >= stroke.points.length) return;
            liveRef.current.set(stroke.id, { ...stroke, points: stroke.points.slice(), page_number: pageNumber, page_id: pageId });
            if (pageNumber === slideRef.current) redraw();
            return;
          }
          if (msg.type === "whiteboard_commit" && topic === COMMIT_TOPIC) {
            const stroke = msg.stroke;
            const pageNumber = Number(msg.page_number) || 1; const pageId = msg.page_id || currentPageId(pageNumber);
            if (!stroke?.id) return;
            committedRef.current.add(stroke.id);
            liveRef.current.delete(stroke.id);
            const list = strokesByPageRef.current.get(pageId) || [];
            const isNewStroke = !list.some((s) => s.id === stroke.id);
            if (isNewStroke) list.push(stroke);
            strokesByPageRef.current.set(pageId, list);
            if (isNewStroke && pageNumber === slideRef.current) renderStroke(stroke);
            return;
          }
        });

        await room.connect(data.livekit_url, data.livekit_token);
        if (disposedRef.current) {
          room.disconnect();
          if (roomRef.current === room) roomRef.current = null;
          return;
        }
        setStatus("Live");
        reattachTracks();
        connectWebSocket();
      } catch (error) {
        if (!disposedRef.current) {
          if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
          }
          setStatus(error.response?.data?.detail || error.message || "Unable to join classroom");
          reconnectTimer = setTimeout(connectLiveKit, 3500);
        }
      }
    };

    connectLiveKit();

    return () => {
      disposedRef.current = true;
      clearTimeout(reconnectTimer);
      clearTimeout(snapshotTimerRef.current);
      clearInterval(reliableStrokeTimerRef.current);
      socket?.close();
      if (wsRef.current === socket) wsRef.current = null;
      roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, [hasEntered, sessionId, user, wsUrl, isTeacher, navigate, redraw, renderStroke, currentStrokes]);
  const sendMessage = (event) => { event.preventDefault(); const text = message.trim(); if (!text) return; send({ type: "chat", message_text: text }); setChat((items) => [...items, { mine: true, text }]); setMessage(""); };
  const setPermission = (permission, granted) => { if (!studentId) return setNotice("Waiting for the student to join."); send({ type: "permission_update", target_user_id: studentId, permission, granted }); };
  const endClass = async () => { if (!isTeacher || ending) return; setEnding(true); try { const { data } = await api.post(`/classroom/sessions/${sessionId}/end`); if (data?.pdf_url) setNotesUrl(data.pdf_url); } catch (error) { setEnding(false); setNotice(error.response?.data?.detail || "Could not end class."); } };
  const controlsAllowed = timer !== null && timer <= 300;
  const videoControl = (kind, active, label) => <button type="button" title={label} aria-label={label} onClick={() => media(kind)} className={`classroom-video-control ${active ? "active" : ""}`}>{kind === "mic" ? (active ? "🎙" : "🔇") : kind === "camera" ? (active ? "▣" : "▢") : "↗"}</button>;
  return <div className="dexmy-classroom-shell h-[100dvh] w-full overflow-hidden bg-[#0b1020] text-white flex flex-col select-none">
    {!hasEntered && <div className="fixed inset-0 z-[200] grid place-items-center bg-[#050914]/95 p-4"><div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111827] p-5 sm:p-7 shadow-2xl"><div className="text-xl font-semibold">Set up your camera and microphone</div><p className="mt-2 text-sm text-slate-400">Check your camera and choose the devices you want to use before entering the classroom.</p><div className="mt-5 grid gap-5 md:grid-cols-2"><div><div className="mb-2 text-sm font-medium">Camera preview</div><div className="aspect-video overflow-hidden rounded-xl bg-black"><video ref={previewRef} autoPlay muted playsInline className="h-full w-full object-cover" /></div><label className="mt-3 block text-xs text-slate-400">Camera</label><select value={selectedCameraId} onChange={(event) => setSelectedCameraId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm" disabled={!cameraDevices.length}><option value="">Default camera</option>{cameraDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></div><div><div className="mb-2 text-sm font-medium">Microphone</div><div className="flex aspect-video items-center justify-center rounded-xl bg-black/40"><div className="text-center"><div className="text-4xl">🎙</div><div className="mt-2 text-xs text-slate-400">Selected microphone</div></div></div><label className="mt-3 block text-xs text-slate-400">Microphone</label><select value={selectedMicrophoneId} onChange={(event) => setSelectedMicrophoneId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm" disabled={!microphoneDevices.length}><option value="">Default microphone</option>{microphoneDevices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}</select></div></div>{deviceError && <div className="mt-3 text-xs text-amber-300">{deviceError}</div>}<div className="mt-6 flex justify-end"><button onClick={enterClassroom} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold hover:bg-red-500">Enter classroom</button></div></div></div>}
    <div className="classroom-mobile-orientation"><div><strong>Rotate your device</strong><span>Dexmy Classroom is optimized for landscape mode on mobile.</span></div></div>
    <header className="h-14 shrink-0 px-4 border-b border-white/10 bg-[#111827] flex items-center justify-between"><div className="flex items-center gap-2 min-w-0"><b className="truncate">{classTitle}</b><span className="classroom-secure-badge">● Secure</span></div><div className="flex items-center gap-2 text-xs text-slate-400">{timer !== null && <span className="classroom-timer-badge font-mono">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>}{isTeacher && controlsAllowed && <><button onClick={() => send({ type: "extend_class" })} className="classroom-header-action">+5 min</button><button onClick={endClass} disabled={ending} className="classroom-header-action classroom-header-end">{ending ? "Ending…" : "End class"}</button></>}</div></header>
    <main className="flex-1 min-h-0 flex overflow-hidden"><section className="flex-1 min-w-0 flex flex-col">
      <div className="h-12 shrink-0 px-2 flex items-center gap-1 border-b border-white/10 bg-[#0f172a] overflow-x-auto">{TOOLS.map(([id, label]) => <button key={id} disabled={!canAnnotate} onClick={() => setTool(id)} className={`px-2.5 py-1.5 rounded text-[11px] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${tool === id ? "bg-red-600" : "bg-white/5"}`}>{label}</button>)}<button disabled={!isTeacher} onClick={undo} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">Undo</button><button disabled={!isTeacher} onClick={clearBoard} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">Clear</button><button disabled={!isTeacher} onClick={() => setGrid((v) => { const next = !v; publishControl({ kind: "grid", enabled: next }); return next; })} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">Grid</button>{isTeacher && <label className="px-3 py-1.5 bg-white/5 rounded text-[11px] cursor-pointer">{pdfLoading ? "Importing…" : "Upload PDF"}<input hidden type="file" accept="application/pdf,.pdf" disabled={pdfLoading} onChange={(e) => { uploadPdf(e.target.files?.[0]); e.target.value = ""; }} /></label>}<button disabled={!isTeacher} onClick={addSlide} className="px-3 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">＋ Slide</button>{isTeacher && <button onClick={() => setShowPermissions((v) => !v)} className={`px-3 py-1.5 rounded text-[11px] ${showPermissions ? "bg-red-600" : "bg-white/5"}`}>Permissions</button>}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!canAnnotate} className="w-7 h-7 ml-auto disabled:opacity-40" /><input type="range" min="1" max="18" value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={!canAnnotate} className="w-20 disabled:opacity-40" /></div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-[#070b16]"><div className="relative w-full max-w-[calc(100vh*1.777)] max-h-full aspect-video rounded-xl overflow-hidden bg-white shadow-2xl classroom-whiteboard-frame">{slides[slide - 1]?.image_url && <img src={slides[slide - 1].image_url} alt="PDF page" className="absolute inset-0 w-full h-full object-contain pointer-events-none" /> }<canvas ref={canvasRef} width={W} height={H} className={`absolute inset-0 w-full h-full touch-none ${!canAnnotate ? "cursor-default" : "cursor-crosshair"}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} /><div className="absolute inset-0 z-40 pointer-events-none"><img src="/dexmy-logo-bg-removed.png" alt="Dexmy" draggable="false" className="absolute left-[20px] top-[12px] h-[34px] w-auto max-w-[140px] object-contain" /><div className="absolute right-[20px] bottom-[14px] text-[14px] font-medium text-[#64748c] opacity-80">{email}</div></div>{slides.length > 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/70 rounded-xl px-2 py-1.5"><button disabled={!isTeacher} onClick={() => changeSlide(slide - 1)} className="disabled:opacity-40">‹</button><span className="text-xs px-2">Slide {slide}/{slides.length}</span><button disabled={!isTeacher} onClick={() => changeSlide(slide + 1)} className="disabled:opacity-40">›</button></div>}{pdfLoading && <div className="absolute inset-0 z-30 grid place-items-center bg-black/55"><div className="bg-[#111827] rounded-2xl p-6">Importing PDF slides…</div></div>}</div></div>
      {isTeacher && <div className="h-[118px] shrink-0 border-t border-white/10 bg-[#111827] px-3 py-2">
        <div className="h-full flex items-center gap-3 overflow-x-auto classroom-page-filmstrip">
          {slides.map((page, index) => <PageThumbnail key={page.page_id} page={page} number={index + 1} active={slide === index + 1} canSelect={true} canDelete={slides.length > 1} onSelect={() => changeSlide(index + 1)} onDelete={() => deleteSlide(page)} strokes={strokesByPageRef.current.get(page.page_id) || []} version={thumbnailVersion} />)}
        </div>
      </div>}
      <div className="h-16 shrink-0 border-t border-white/10 bg-[#111827] flex items-center justify-center gap-2 classroom-legacy-controls"><button onClick={() => media("mic")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{mic ? "Mute" : "Mic"}</button><button onClick={() => media("camera")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{camera ? "Camera off" : "Camera"}</button><button onClick={() => media("screen")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{screen ? "Stop sharing" : "Share screen"}</button></div>
    </section>
    <aside className="classroom-side-panel border-l border-white/10 bg-[#0f172a]"><div className="h-14 shrink-0 px-3 border-b border-white/10 flex items-center text-sm font-semibold">{peerName || (isTeacher ? "Dexmy Student" : "Dexmy Tutor")}</div><div className="classroom-video-stack"><div className="classroom-video"><span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-[10px]">Teacher</span><div id="local-video" className="absolute inset-0" /><div className="classroom-video-controls-left">{isTeacher && videoControl("mic", mic, "Teacher microphone")}</div>{isTeacher && <div className="classroom-video-controls-right">{videoControl("camera", camera, "Teacher camera")}{videoControl("screen", screen, "Teacher screen share")}</div>}</div><div className="classroom-video"><span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-[10px]">Student</span><div id="remote-video" className="absolute inset-0" />{!isTeacher && <><div className="classroom-video-controls-left">{videoControl("mic", mic, "Student microphone")}</div><div className="classroom-video-controls-right">{videoControl("camera", camera, "Student camera")}{videoControl("screen", screen, "Student screen share")}</div></>}{isTeacher && <div className="classroom-student-permission-indicators"><span className={permissions.mic ? "allowed" : "blocked"}>🎙</span><span className={permissions.camera ? "allowed" : "blocked"}>▣</span></div>}</div><div id="remote-screen" className="hidden" /><div id="local-screen" className="hidden" /><div id="remote-audio" className="hidden" /><div id="local-audio" className="hidden" /></div>{isTeacher && showPermissions && <div className="classroom-permissions-popover"><div className="text-xs font-semibold mb-2">Student permissions</div><div className="grid grid-cols-2 gap-1.5">{[["annotate", "Annotate"], ["screen_share", "Share screen"]].map(([key, label]) => <button key={key} onClick={() => setPermission(key, !permissions[key])} className={`px-2 py-2 rounded text-[10px] ${permissions[key] ? "bg-emerald-600/80" : "bg-white/5"}`}>{permissions[key] ? "✓ " : "✕ "}{label}</button>)}</div></div>}<div className="classroom-chat"><div className="classroom-chat-messages">{chat.length === 0 && <div className="h-full grid place-items-center text-xs text-slate-600">No messages yet</div>}{chat.map((item, i) => <div key={i} className={`flex mb-2 ${item.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs ${item.mine ? "bg-red-600" : "bg-white/10"}`}>{item.file_url ? <a href={item.file_url} target="_blank" rel="noreferrer" className="underline">{item.file_name || "Open file"}</a> : item.text}</div></div>)}</div><form onSubmit={sendMessage} className="classroom-chat-form p-2 border-t border-white/10 flex gap-2"><label className="h-9 w-9 grid place-items-center bg-white/5 rounded cursor-pointer">＋<input hidden type="file" onChange={(e) => { uploadChatFile(e.target.files?.[0]); e.target.value = ""; }} /></label><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" className="flex-1 h-9 bg-white/5 rounded px-3 text-xs" /><button className="h-9 px-3 bg-red-600 rounded text-xs">Send</button></form></div></aside></main>
    {textModal && <div className="fixed inset-0 z-[150] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="whiteboard-text-title"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-2xl" onPointerDown={(event) => event.stopPropagation()}><div id="whiteboard-text-title" className="text-lg font-semibold">{textModal.strokeId ? "Edit whiteboard text" : "Add whiteboard text"}</div><textarea autoFocus value={textDraft} onChange={(event) => setTextDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setTextModal(null); setTextDraft(""); } }} placeholder="Enter text…" rows={4} className="mt-4 w-full resize-y rounded-lg border border-white/10 bg-[#0b1020] p-3 text-sm text-white outline-none focus:border-red-500" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setTextModal(null); setTextDraft(""); redraw(); }} className="rounded-lg bg-white/10 px-4 py-2 text-sm">Cancel</button><button type="button" onClick={saveTextModal} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500">Done</button></div></div></div>}
    {notice && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-4 py-2 rounded-xl text-xs">{notice}</div>}
    {ending && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80"><div className="bg-[#111827] rounded-2xl p-8 text-center"><div className="text-lg font-semibold">Class ended</div>{notesUrl && <a href={notesUrl} target="_blank" rel="noreferrer" className="text-red-400 text-sm underline mt-2 inline-block">Download notes</a>}</div></div>}
    {backPrompt && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70"><div className="bg-[#111827] rounded-2xl p-6 text-center"><div className="font-semibold">Leave classroom?</div><div className="text-xs text-slate-400 mt-2">The class is still in progress.</div><div className="flex gap-2 justify-center mt-4"><button onClick={() => setBackPrompt(false)} className="px-4 py-2 bg-white/10 rounded">Stay</button><button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-red-600 rounded">Leave</button></div></div></div>}
  </div>;
}
