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
const TOOLS = [["select", "Select"], ["pen", "Pen"], ["highlighter", "Highlight"], ["line", "Line"], ["arrow", "Arrow"], ["rect", "Rectangle"], ["circle", "Circle"], ["text", "Text"], ["sticky", "Sticky"], ["eraser", "Eraser"]];
const DRAW_TOOLS = new Set(TOOLS.map(([id]) => id).filter((id) => id !== "select"));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function Classroom() {
  const { user } = useAuth(); const { sessionId } = useParams(); const navigate = useNavigate();
  const isTeacher = user?.role === "teacher"; const email = user?.email || "";
  const canvasRef = useRef(null), wsRef = useRef(null), roomRef = useRef(null), drawRef = useRef(null), drawBaseRef = useRef(null);
  const slidesRef = useRef([{ page_number: 1, image_url: null }]), strokesByPageRef = useRef(new Map([[1, []]]), ), slideRef = useRef(1);
  const liveRef = useRef(new Map()), committedRef = useRef(new Set()), pendingLiveRef = useRef(null), snapshotTimerRef = useRef(null), disposedRef = useRef(false), imageCacheRef = useRef(new Map()), reliableStrokeTimerRef = useRef(null), slideControlActiveRef = useRef(false);
  const mediaBusyRef = useRef(false);
  const micStateRef = useRef(false);
  const cameraStateRef = useRef(false);
  const gridRef = useRef(false);
  const [status, setStatus] = useState("Connecting…"), [notice, setNotice] = useState(""), [tool, setTool] = useState("pen"), [color, setColor] = useState("#111827"), [width, setWidth] = useState(3), [grid, setGrid] = useState(false);
  const [slides, setSlides] = useState([{ page_number: 1, image_url: null }]), [slide, setSlide] = useState(1), [chat, setChat] = useState([]), [message, setMessage] = useState("");
  const [mic, setMic] = useState(false), [camera, setCamera] = useState(false), [screen, setScreen] = useState(false), [studentId, setStudentId] = useState(null), [peerName, setPeerName] = useState("");
  const [permissions, setPermissions] = useState({ mic: true, camera: true, annotate: false, screen_share: false }), [pdfLoading, setPdfLoading] = useState(false), [ending, setEnding] = useState(false), [notesUrl, setNotesUrl] = useState(null), [timer, setTimer] = useState(null), [deadline, setDeadline] = useState(null);
  const [classTitle, setClassTitle] = useState("Class"), [showPermissions, setShowPermissions] = useState(false), [backPrompt, setBackPrompt] = useState(false);
  const wsUrl = useMemo(() => { const base = import.meta.env.VITE_API_BASE_URL; if (!base || !sessionId) return null; const url = new URL(base); url.protocol = url.protocol === "https:" ? "wss:" : "ws:"; return `${url.origin}/ws/classroom/${sessionId}`; }, [sessionId]);
  const canAnnotate = isTeacher || permissions.annotate;
  useEffect(() => { slidesRef.current = slides; }, [slides]); useEffect(() => { slideRef.current = slide; }, [slide]);
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { if (!deadline) return; const tick = () => setTimer(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, [deadline]);
  useEffect(() => { let active = true; api.get(`/classroom/sessions/${sessionId}`).then(({ data }) => { if (active) setClassTitle(data.subject_name || "Class"); }).catch(() => {}); return () => { active = false; }; }, [sessionId]);
  useEffect(() => { if (!sessionId) return; const state = { dexmyClassroom: true, sessionId }; window.history.pushState(state, "", window.location.href); const onPopState = () => { window.history.pushState(state, "", window.location.href); if (isTeacher) setBackPrompt(true); else setNotice("You cannot go back while a class is in progress."); }; window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, [sessionId, isTeacher]);
  useEffect(() => { const root = document.querySelector(".dexmy-classroom-shell"); const toolbar = root?.querySelector("main section > div:first-child"); if (!toolbar) return; toolbar.classList.add("classroom-toolbar"); let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0; const onDown = (event) => { if (event.target.closest("button,input,label")) return; dragging = true; toolbar.classList.add("is-dragging"); startX = event.clientX; startY = event.clientY; const r = toolbar.getBoundingClientRect(); originX = r.left; originY = r.top; toolbar.setPointerCapture?.(event.pointerId); }; const onMove = (event) => { if (!dragging) return; const x = clamp(originX + event.clientX - startX, 8, window.innerWidth - toolbar.offsetWidth - 8); const y = clamp(originY + event.clientY - startY, 58, window.innerHeight - toolbar.offsetHeight - 8); toolbar.style.left = `${x}px`; toolbar.style.top = `${y}px`; }; const onUp = () => { dragging = false; toolbar.classList.remove("is-dragging"); }; toolbar.addEventListener("pointerdown", onDown); toolbar.addEventListener("pointermove", onMove); toolbar.addEventListener("pointerup", onUp); toolbar.addEventListener("pointercancel", onUp); return () => { toolbar.removeEventListener("pointerdown", onDown); toolbar.removeEventListener("pointermove", onMove); toolbar.removeEventListener("pointerup", onUp); toolbar.removeEventListener("pointercancel", onUp); }; }, []);
  const send = useCallback((payload) => { if (wsRef.current?.readyState !== WebSocket.OPEN) return false; try { wsRef.current.send(JSON.stringify(payload)); return true; } catch { return false; } }, []);
  const publishControl = useCallback((payload) => { const participant = roomRef.current?.localParticipant; if (!participant || roomRef.current?.state !== "connected") return false; participant.publishData(encoder.encode(JSON.stringify({ type: "classroom_control", payload })), { reliable: true, topic: CONTROL_TOPIC }).catch(() => {}); return true; }, []);
  const currentStrokes = useCallback(() => strokesByPageRef.current.get(slideRef.current) || [], []);
  const renderStroke = useCallback((s, record = false) => { const ctx = canvasRef.current?.getContext("2d"); if (!ctx || !s?.points?.length) return; const a = s.points[0], b = s.points[s.points.length - 1]; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.tool === "eraser" ? "#fff" : s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width; ctx.globalAlpha = s.tool === "highlighter" ? 0.24 : 1; if (["pen", "highlighter", "eraser"].includes(s.tool)) { ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); } else if (s.tool === "line") { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } else if (s.tool === "arrow") { const angle = Math.atan2(b.y - a.y, b.x - a.x), head = 16 + s.width * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6)); ctx.stroke(); } else if (s.tool === "rect") ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); else if (s.tool === "circle") { ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke(); } else if (s.tool === "text") { ctx.globalAlpha = 1; ctx.font = `${Math.max(18, s.width * 6)}px sans-serif`; ctx.fillText(s.text || "Text", a.x, a.y); } else if (s.tool === "sticky") { ctx.globalAlpha = 0.92; ctx.fillStyle = "#fff7a8"; ctx.fillRect(a.x, a.y, Math.max(160, b.x - a.x), Math.max(100, b.y - a.y)); ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.font = "20px sans-serif"; String(s.text || "Note").split("\n").forEach((line, i) => ctx.fillText(line.slice(0, 45), a.x + 12, a.y + 28 + i * 24)); } ctx.restore(); if (record) { const list = currentStrokes(); if (!list.some((x) => x.id === s.id)) list.push(s); } }, [currentStrokes]);
  const drawOverlay = useCallback((ctx) => { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#64748c"; ctx.font = "18px sans-serif"; ctx.textAlign = "right"; ctx.fillText(email, W - 30, H - 25); ctx.globalAlpha = 0.9; ctx.textAlign = "left"; ctx.fillStyle = "#111827"; ctx.font = "bold 24px sans-serif"; ctx.fillText("DEXMY", 30, 40); ctx.restore(); }, [email]);
  const redraw = useCallback(async () => { const canvas = canvasRef.current; if (!canvas) return; const pageAtStart = slideRef.current; const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); const bg = slidesRef.current[pageAtStart - 1]?.image_url; if (bg) { let img = imageCacheRef.current.get(bg); if (!img) { img = new Image(); img.crossOrigin = "anonymous"; imageCacheRef.current.set(bg, img); img.src = bg; try { if (!img.complete) await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; }); } catch {} } if (pageAtStart !== slideRef.current) return; if (img.complete && img.naturalWidth) { const scale = Math.min(W / img.width, H / img.height), w = img.width * scale, h = img.height * scale; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); } } if (pageAtStart !== slideRef.current) return; if (gridRef.current) { ctx.save(); ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore(); } (strokesByPageRef.current.get(pageAtStart) || []).forEach((s) => renderStroke(s)); liveRef.current.forEach((s) => { if (s.page_number === pageAtStart) renderStroke(s); }); drawOverlay(ctx); }, [renderStroke, drawOverlay]);
  useEffect(() => { redraw(); }, [slide, slides, grid, redraw]);
  const saveSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(async () => { const pageNumber = slideRef.current; const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: (strokesByPageRef.current.get(pageNumber) || []).map((s) => ({ ...s })) }, image_base64: imageBase64 }); }, 500); }, [send]);
  const saveSnapshotNow = useCallback((pageNumber) => { clearTimeout(snapshotTimerRef.current); const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: (strokesByPageRef.current.get(pageNumber) || []).map((s) => ({ ...s })) }, image_base64: imageBase64 }); }, [send]);
  const publishLive = useCallback((stroke, points, pageNumber, final = false) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected" || !Array.isArray(points) || !points.length) return; const packet = { type: "whiteboard_live", payload: { stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points }, page_number: pageNumber, final } }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: false, topic: LIVE_TOPIC }).catch(() => {}); }, []);
  const publishCommit = useCallback((stroke, pageNumber) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected") return; const packet = { type: "whiteboard_commit", stroke, page_number: pageNumber }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const publishStrokeCheckpoint = useCallback(() => { const d = drawRef.current; const room = roomRef.current; const participant = room?.localParticipant; if (!d || !participant || room.state !== "connected" || !d.points?.length) return; const packet = { type: "whiteboard_checkpoint", stroke: { ...d, points: d.points.slice() }, page_number: slideRef.current }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const queueLive = useCallback((stroke, points, final = false) => { const pending = pendingLiveRef.current; if (pending?.id === stroke.id) { pending.points.push(...points); pending.final = final; } else pendingLiveRef.current = { id: stroke.id, stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width }, points: [...points], page_number: slideRef.current, final }; }, []);
  const flushLive = useCallback((force = false) => { const pending = pendingLiveRef.current; if (!pending || (!force && !pending.points.length)) return; const points = pending.points.splice(0, 32); if (!points.length) return; publishLive(pending.stroke, points, pending.page_number, pending.final && pending.points.length === 0); if (!pending.points.length) pendingLiveRef.current = null; }, [publishLive]);
  useEffect(() => { let rafId; const tick = () => { flushLive(false); rafId = requestAnimationFrame(tick); }; rafId = requestAnimationFrame(tick); return () => { cancelAnimationFrame(rafId); flushLive(true); clearTimeout(snapshotTimerRef.current); clearTimeout(reliableStrokeTimerRef.current); }; }, [flushLive]);
  useEffect(() => { if (!isTeacher) return; const id = setInterval(() => { if (drawRef.current?.points?.length) publishStrokeCheckpoint(); }, 250); reliableStrokeTimerRef.current = id; return () => clearInterval(id); }, [isTeacher, publishStrokeCheckpoint]);
  const point = (event) => { const r = canvasRef.current.getBoundingClientRect(); return { x: clamp((event.clientX - r.left) * W / r.width, 0, W), y: clamp((event.clientY - r.top) * H / r.height, 0, H) }; };
  const onPointerDown = (event) => { if (!canAnnotate) return setNotice("The teacher has not enabled annotation for you."); const p = point(event); if (tool === "select" || !DRAW_TOOLS.has(tool)) return; const ctx = canvasRef.current?.getContext("2d"); drawBaseRef.current = ctx?.getImageData(0, 0, W, H) || null; drawRef.current = { id: newId(), tool, color, width, points: [p] }; canvasRef.current.setPointerCapture(event.pointerId); if (["pen", "highlighter", "eraser"].includes(tool)) queueLive(drawRef.current, [p]); };
  const onPointerMove = (event) => { const d = drawRef.current; if (!d) return; d.points.push(point(event)); if (["pen", "highlighter", "eraser"].includes(d.tool)) { const n = d.points.length; renderStroke({ ...d, points: [d.points[n - 2], d.points[n - 1]] }); queueLive(d, [d.points[n - 1]]); } else { const ctx = canvasRef.current?.getContext("2d"); if (ctx && drawBaseRef.current) ctx.putImageData(drawBaseRef.current, 0, 0); renderStroke(d); } };
  const onPointerUp = (event) => { const d = drawRef.current; drawRef.current = null; canvasRef.current?.releasePointerCapture?.(event.pointerId); if (!d) return; if (["text", "sticky"].includes(d.tool)) { const text = window.prompt(d.tool === "sticky" ? "Sticky note text" : "Text"); if (!text) { redraw(); return; } d.text = text; if (d.tool === "text") d.points = [d.points[0]]; } const pageNumber = slideRef.current; if (!["pen", "highlighter", "eraser"].includes(d.tool)) { if (drawBaseRef.current) canvasRef.current?.getContext("2d")?.putImageData(drawBaseRef.current, 0, 0); queueLive(d, d.points, true); flushLive(true); } else { queueLive(d, [], true); flushLive(true); } renderStroke(d, true); drawBaseRef.current = null; publishCommit(d, pageNumber); send({ type: "whiteboard_event", payload: { kind: "stroke", stroke: d, page_number: pageNumber } }); saveSnapshot(); };
  const changeSlide = (target) => { if (!isTeacher) return; const current = slideRef.current; const next = clamp(target, 1, slidesRef.current.length); if (next === current) return; saveSnapshotNow(current); slideControlActiveRef.current = true; slideRef.current = next; setSlide(next); strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []); publishControl({ kind: "page", page_number: next }); };
  const addSlide = () => { if (!isTeacher) return; const current = slideRef.current; saveSnapshotNow(current); const next = slidesRef.current.length + 1; strokesByPageRef.current.set(next, []); const updated = [...slidesRef.current, { page_number: next, image_url: null }]; slidesRef.current = updated; setSlides(updated); slideRef.current = next; setSlide(next); slideControlActiveRef.current = true; publishControl({ kind: "slides", pages: updated, page_number: next }); };
  const undo = () => { if (!isTeacher) return; const list = currentStrokes(); if (!list.length) return; list.pop(); redraw(); send({ type: "whiteboard_event", payload: { kind: "undo", page_number: slideRef.current } }); saveSnapshot(); };
  const clearBoard = () => { if (!isTeacher) return; strokesByPageRef.current.set(slideRef.current, []); redraw(); send({ type: "whiteboard_event", payload: { kind: "clear", page_number: slideRef.current } }); saveSnapshot(); };
  const uploadPdf = async (file) => { if (!isTeacher || !file) return; if (file.size > 30 * 1024 * 1024) return setNotice("PDFs are limited to 30 MB."); if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setNotice("Please select a PDF file."); setPdfLoading(true); try { const form = new FormData(); form.append("file", file); const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf`, form); const imported = data.map((item, i) => ({ page_number: i + 1, image_url: item.file_url })); const next = imported.length ? imported : [{ page_number: 1, image_url: null }]; slidesRef.current = next; setSlides(next); slideRef.current = 1; setSlide(1); strokesByPageRef.current = new Map(next.map((p) => [p.page_number, []])); const payload = { kind: "pdf", pages: next }; slideControlActiveRef.current = true; publishControl(payload); setNotice(`${imported.length} PDF page${imported.length === 1 ? "" : "s"} loaded.`); } catch (error) { setNotice(error.response?.data?.detail || "PDF upload failed."); } finally { setPdfLoading(false); } };
  const uploadChatFile = async (file) => { if (!file) return; if (file.size > 20 * 1024 * 1024) return setNotice("Files are limited to 20 MB."); try { const form = new FormData(); form.append("file", file); const { data } = await api.post("/classroom/chat/upload", form); send({ type: "chat", message_text: "", file_url: data.file_url, file_name: data.file_name }); } catch (error) { setNotice(error.response?.data?.detail || "File upload failed."); } };
  const media = async (kind) => { const room = roomRef.current; if (!room || room.state !== "connected" || mediaBusyRef.current) return; mediaBusyRef.current = true; try { if (kind === "mic") { const next = !micStateRef.current; await room.localParticipant.setMicrophoneEnabled(next); micStateRef.current = next; setMic(next); } else if (kind === "camera") { const next = !cameraStateRef.current; await room.localParticipant.setCameraEnabled(next); cameraStateRef.current = next; setCamera(next); } else if (kind === "screen") { const next = !screen; await room.localParticipant.setScreenShareEnabled(next); setScreen(next); } } catch (error) { setNotice(error.message || "Media action failed"); } finally { mediaBusyRef.current = false; } };
  const connectWebSocket = () => {
    if (!wsUrl || disposedRef.current) return;
    let reconnectTimer;
    const connect = () => {
      if (disposedRef.current) return;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;
      socket.onopen = () => setStatus("Live");
      socket.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (msg.type === "class_started") { setDeadline(msg.deadline); if (isTeacher && msg.student_present) setStudentId(msg.student_id); }
        if (msg.type === "admitted") setDeadline(msg.deadline);
        if (msg.type === "waiting_for_teacher") setNotice("Waiting for the teacher to start the class…");
        if (msg.type === "participant_info") setPeerName(msg.name || "");
        if (msg.type === "student_joined") setStudentId(msg.user_id);
        if (msg.type === "permissions_state") setPermissions(msg.permissions || {});
        if (msg.type === "permission_update") setPermissions((prev) => ({ ...prev, [msg.permission]: msg.granted }));
        if (msg.type === "permission_sync_failed") setNotice(`Permission sync failed: ${msg.permission}`);
        if (msg.type === "teacher_disconnected") setNotice("Teacher connection lost. Waiting for reconnection…");
        if (msg.type === "heartbeat") return;
        if (msg.type === "chat") setChat((items) => [...items, { mine: false, text: msg.message_text, file_url: msg.file_url, file_name: msg.file_name, sender_id: msg.sender_id }]);
        if (msg.type === "whiteboard_state") {
          if (slideControlActiveRef.current) return;
          const p = msg.pages?.length ? msg.pages : [{ page_number: msg.page_number || 1, image_url: msg.image_url || null }];
          slidesRef.current = p;
          setSlides(p);
          slideRef.current = msg.page_number || 1;
          setSlide(msg.page_number || 1);
          strokesByPageRef.current = new Map(p.map((x) => [x.page_number, Array.isArray(x.strokes) ? x.strokes : []]));
          strokesByPageRef.current.set(msg.page_number || 1, msg.canvas_json?.strokes || strokesByPageRef.current.get(msg.page_number || 1) || []);
          setTimeout(redraw, 0);
        }
        if (msg.type === "whiteboard_event") {
          const p = msg.payload || {};
          if (p.kind === "page" || p.kind === "slides" || p.kind === "pdf") return;
          if (p.kind === "stroke" && p.stroke) {
            const pageNumber = Number(p.page_number) || 1;
            const list = strokesByPageRef.current.get(pageNumber) || [];
            const isNewStroke = !list.some((s) => s.id === p.stroke.id);
            if (isNewStroke) list.push(p.stroke);
            strokesByPageRef.current.set(pageNumber, list);
            committedRef.current.add(p.stroke.id);
            liveRef.current.delete(p.stroke.id);
            if (isNewStroke && pageNumber === slideRef.current) renderStroke(p.stroke);
          }
          if (p.kind === "undo" && p.page_number === slideRef.current) { currentStrokes().pop(); redraw(); }
          if (p.kind === "clear" && p.page_number === slideRef.current) { strokesByPageRef.current.set(slideRef.current, []); redraw(); }
          if (p.kind === "slides") {
            const next = p.pages?.length ? p.pages : [{ page_number: 1, image_url: null }];
            slidesRef.current = next; setSlides(next);
            const nextPage = clamp(Number(p.page_number) || 1, 1, next.length);
            slideRef.current = nextPage; setSlide(nextPage);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_number, strokesByPageRef.current.get(x.page_number) || []]));
            redraw();
          }
          if (p.kind === "pdf") {
            const next = p.pages || [{ page_number: 1, image_url: null }];
            slidesRef.current = next; setSlides(next); slideRef.current = 1; setSlide(1);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []])); redraw();
          }
          if (p.kind === "page") {
            const next = clamp(Number(p.page_number) || 1, 1, slidesRef.current.length);
            slideRef.current = next; setSlide(next);
            strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []); redraw();
          }
        }
        if (msg.type === "extend_prompt") setNotice(`Class ends in about ${Math.ceil(msg.seconds_remaining / 60)} minutes.`);
        if (msg.type === "class_extended") setDeadline(msg.new_deadline);
        if (msg.type === "session_ended") { setEnding(true); api.get(`/classroom/sessions/${sessionId}/notes`).then((r) => setNotesUrl(r.data.pdf_url)).catch(() => {}); setTimeout(() => navigate("/dashboard"), 2200); }
      };
      socket.onclose = (event) => { if (disposedRef.current) return; if (![4401, 4403, 4404, 4409].includes(event.code)) reconnectTimer = setTimeout(connect, 2500); };
    };
    connect();
  };
  useEffect(() => {
    let reconnectTimer;
    const connectLiveKit = async () => {
      try {
        setStatus("Authorizing…");
        const { data } = await api.post("/classroom/join-token", { session_id: sessionId });
        if (disposedRef.current) return;
        if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
        const room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
        const localVideoTarget = isTeacher ? "local-video" : "remote-video";
        const remoteVideoTarget = isTeacher ? "remote-video" : "local-video";
        const attachLocalPublication = (publication) => { const track = publication?.track; if (!track) return; if (publication.source === Track.Source.Camera) { attachMedia(track, localVideoTarget, true); setCamera(!publication.isMuted); } else if (publication.source === Track.Source.Microphone) { attachMedia(track, "local-audio", true); setMic(!publication.isMuted); } else if (publication.source === Track.Source.ScreenShare) { attachMedia(track, "local-screen", true); setScreen(!publication.isMuted); } };
        const attachRemotePublication = (publication, participant) => { const track = publication?.track; if (!track) return; if (publication.source === Track.Source.Camera) { attachMedia(track, remoteVideoTarget, false); if (participant?.name) setPeerName(participant.name); } else if (publication.source === Track.Source.Microphone) attachMedia(track, "remote-audio", false); else if (publication.source === Track.Source.ScreenShare) attachMedia(track, "remote-screen", false); };
        const reattachTracks = () => { room.localParticipant.trackPublications.forEach(attachLocalPublication); room.remoteParticipants.forEach((participant) => participant.trackPublications.forEach((publication) => attachRemotePublication(publication, participant))); };
        const restoreMediaState = async () => { const participant = room.localParticipant; if (!participant) return; try { await participant.setMicrophoneEnabled(micStateRef.current); setMic(micStateRef.current); } catch {} try { await participant.setCameraEnabled(cameraStateRef.current); setCamera(cameraStateRef.current); } catch {} reattachTracks(); };
        room.on(RoomEvent.Reconnecting, () => setStatus("Reconnecting video…")); room.on(RoomEvent.Reconnected, () => { setStatus("Live"); setTimeout(() => { restoreMediaState(); }, 0); }); room.on(RoomEvent.Disconnected, () => { if (!disposedRef.current) setStatus("Reconnecting video…"); });
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => { if (!participant || participant.identity === String(user.id)) return; attachRemotePublication(publication, participant); });
        room.on(RoomEvent.LocalTrackPublished, (publication) => attachLocalPublication(publication));
        room.on(RoomEvent.LocalTrackUnpublished, (publication) => { detachMedia(publication.track); if (publication.source === Track.Source.Camera) setCamera(false); else if (publication.source === Track.Source.Microphone) setMic(false); else if (publication.source === Track.Source.ScreenShare) setScreen(false); });
        room.on(RoomEvent.TrackUnsubscribed, (track) => detachMedia(track));
        room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (!participant || !topic) return;
          let msg; try { msg = JSON.parse(decoder.decode(payload)); } catch { return; }
          if (msg.type === "classroom_control" && topic === CONTROL_TOPIC) {
            const p = msg.payload || {}; slideControlActiveRef.current = true;
            if (p.kind === "slides") { const next = p.pages?.length ? p.pages : [{ page_number: 1, image_url: null }]; slidesRef.current = next; setSlides(next); const nextPage = clamp(Number(p.page_number) || 1, 1, next.length); slideRef.current = nextPage; setSlide(nextPage); strokesByPageRef.current = new Map(next.map((x) => [x.page_number, strokesByPageRef.current.get(x.page_number) || []])); setTimeout(redraw, 0); }
            else if (p.kind === "page") { const next = clamp(Number(p.page_number) || 1, 1, slidesRef.current.length); slideRef.current = next; setSlide(next); strokesByPageRef.current.set(next, strokesByPageRef.current.get(next) || []); setTimeout(redraw, 0); }
            else if (p.kind === "pdf") { const next = p.pages || [{ page_number: 1, image_url: null }]; slidesRef.current = next; setSlides(next); slideRef.current = 1; setSlide(1); strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []])); setTimeout(redraw, 0); }
            return;
          }
          if (msg.type === "whiteboard_live" && topic === LIVE_TOPIC) {
            const p = msg.payload || {}, stroke = p.stroke; if (!stroke?.id || committedRef.current.has(stroke.id)) return;
            if (p.page_number !== slideRef.current) { let live = liveRef.current.get(stroke.id); if (!live) { live = { ...stroke, points: [], page_number: p.page_number }; liveRef.current.set(stroke.id, live); } const fresh = Array.isArray(stroke.points) ? stroke.points : []; if (fresh.length) live.points.push(...fresh); if (p.final) liveRef.current.delete(stroke.id); return; }
            let live = liveRef.current.get(stroke.id); if (!live) { live = { ...stroke, points: [], page_number: p.page_number }; liveRef.current.set(stroke.id, live); }
            const fresh = Array.isArray(stroke.points) ? stroke.points : []; if (fresh.length) { const previous = live.points.length ? live.points[live.points.length - 1] : null; renderStroke({ ...live, points: previous ? [previous, ...fresh] : fresh }); live.points.push(...fresh); } if (p.final) liveRef.current.delete(stroke.id); return;
          }
          if (msg.type === "whiteboard_checkpoint" && topic === COMMIT_TOPIC) { const stroke = msg.stroke; const pageNumber = Number(msg.page_number) || 1; if (!stroke?.id || !stroke?.points?.length) return; const existing = liveRef.current.get(stroke.id); if (existing && existing.points.length >= stroke.points.length) return; liveRef.current.set(stroke.id, { ...stroke, points: stroke.points.slice(), page_number: pageNumber }); if (pageNumber === slideRef.current) redraw(); return; }
          if (msg.type === "whiteboard_commit" && topic === COMMIT_TOPIC) {
            const stroke = msg.stroke; const pageNumber = Number(msg.page_number) || 1; if (!stroke?.id) return;
            committedRef.current.add(stroke.id); liveRef.current.delete(stroke.id);
            const list = strokesByPageRef.current.get(pageNumber) || [];
            const isNewStroke = !list.some((s) => s.id === stroke.id);
            if (isNewStroke) list.push(stroke);
            strokesByPageRef.current.set(pageNumber, list);
            if (isNewStroke && pageNumber === slideRef.current) renderStroke(stroke);
            return;
          }
        });
        await room.connect(data.livekit_url, data.livekit_token);
        if (disposedRef.current) { room.disconnect(); if (roomRef.current === room) roomRef.current = null; return; }
        setStatus("Live"); reattachTracks(); connectWebSocket();
      } catch (error) { if (!disposedRef.current) { if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; } setStatus(error.response?.data?.detail || error.message || "Unable to join classroom"); reconnectTimer = setTimeout(connectLiveKit, 3500); } }
    };
    connectLiveKit();
    return () => { disposedRef.current = true; clearTimeout(reconnectTimer); clearTimeout(snapshotTimerRef.current); clearInterval(reliableStrokeTimerRef.current); roomRef.current?.disconnect(); roomRef.current = null; };
  }, [sessionId, user, wsUrl, isTeacher, navigate, redraw, renderStroke, currentStrokes]);
  const sendMessage = (event) => { event.preventDefault(); const text = message.trim(); if (!text) return; send({ type: "chat", message_text: text }); setChat((items) => [...items, { mine: true, text }]); setMessage(""); };
  const setPermission = (permission, granted) => { if (!studentId) return setNotice("Waiting for the student to join."); send({ type: "permission_update", target_user_id: studentId, permission, granted }); };
  const endClass = async () => { if (!isTeacher || ending) return; setEnding(true); try { const { data } = await api.post(`/classroom/sessions/${sessionId}/end`); if (data?.pdf_url) setNotesUrl(data.pdf_url); } catch (error) { setEnding(false); setNotice(error.response?.data?.detail || "Could not end class."); } };
  const controlsAllowed = timer !== null && timer <= 300;
  const videoControl = (kind, active, label) => <button type="button" title={label} aria-label={label} onClick={() => media(kind)} className={`classroom-video-control ${active ? "active" : ""}`}>{kind === "mic" ? (active ? "🎙" : "🔇") : kind === "camera" ? (active ? "▣" : "▢") : "↗"}</button>;
  return <div className="dexmy-classroom-shell h-[100dvh] w-full overflow-hidden bg-[#0b1020] text-white flex flex-col select-none">
    <div className="classroom-mobile-orientation"><div><strong>Rotate your device</strong><span>Dexmy Classroom is optimized for landscape mode on mobile.</span></div></div>
    <header className="h-14 shrink-0 px-4 border-b border-white/10 bg-[#111827] flex items-center justify-between"><div className="flex items-center gap-2 min-w-0"><b className="truncate">{classTitle}</b><span className="classroom-secure-badge">● Secure</span></div><div className="flex items-center gap-2 text-xs text-slate-400">{timer !== null && <span className="classroom-timer-badge font-mono">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>}{isTeacher && controlsAllowed && <><button onClick={() => send({ type: "extend_class" })} className="classroom-header-action">+5 min</button><button onClick={endClass} disabled={ending} className="classroom-header-action classroom-header-end">{ending ? "Ending…" : "End class"}</button></>}</div></header>
    <main className="flex-1 min-h-0 flex overflow-hidden"><section className="flex-1 min-w-0 flex flex-col">
      <div className="h-12 shrink-0 px-2 flex items-center gap-1 border-b border-white/10 bg-[#0f172a] overflow-x-auto">{TOOLS.map(([id, label]) => <button key={id} disabled={!canAnnotate} onClick={() => setTool(id)} className={`px-2.5 py-1.5 rounded text-[11px] shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${tool === id ? "bg-red-600" : "bg-white/5"}`}>{label}</button>)}<button disabled={!isTeacher} onClick={undo} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">Undo</button><button disabled={!isTeacher} onClick={clearBoard} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">Clear</button><button onClick={() => setGrid((v) => !v)} className="px-2.5 py-1.5 bg-white/5 rounded text-[11px]">Grid</button>{isTeacher && <label className="px-3 py-1.5 bg-white/5 rounded text-[11px] cursor-pointer">{pdfLoading ? "Importing…" : "Upload PDF"}<input hidden type="file" accept="application/pdf,.pdf" disabled={pdfLoading} onChange={(e) => { uploadPdf(e.target.files?.[0]); e.target.value = ""; }} /></label>}<button disabled={!isTeacher} onClick={addSlide} className="px-3 py-1.5 bg-white/5 rounded text-[11px] disabled:opacity-40">＋ Slide</button>{isTeacher && <button onClick={() => setShowPermissions((v) => !v)} className={`px-3 py-1.5 rounded text-[11px] ${showPermissions ? "bg-red-600" : "bg-white/5"}`}>Permissions</button>}<input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={!canAnnotate} className="w-7 h-7 ml-auto disabled:opacity-40" /><input type="range" min="1" max="18" value={width} onChange={(e) => setWidth(Number(e.target.value))} disabled={!canAnnotate} className="w-20 disabled:opacity-40" /></div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-[#070b16]"><div className="relative w-full max-w-[calc(100vh*1.777)] max-h-full aspect-video rounded-xl overflow-hidden bg-white shadow-2xl classroom-whiteboard-frame"><canvas ref={canvasRef} width={W} height={H} className={`absolute inset-0 w-full h-full touch-none ${!canAnnotate ? "cursor-default" : "cursor-crosshair"}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} /><div className="absolute inset-0 z-10 pointer-events-none"><div className="absolute left-[30px] top-[18px] font-bold text-[24px] text-[#111827] opacity-90">DEXMY</div><div className="absolute right-[30px] bottom-[18px] text-[18px] text-[#64748c] opacity-50">{email}</div></div>{slides.length > 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/70 rounded-xl px-2 py-1.5"><button disabled={!isTeacher} onClick={() => changeSlide(slide - 1)} className="disabled:opacity-40">‹</button><span className="text-xs px-2">Slide {slide}/{slides.length}</span><button disabled={!isTeacher} onClick={() => changeSlide(slide + 1)} className="disabled:opacity-40">›</button></div>}{pdfLoading && <div className="absolute inset-0 z-30 grid place-items-center bg-black/55"><div className="bg-[#111827] rounded-2xl p-6">Importing PDF slides…</div></div>}</div></div>
      <div className="h-24 shrink-0 p-2 border-t border-white/10 bg-[#0f172a] overflow-y-auto">{chat.map((m, i) => <div key={i} className={`text-xs mb-1 ${m.mine ? "text-right" : "text-left"}`}><span className="inline-block rounded px-2 py-1 bg-white/5">{m.text}{m.file_url && <a href={m.file_url} target="_blank" rel="noreferrer" className="ml-2 underline">{m.file_name || "File"}</a>}</span></div>)}<form onSubmit={sendMessage} className="flex gap-2 mt-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" className="flex-1 bg-black/20 rounded px-2 py-1 text-xs outline-none" /><label className="px-2 py-1 rounded bg-white/5 text-xs cursor-pointer">📎<input hidden type="file" onChange={(e) => { uploadChatFile(e.target.files?.[0]); e.target.value = ""; }} /></label><button className="px-3 py-1 rounded bg-red-600 text-xs">Send</button></form></div>
    </section>
    <aside className="w-72 shrink-0 border-l border-white/10 bg-[#111827] p-2 flex flex-col gap-2"><div className="relative aspect-video rounded-lg overflow-hidden bg-black"><div id="local-video" className="absolute inset-0" />{isTeacher && <div id="remote-video" className="absolute right-2 bottom-2 w-28 h-20 rounded-md overflow-hidden border border-white/20 bg-black" />}</div>{!isTeacher && <div className="relative aspect-video rounded-lg overflow-hidden bg-black"><div id="local-video" className="absolute inset-0" /></div>}<div className="text-xs text-slate-300">{isTeacher ? `Student: ${peerName || "Waiting…"}` : `Teacher: ${peerName || "Connecting…"}`}</div><div className="flex gap-2">{videoControl("mic", mic, "Microphone")}{videoControl("camera", camera, "Camera")}{videoControl("screen", screen, "Screen share")}</div>{isTeacher && showPermissions && <div className="rounded-lg bg-black/20 p-2 text-xs space-y-2"><b>Student permissions</b>{[["mic", "Microphone"], ["camera", "Camera"], ["annotate", "Annotate"], ["screen_share", "Screen share"]].map(([key, label]) => <label key={key} className="flex items-center justify-between"><span>{label}</span><input type="checkbox" checked={!!permissions[key]} onChange={(e) => setPermission(key, e.target.checked)} /></label>)}</div>}<div className="mt-auto text-[11px] text-slate-400">{status}{notice && <div className="mt-1 text-amber-300">{notice}</div>}</div></aside></main>
    {backPrompt && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70"><div className="bg-[#111827] rounded-2xl p-6 w-[min(92vw,420px)]"><h3 className="text-lg font-semibold">Leave classroom?</h3><p className="text-sm text-slate-300 mt-2">The class is still in progress. Are you sure you want to leave?</p><div className="flex justify-end gap-2 mt-5"><button onClick={() => setBackPrompt(false)} className="px-4 py-2 rounded bg-white/5">Stay</button><button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded bg-red-600">Leave</button></div></div></div>}
    {notesUrl && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70"><div className="bg-[#111827] rounded-2xl p-6 w-[min(92vw,420px)]"><h3 className="text-lg font-semibold">Class notes are ready</h3><a href={notesUrl} target="_blank" rel="noreferrer" className="inline-block mt-4 px-4 py-2 rounded bg-red-600">Open notes</a></div></div>}
  </div>;
}
