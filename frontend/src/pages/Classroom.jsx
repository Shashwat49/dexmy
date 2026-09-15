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
const makeWhiteboardPage = (page_number = 1) => ({ page_id: newId(), page_number, page_type: "whiteboard", image_url: null });
const normalizePages = (pages) => (pages?.length ? pages : [makeWhiteboardPage(1)]).map((p,i) => ({ ...p, page_id: p.page_id || newId(), page_number: i+1, page_type: p.page_type || (p.image_url ? "pdf" : "whiteboard") }));

export default function Classroom() {
  const { user } = useAuth(); const { sessionId } = useParams(); const navigate = useNavigate();
  const isTeacher = user?.role === "teacher"; const email = user?.email || "";
  const canvasRef = useRef(null), wsRef = useRef(null), roomRef = useRef(null), drawRef = useRef(null), drawBaseRef = useRef(null);
  const slidesRef = useRef([makeWhiteboardPage(1)]), strokesByPageRef = useRef(new Map()), slideRef = useRef(1);
  const liveRef = useRef(new Map()), committedRef = useRef(new Set()), pendingLiveRef = useRef(null), snapshotTimerRef = useRef(null), disposedRef = useRef(false), imageCacheRef = useRef(new Map()), reliableStrokeTimerRef = useRef(null), slideControlActiveRef = useRef(false);
  const mediaBusyRef = useRef(false);
  const micStateRef = useRef(false);
  const cameraStateRef = useRef(false);
  const gridRef = useRef(false);
  const [status, setStatus] = useState("Connecting…"), [notice, setNotice] = useState(""), [tool, setTool] = useState("pen"), [color, setColor] = useState("#111827"), [width, setWidth] = useState(3), [grid, setGrid] = useState(false);
  const [slides, setSlides] = useState(() => [makeWhiteboardPage(1)]), [slide, setSlide] = useState(1), [chat, setChat] = useState([]), [message, setMessage] = useState("");
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
  const currentPageId = useCallback((n = slideRef.current) => slidesRef.current[n - 1]?.page_id || null, []);
  const strokesFor = useCallback((n = slideRef.current) => strokesByPageRef.current.get(currentPageId(n)) || [], [currentPageId]);
  const currentStrokes = useCallback(() => strokesFor(), [strokesFor]);
  const renderStroke = useCallback((s, record = false) => { const ctx = canvasRef.current?.getContext("2d"); if (!ctx || !s?.points?.length) return; const a = s.points[0], b = s.points[s.points.length - 1]; ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = s.tool === "eraser" ? "#fff" : s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width; ctx.globalAlpha = s.tool === "highlighter" ? 0.24 : 1; if (["pen", "highlighter", "eraser"].includes(s.tool)) { ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); } else if (s.tool === "line") { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } else if (s.tool === "arrow") { const angle = Math.atan2(b.y - a.y, b.x - a.x), head = 16 + s.width * 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6)); ctx.stroke(); } else if (s.tool === "rect") ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); else if (s.tool === "circle") { ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke(); } else if (s.tool === "text") { ctx.globalAlpha = 1; ctx.font = `${Math.max(18, s.width * 6)}px sans-serif`; ctx.fillText(s.text || "Text", a.x, a.y); } else if (s.tool === "sticky") { ctx.globalAlpha = 0.92; ctx.fillStyle = "#fff7a8"; ctx.fillRect(a.x, a.y, Math.max(160, b.x - a.x), Math.max(100, b.y - a.y)); ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.font = "20px sans-serif"; String(s.text || "Note").split("\n").forEach((line, i) => ctx.fillText(line.slice(0, 45), a.x + 12, a.y + 28 + i * 24)); } ctx.restore(); if (record) { const list = currentStrokes(); if (!list.some((x) => x.id === s.id)) list.push(s); } }, [currentStrokes]);
  const drawOverlay = useCallback((ctx) => { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#64748c"; ctx.font = "18px sans-serif"; ctx.textAlign = "right"; ctx.fillText(email, W - 30, H - 25); ctx.globalAlpha = 0.9; ctx.textAlign = "left"; ctx.fillStyle = "#111827"; ctx.font = "bold 24px sans-serif"; ctx.fillText("DEXMY", 30, 40); ctx.restore(); }, [email]);
  const redraw = useCallback(async () => { const canvas = canvasRef.current; if (!canvas) return; const pageAtStart = slideRef.current; const ctx = canvas.getContext("2d"); const bg = slidesRef.current[pageAtStart - 1]?.image_url; ctx.clearRect(0, 0, W, H); if (!bg) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); } if (pageAtStart !== slideRef.current) return; if (gridRef.current) { ctx.save(); ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } ctx.restore(); } (strokesByPageRef.current.get(currentPageId(pageAtStart)) || []).forEach((s) => renderStroke(s)); liveRef.current.forEach((s) => { if (s.page_id === currentPageId(pageAtStart) || (s.page_id == null && s.page_number === pageAtStart)) renderStroke(s); }); drawOverlay(ctx); }, [renderStroke, drawOverlay, currentPageId]);
  useEffect(() => { redraw(); }, [slide, slides, grid, redraw]);
  useEffect(() => {
    const id = requestAnimationFrame(() => { redraw(); });
    return () => cancelAnimationFrame(id);
  }, [screen, redraw]);
  const saveSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(async () => { const pageNumber = slideRef.current; const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: strokesFor(pageNumber).map((s) => ({ ...s })) }, image_base64: imageBase64, page_id: currentPageId(pageNumber) }); }, 500); }, [send, strokesFor, currentPageId]);
  const saveSnapshotNow = useCallback((pageNumber) => { clearTimeout(snapshotTimerRef.current); const imageBase64 = canvasRef.current?.toDataURL("image/png"); send({ type: "save_snapshot", page_number: pageNumber, canvas_json: { strokes: strokesFor(pageNumber).map((s) => ({ ...s })) }, image_base64: imageBase64, page_id: currentPageId(pageNumber) }); }, [send, strokesFor, currentPageId]);
  const publishLive = useCallback((stroke, points, pageNumber, final = false) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected" || !Array.isArray(points) || !points.length) return; const packet = { type: "whiteboard_live", payload: { stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width, points }, page_number: pageNumber, page_id: currentPageId(pageNumber), final } }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: false, topic: LIVE_TOPIC }).catch(() => {}); }, []);
  const publishCommit = useCallback((stroke, pageNumber) => { const room = roomRef.current; const participant = room?.localParticipant; if (!participant || room.state !== "connected") return; const packet = { type: "whiteboard_commit", stroke, page_number: pageNumber, page_id: currentPageId(pageNumber) }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const publishStrokeCheckpoint = useCallback(() => { const d = drawRef.current; const room = roomRef.current; const participant = room?.localParticipant; if (!d || !participant || room.state !== "connected" || !d.points?.length || !["pen", "highlighter", "eraser"].includes(d.tool)) return; const packet = { type: "whiteboard_checkpoint", stroke: { ...d, points: d.points.slice() }, page_number: slideRef.current, page_id: currentPageId() }; participant.publishData(encoder.encode(JSON.stringify(packet)), { reliable: true, topic: COMMIT_TOPIC }).catch(() => {}); }, []);
  const queueLive = useCallback((stroke, points, final = false) => { const pending = pendingLiveRef.current; const isShape = ["line", "arrow", "rect", "circle", "text", "sticky"].includes(stroke.tool); if (pending?.id === stroke.id) { if (isShape) pending.points = points.slice(-2); else pending.points.push(...points); pending.final = final; } else pendingLiveRef.current = { id: stroke.id, stroke: { id: stroke.id, tool: stroke.tool, color: stroke.color, width: stroke.width }, points: [...points], page_number: slideRef.current, page_id: currentPageId(), final }; }, []);
  const flushLive = useCallback((force = false) => { const pending = pendingLiveRef.current; if (!pending || (!force && !pending.points.length)) return; const points = pending.points.splice(0, 32); if (!points.length) return; publishLive(pending.stroke, points, pending.page_number, pending.final && pending.points.length === 0); if (!pending.points.length) pendingLiveRef.current = null; }, [publishLive]);
  useEffect(() => { let rafId; const tick = () => { flushLive(false); rafId = requestAnimationFrame(tick); }; rafId = requestAnimationFrame(tick); return () => { cancelAnimationFrame(rafId); flushLive(true); clearTimeout(snapshotTimerRef.current); clearTimeout(reliableStrokeTimerRef.current); }; }, [flushLive]);
  useEffect(() => { if (!isTeacher) return; const id = setInterval(() => { if (drawRef.current?.points?.length) publishStrokeCheckpoint(); }, 250); reliableStrokeTimerRef.current = id; return () => clearInterval(id); }, [isTeacher, publishStrokeCheckpoint]);
  const point = (event) => { const r = canvasRef.current.getBoundingClientRect(); return { x: clamp((event.clientX - r.left) * W / r.width, 0, W), y: clamp((event.clientY - r.top) * H / r.height, 0, H) }; };
  const onPointerDown = (event) => { if (!canAnnotate) return setNotice("The teacher has not enabled annotation for you."); const p = point(event); if (tool === "select" || !DRAW_TOOLS.has(tool)) return; const ctx = canvasRef.current?.getContext("2d"); drawBaseRef.current = ctx?.getImageData(0, 0, W, H) || null; drawRef.current = { id: newId(), tool, color, width, points: [p] }; canvasRef.current.setPointerCapture(event.pointerId); if (["pen", "highlighter", "eraser"].includes(tool)) queueLive(drawRef.current, [p]); };
  const onPointerMove = (event) => { const d = drawRef.current; if (!d) return; d.points.push(point(event)); if (["pen", "highlighter", "eraser"].includes(d.tool)) { const n = d.points.length; renderStroke({ ...d, points: [d.points[n - 2], d.points[n - 1]] }); queueLive(d, [d.points[n - 1]]); } else { const ctx = canvasRef.current?.getContext("2d"); if (ctx && drawBaseRef.current) ctx.putImageData(drawBaseRef.current, 0, 0); renderStroke(d); queueLive(d, [d.points[0], d.points[d.points.length - 1]]); } };
  const onPointerUp = (event) => { const d = drawRef.current; drawRef.current = null; canvasRef.current?.releasePointerCapture?.(event.pointerId); if (!d) return; if (["text", "sticky"].includes(d.tool)) { const text = window.prompt(d.tool === "sticky" ? "Sticky note text" : "Text"); if (!text) { redraw(); return; } d.text = text; if (d.tool === "text") d.points = [d.points[0]]; } const pageNumber = slideRef.current; const pageId = currentPageId(pageNumber); if (!["pen", "highlighter", "eraser"].includes(d.tool)) { if (drawBaseRef.current) canvasRef.current?.getContext("2d")?.putImageData(drawBaseRef.current, 0, 0); queueLive(d, d.points, true); flushLive(true); } else { queueLive(d, [], true); flushLive(true); } renderStroke(d, true); drawBaseRef.current = null; publishCommit(d, pageNumber); send({ type: "whiteboard_event", payload: { kind: "stroke", stroke: d, page_number: pageNumber, page_id: pageId } }); saveSnapshot(); };
  const changeSlide = (target) => { if (!isTeacher) return; const current = slideRef.current; const next = clamp(target, 1, slidesRef.current.length); if (next === current) return; saveSnapshotNow(current); slideControlActiveRef.current = true; slideRef.current = next; setSlide(next); strokesByPageRef.current.set(currentPageId(next), strokesByPageRef.current.get(currentPageId(next)) || []); publishControl({ kind: "page", page_number: next, page_id: currentPageId(next) }); };
  const addSlide = () => { if (!isTeacher) return; const current = slideRef.current; saveSnapshotNow(current); const next = slidesRef.current.length + 1; const newPage = makeWhiteboardPage(next); strokesByPageRef.current.set(newPage.page_id, []); const updated = [...slidesRef.current, newPage]; slidesRef.current = updated; setSlides(updated); slideRef.current = next; setSlide(next); slideControlActiveRef.current = true; publishControl({ kind: "slides", pages: updated, page_number: next, page_id: newPage.page_id }); };
  const undo = () => { if (!isTeacher) return; const list = currentStrokes(); if (!list.length) return; list.pop(); redraw(); send({ type: "whiteboard_event", payload: { kind: "undo", page_number: slideRef.current, page_id: currentPageId() } }); saveSnapshot(); };
  const clearBoard = () => { if (!isTeacher) return; strokesByPageRef.current.set(currentPageId(), []); redraw(); send({ type: "whiteboard_event", payload: { kind: "clear", page_number: slideRef.current, page_id: currentPageId() } }); saveSnapshot(); };
  const uploadPdf = async (file) => { if (!isTeacher || !file) return; if (file.size > 30 * 1024 * 1024) return setNotice("PDFs are limited to 30 MB."); if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setNotice("Please select a PDF file."); setPdfLoading(true); try { const form = new FormData(); form.append("file", file); const afterPageId = currentPageId(); const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf?after_page_id=${encodeURIComponent(afterPageId || "")}`, form); const next = normalizePages(data.pages); const firstInserted = next.findIndex((p) => data.inserted_page_ids?.includes(p.page_id)); const insertedPage = firstInserted >= 0 ? firstInserted + 1 : slideRef.current; slidesRef.current = next; setSlides(next); strokesByPageRef.current = new Map(next.map((p) => [p.page_id, strokesByPageRef.current.get(p.page_id) || []])); slideRef.current = insertedPage; setSlide(insertedPage); slideControlActiveRef.current = true; publishControl({ kind: "slides", pages: next, page_number: insertedPage, page_id: next[insertedPage - 1]?.page_id }); setNotice(`${data.inserted_count} PDF page${data.inserted_count === 1 ? "" : "s"} inserted after the current page.`); } catch (error) { setNotice(error.response?.data?.detail || "PDF upload failed."); } finally { setPdfLoading(false); } };
  const uploadChatFile = async (file) => { if (!file) return; if (file.size > 20 * 1024 * 1024) return setNotice("Chat files are limited to 20 MB."); try { const form = new FormData(); form.append("file", file); const { data } = await api.post(`/classroom/sessions/${sessionId}/chat-file`, form); send({ type: "chat", file_url: data.file_url, file_name: data.file_name, message_text: "" }); setChat((items) => [...items, { mine: true, file_url: data.file_url, file_name: data.file_name }]); } catch (error) { setNotice(error.response?.data?.detail || "Upload failed."); } };
  const media = async (kind) => { const participant = roomRef.current?.localParticipant; if (!participant || mediaBusyRef.current) return; if (kind === "mic" && !isTeacher && !permissions.mic) return setNotice("Microphone permission is disabled."); if (kind === "camera" && !isTeacher && !permissions.camera) return setNotice("Camera permission is disabled."); if (kind === "screen" && !isTeacher && !permissions.screen_share) return setNotice("Screen sharing is disabled."); mediaBusyRef.current = true; try { if (kind === "mic") { const publication = participant.getTrackPublication?.(Track.Source.Microphone); const next = !(publication?.track && !publication.isMuted); await participant.setMicrophoneEnabled(next); micStateRef.current = next; setMic(next); } else if (kind === "camera") { const publication = participant.getTrackPublication?.(Track.Source.Camera); const next = !(publication?.track && !publication.isMuted); await participant.setCameraEnabled(next); cameraStateRef.current = next; setCamera(next); } else if (kind === "screen") { const publication = participant.getTrackPublication?.(Track.Source.ScreenShare); const next = !(publication?.track && !publication.isMuted); await participant.setScreenShareEnabled(next, { contentHint: "detail", selfBrowserSurface: "exclude" }); setScreen(next); } } catch (error) { if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") setNotice("Camera/microphone access was blocked. Please allow the device permission in your browser and try again."); else setNotice(error?.message || "Could not change media."); } finally { mediaBusyRef.current = false; } };
  useEffect(() => {
    if (!sessionId || !user || !wsUrl) return;
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
        if (msg.type === "pdf_pages_ready") {
          if (slideControlActiveRef.current) return;
          const p = normalizePages(msg.pages);
          slidesRef.current = p;
          setSlides(p);
          slideRef.current = 1;
          setSlide(1);
          strokesByPageRef.current = new Map(normalizePages(p).map((x) => [x.page_id, []]));
        }
        if (msg.type === "whiteboard_state") {
          if (slideControlActiveRef.current) return;
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
          if (p.kind === "page" || p.kind === "slides" || p.kind === "pdf") return;
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
            slidesRef.current = next;
            setSlides(next);
            const nextPage = clamp(Number(p.page_number) || 1, 1, next.length);
            slideRef.current = nextPage;
            setSlide(nextPage);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_id, strokesByPageRef.current.get(x.page_id) || []]));
            redraw();
          }
          if (p.kind === "pdf") {
            const next = normalizePages(p.pages);
            slidesRef.current = next;
            setSlides(next);
            slideRef.current = 1;
            setSlide(1);
            strokesByPageRef.current = new Map(next.map((x) => [x.page_number, []]));
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
          else if (publication.source === Track.Source.ScreenShare) setScreen(false);
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => detachMedia(track));
        room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
          if (!participant || !topic) return;
          let msg;
          try { msg = JSON.parse(decoder.decode(payload)); } catch { return; }
          if (msg.type === "classroom_control" && topic === CONTROL_TOPIC) {
            const p = msg.payload || {};
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
            const list = strokesByPageRef.current.get(pageNumber) || [];
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
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-[#070b16]"><div className="relative w-full max-w-[calc(100vh*1.777)] max-h-full aspect-video rounded-xl overflow-hidden bg-white shadow-2xl classroom-whiteboard-frame">{slides[slide - 1]?.image_url && <img src={slides[slide - 1].image_url} alt="PDF page" className="absolute inset-0 w-full h-full object-contain pointer-events-none" /> }<canvas ref={canvasRef} width={W} height={H} className={`absolute inset-0 w-full h-full touch-none ${!canAnnotate ? "cursor-default" : "cursor-crosshair"}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} /><div className="absolute inset-0 z-10 pointer-events-none"><div className="absolute left-[30px] top-[18px] font-bold text-[24px] text-[#111827] opacity-90">DEXMY</div><div className="absolute right-[30px] bottom-[18px] text-[18px] text-[#64748c] opacity-50">{email}</div></div>{slides.length > 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/70 rounded-xl px-2 py-1.5"><button disabled={!isTeacher} onClick={() => changeSlide(slide - 1)} className="disabled:opacity-40">‹</button><span className="text-xs px-2">Slide {slide}/{slides.length}</span><button disabled={!isTeacher} onClick={() => changeSlide(slide + 1)} className="disabled:opacity-40">›</button></div>}{pdfLoading && <div className="absolute inset-0 z-30 grid place-items-center bg-black/55"><div className="bg-[#111827] rounded-2xl p-6">Importing PDF slides…</div></div>}</div></div>
      <div className="h-16 shrink-0 border-t border-white/10 bg-[#111827] flex items-center justify-center gap-2 classroom-legacy-controls"><button onClick={() => media("mic")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{mic ? "Mute" : "Mic"}</button><button onClick={() => media("camera")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{camera ? "Camera off" : "Camera"}</button><button onClick={() => media("screen")} className="h-10 px-4 rounded-full bg-white/10 text-xs">{screen ? "Stop sharing" : "Share screen"}</button></div>
    </section>
    <aside className="classroom-side-panel border-l border-white/10 bg-[#0f172a]"><div className="h-14 shrink-0 px-3 border-b border-white/10 flex items-center text-sm font-semibold">{peerName || (isTeacher ? "Dexmy Student" : "Dexmy Tutor")}</div><div className="classroom-video-stack"><div className="classroom-video"><span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-[10px]">Teacher</span><div id="local-video" className="absolute inset-0" /><div className="classroom-video-controls-left">{isTeacher && videoControl("mic", mic, "Teacher microphone")}</div>{isTeacher && <div className="classroom-video-controls-right">{videoControl("camera", camera, "Teacher camera")}{videoControl("screen", screen, "Teacher screen share")}</div>}</div><div className="classroom-video"><span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-[10px]">Student</span><div id="remote-video" className="absolute inset-0" />{!isTeacher && <><div className="classroom-video-controls-left">{videoControl("mic", mic, "Student microphone")}</div><div className="classroom-video-controls-right">{videoControl("camera", camera, "Student camera")}{videoControl("screen", screen, "Student screen share")}</div></>}{isTeacher && <div className="classroom-student-permission-indicators"><span className={permissions.mic ? "allowed" : "blocked"}>🎙</span><span className={permissions.camera ? "allowed" : "blocked"}>▣</span></div>}</div><div id="remote-screen" className="hidden" /><div id="local-screen" className="hidden" /><div id="remote-audio" className="hidden" /><div id="local-audio" className="hidden" /></div>{isTeacher && showPermissions && <div className="classroom-permissions-popover"><div className="text-xs font-semibold mb-2">Student permissions</div><div className="grid grid-cols-2 gap-1.5">{[["annotate", "Annotate"], ["screen_share", "Share screen"]].map(([key, label]) => <button key={key} onClick={() => setPermission(key, !permissions[key])} className={`px-2 py-2 rounded text-[10px] ${permissions[key] ? "bg-emerald-600/80" : "bg-white/5"}`}>{permissions[key] ? "✓ " : "✕ "}{label}</button>)}</div></div>}<div className="classroom-chat"><div className="classroom-chat-messages">{chat.length === 0 && <div className="h-full grid place-items-center text-xs text-slate-600">No messages yet</div>}{chat.map((item, i) => <div key={i} className={`flex mb-2 ${item.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs ${item.mine ? "bg-red-600" : "bg-white/10"}`}>{item.file_url ? <a href={item.file_url} target="_blank" rel="noreferrer" className="underline">{item.file_name || "Open file"}</a> : item.text}</div></div>)}</div><form onSubmit={sendMessage} className="classroom-chat-form p-2 border-t border-white/10 flex gap-2"><label className="h-9 w-9 grid place-items-center bg-white/5 rounded cursor-pointer">＋<input hidden type="file" onChange={(e) => { uploadChatFile(e.target.files?.[0]); e.target.value = ""; }} /></label><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" className="flex-1 h-9 bg-white/5 rounded px-3 text-xs" /><button className="h-9 px-3 bg-red-600 rounded text-xs">Send</button></form></div></aside></main>
    {notice && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-4 py-2 rounded-xl text-xs">{notice}</div>}
    {ending && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80"><div className="bg-[#111827] rounded-2xl p-8 text-center"><div className="text-lg font-semibold">Class ended</div>{notesUrl && <a href={notesUrl} target="_blank" rel="noreferrer" className="text-red-400 text-sm underline mt-2 inline-block">Download notes</a>}</div></div>}
    {backPrompt && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70"><div className="bg-[#111827] rounded-2xl p-6 text-center"><div className="font-semibold">Leave classroom?</div><div className="text-xs text-slate-400 mt-2">The class is still in progress.</div><div className="flex gap-2 justify-center mt-4"><button onClick={() => setBackPrompt(false)} className="px-4 py-2 bg-white/10 rounded">Stay</button><button onClick={() => navigate("/dashboard")} className="px-4 py-2 bg-red-600 rounded">Leave</button></div></div></div>}
  </div>;
}
