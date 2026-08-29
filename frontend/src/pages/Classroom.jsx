import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const TOOLS = ["select", "pen", "highlighter", "line", "arrow", "rect", "circle", "text", "sticky", "eraser"];
const MAX_CHAT_FILE = 20 * 1024 * 1024;
const MAX_PDF = 30 * 1024 * 1024;
const CANVAS_W = 1600;
const CANVAS_H = 900;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function Classroom() {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const roomRef = useRef(null);
  const drawingRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const pageRef = useRef(1);
  const pagesRef = useRef([]);
  const snapshotTimerRef = useRef(null);
  const disposedRef = useRef(false);
  const [status, setStatus] = useState("Connecting…");
  const [notice, setNotice] = useState("");
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(false);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(1);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [timer, setTimer] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [permissions, setPermissions] = useState({ screen_share: false, annotate: false, mic: true, camera: true });
  const [chatOpen, setChatOpen] = useState(true);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL;
    if (!base || !sessionId) return null;
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${u.origin}/ws/classroom/${sessionId}`;
  }, [sessionId]);

  const sendWS = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  }, []);

  const renderStroke = useCallback((s, record = true) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !s?.points?.length) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = s.tool === "eraser" ? "#fff" : s.color; ctx.fillStyle = s.color;
    ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width;
    ctx.globalAlpha = s.tool === "highlighter" ? 0.25 : 1;
    const a = s.points[0]; const b = s.points[s.points.length - 1];
    if (["pen", "highlighter", "eraser"].includes(s.tool)) {
      ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    } else if (s.tool === "line") {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (s.tool === "arrow") {
      const angle = Math.atan2(b.y - a.y, b.x - a.x); const head = 16 + s.width * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6)); ctx.stroke();
    } else if (s.tool === "rect") {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (s.tool === "circle") {
      const radius = Math.hypot(b.x - a.x, b.y - a.y); ctx.beginPath(); ctx.arc(a.x, a.y, radius, 0, Math.PI * 2); ctx.stroke();
    } else if (s.tool === "text") {
      ctx.globalAlpha = 1; ctx.font = `${Math.max(16, s.width * 6)}px sans-serif`; ctx.fillText(s.text || "Text", a.x, a.y);
    } else if (s.tool === "sticky") {
      ctx.globalAlpha = 0.92; ctx.fillStyle = "#fff7a8"; ctx.fillRect(a.x, a.y, Math.max(160, b.x - a.x), Math.max(100, b.y - a.y));
      ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.font = "20px sans-serif";
      String(s.text || "Note").split("\n").forEach((line, i) => ctx.fillText(line.slice(0, 45), a.x + 12, a.y + 28 + i * 24));
    }
    ctx.restore();
    if (record) { historyRef.current.push(s); redoRef.current = []; }
  }, []);

  const drawBackground = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const current = pagesRef.current[pageRef.current - 1];
    if (current?.image_url) {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height); const w = img.width * scale, h = img.height * scale; ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h); historyRef.current.forEach((s) => renderStroke(s, false)); };
      img.src = current.image_url;
    } else historyRef.current.forEach((s) => renderStroke(s, false));
  }, [renderStroke]);

  useEffect(() => { drawBackground(); }, [page, pages, drawBackground]);

  const redraw = useCallback(() => drawBackground(), [drawBackground]);
  const point = (event) => { const r = canvasRef.current.getBoundingClientRect(); return { x: clamp((event.clientX - r.left) * CANVAS_W / r.width, 0, CANVAS_W), y: clamp((event.clientY - r.top) * CANVAS_H / r.height, 0, CANVAS_H) }; };
  const queueSnapshot = useCallback(() => { clearTimeout(snapshotTimerRef.current); snapshotTimerRef.current = setTimeout(() => sendWS({ type: "save_snapshot", page_number: pageRef.current, canvas_json: { strokes: historyRef.current } }), 900); }, [sendWS]);

  const onPointerDown = (event) => {
    if (tool === "select") return;
    if (!isTeacher && !permissions.annotate) return setNotice("The teacher has not enabled annotation for you.");
    drawingRef.current = { tool, color, width, points: [point(event)] }; canvasRef.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => { if (!drawingRef.current) return; drawingRef.current.points.push(point(event)); redraw(); renderStroke(drawingRef.current, false); };
  const onPointerUp = (event) => {
    const stroke = drawingRef.current; drawingRef.current = null; if (!stroke) return;
    if (["text", "sticky"].includes(stroke.tool)) { const text = window.prompt(stroke.tool === "sticky" ? "Sticky note text" : "Text"); if (!text) return; stroke.text = text; if (stroke.tool === "text") stroke.points = [stroke.points[0]]; }
    renderStroke(stroke, true); sendWS({ type: "whiteboard_event", payload: { kind: "stroke", stroke, page_number: pageRef.current } }); queueSnapshot(); canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };
  const undo = () => { const s = historyRef.current.pop(); if (!s) return; redoRef.current.push(s); redraw(); sendWS({ type: "whiteboard_event", payload: { kind: "undo", page_number: pageRef.current } }); queueSnapshot(); };
  const redo = () => { const s = redoRef.current.pop(); if (!s) return; renderStroke(s, true); sendWS({ type: "whiteboard_event", payload: { kind: "stroke", stroke: s, page_number: pageRef.current } }); queueSnapshot(); };
  const clearBoard = () => { historyRef.current = []; redoRef.current = []; redraw(); sendWS({ type: "whiteboard_event", payload: { kind: "clear", page_number: pageRef.current } }); queueSnapshot(); };
  const changePage = (next) => { const target = clamp(next, 1, Math.max(1, pages.length)); setPage(target); sendWS({ type: "whiteboard_event", payload: { kind: "page", page_number: target } }); };

  const toggleMedia = async (kind) => {
    const participant = roomRef.current?.localParticipant; if (!participant) return;
    try {
      if (kind === "mic") { if (!isTeacher && !permissions.mic) return setNotice("Microphone access is disabled by the teacher."); const next = !mic; await participant.setMicrophoneEnabled(next); setMic(next); sendWS({ type: "toggle_av", kind: "mic", enabled: next }); }
      if (kind === "camera") { if (!isTeacher && !permissions.camera) return setNotice("Camera access is disabled by the teacher."); const next = !camera; await participant.setCameraEnabled(next); setCamera(next); sendWS({ type: "toggle_av", kind: "camera", enabled: next }); }
      if (kind === "screen") { if (!isTeacher && !permissions.screen_share) return setNotice("The teacher has not enabled screen sharing for you."); const next = !screen; await participant.setScreenShareEnabled(next, { contentHint: "detail", selfBrowserSurface: "exclude" }); setScreen(next); sendWS({ type: "toggle_av", kind: "screen", enabled: next }); }
    } catch (error) { setNotice(error?.message || "Media permission failed."); }
  };

  const attachTrack = useCallback((track, containerId, identity) => { const container = document.getElementById(containerId); if (!container) return; const el = track.attach(); el.autoplay = true; el.playsInline = true; el.dataset.participant = identity; el.className = "w-full h-full object-contain"; container.appendChild(el); }, []);

  useEffect(() => {
    if (!sessionId || !user || !wsUrl) return undefined;
    disposedRef.current = false; let reconnectTimer;
    const connect = async () => {
      try {
        setStatus("Authorizing…");
        const { data } = await api.post("/classroom/join-token", { session_id: sessionId });
        if (disposedRef.current) return;
        const room = new Room({ adaptiveStream: true, dynacast: true }); roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => { if (track.kind === Track.Kind.Video) attachTrack(track, "dexmy-remote-video", participant.identity); if (track.kind === Track.Kind.Audio) attachTrack(track, "dexmy-remote-audio", participant.identity); });
        room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
        room.on(RoomEvent.LocalTrackPublished, (publication) => { if (publication.track?.kind === Track.Kind.Video) attachTrack(publication.track, "dexmy-local-video", user.id); });
        room.on(RoomEvent.ParticipantConnected, () => setNotice("Participant connected.")); room.on(RoomEvent.ParticipantDisconnected, () => setNotice("Participant disconnected.")); room.on(RoomEvent.Disconnected, () => setStatus("Media disconnected — reconnecting…"));
        await room.connect(data.livekit_url, data.livekit_token); setStatus("Live");
        const token = localStorage.getItem("dexmy_token"); const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token || "")}`); wsRef.current = ws;
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "waiting_for_teacher") setStatus("Waiting for teacher…");
          if (msg.type === "admitted" || msg.type === "class_started") { setStatus("Live"); if (msg.deadline) setDeadline(msg.deadline); if (msg.student_id) setStudentId(msg.student_id); }
          if (msg.type === "student_joined") setStudentId(msg.user_id);
          if (msg.type === "teacher_disconnected") setNotice("Teacher connection lost. Please wait for reconnection.");
          if (msg.type === "student_disconnected") setNotice("Student disconnected.");
          if (msg.type === "chat") setChat((items) => [...items, { mine: msg.sender_id === String(user.id), text: msg.message_text || "", file_url: msg.file_url, file_name: msg.file_name, at: new Date().toISOString() }]);
          if (msg.type === "permission_update") { setPermissions((p) => ({ ...p, [msg.permission]: msg.granted })); if (!msg.granted && msg.permission === "screen_share") setScreen(false); if (!msg.granted && msg.permission === "camera") setCamera(false); if (!msg.granted && msg.permission === "mic") setMic(false); }
          if (msg.type === "whiteboard_event") { const p = msg.payload || {}; if (p.kind === "stroke" && p.page_number === pageRef.current) renderStroke(p.stroke, true); if (p.kind === "undo" && p.page_number === pageRef.current) { historyRef.current.pop(); redraw(); } if (p.kind === "clear" && p.page_number === pageRef.current) { historyRef.current = []; redoRef.current = []; redraw(); } if (p.kind === "pdf") { setPages(p.pages || []); setPage(1); } if (p.kind === "page") setPage(p.page_number || 1); }
          if (msg.type === "pdf_pages_ready") { setPages(msg.pages || []); setPage(1); }
          if (msg.type === "whiteboard_state") { historyRef.current = msg.canvas_json?.strokes || []; redoRef.current = []; if (msg.image_url && pagesRef.current.length === 0) setPages([{ page_number: msg.page_number || 1, image_url: msg.image_url }]); setPage(msg.page_number || 1); setTimeout(redraw, 0); }
          if (msg.type === "extend_prompt") setNotice(`Class ends in about ${Math.ceil(msg.seconds_remaining / 60)} minutes.`);
          if (msg.type === "class_extended") { setDeadline(msg.new_deadline); setNotice("Class extended by 5 minutes."); }
          if (msg.type === "permission_denied") setNotice(`Permission denied: ${msg.permission || "action"}.`);
          if (msg.type === "session_ended") { setStatus("Class ended"); setTimeout(() => navigate("/dashboard"), 1800); }
        };
        ws.onclose = () => { if (!disposedRef.current) { setStatus("Classroom connection closed — retrying…"); reconnectTimer = setTimeout(connect, 2000); } };
      } catch (error) { if (!disposedRef.current) { setStatus(error.response?.data?.detail || error.message || "Unable to join classroom"); reconnectTimer = setTimeout(connect, 3000); } }
    };
    connect();
    return () => { disposedRef.current = true; clearTimeout(reconnectTimer); clearTimeout(snapshotTimerRef.current); wsRef.current?.close(); roomRef.current?.disconnect(); roomRef.current = null; };
  }, [sessionId, user, wsUrl, attachTrack, navigate, redraw, renderStroke]);

  useEffect(() => { if (!deadline) return undefined; const tick = () => setTimer(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, [deadline]);

  const sendMessage = (event) => { event.preventDefault(); const text = message.trim(); if (!text) return; sendWS({ type: "chat", message_text: text }); setChat((items) => [...items, { mine: true, text, at: new Date().toISOString() }]); setMessage(""); };
  const uploadChatFile = async (file) => { if (!file) return; if (file.size > MAX_CHAT_FILE) return setNotice("Chat files are limited to 20 MB."); const form = new FormData(); form.append("file", file); try { const { data } = await api.post(`/classroom/sessions/${sessionId}/chat-file`, form); sendWS({ type: "chat", file_url: data.file_url, file_name: data.file_name, message_text: "" }); setChat((items) => [...items, { mine: true, text: "", file_url: data.file_url, file_name: data.file_name, at: new Date().toISOString() }]); } catch (error) { setNotice(error.response?.data?.detail || "Upload failed."); } };
  const uploadPdf = async (file) => { if (!isTeacher || !file) return; if (file.size > MAX_PDF) return setNotice("PDFs are limited to 30 MB."); const form = new FormData(); form.append("file", file); try { const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf`, form); const loaded = data.map((item, i) => ({ page_number: i + 1, image_url: item.file_url })); historyRef.current = []; redoRef.current = []; setPages(loaded); setPage(1); sendWS({ type: "whiteboard_event", payload: { kind: "pdf", pages: loaded } }); setNotice(`${loaded.length} PDF page${loaded.length === 1 ? "" : "s"} loaded.`); } catch (error) { setNotice(error.response?.data?.detail || "PDF upload failed."); } };
  const setPermission = (permission, granted) => { if (!studentId) return setNotice("Waiting for the student to join."); setPermissions((p) => ({ ...p, [permission]: granted })); sendWS({ type: "permission_update", target_user_id: studentId, permission, granted }); };
  const endClass = async () => { if (!isTeacher || !window.confirm("End this class for both participants?")) return; try { await api.post(`/classroom/sessions/${sessionId}/end`); } catch (error) { setNotice(error.response?.data?.detail || "Could not end class."); } };

  if (!sessionId) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Classroom link is incomplete.</div>;
  return <div className="min-h-screen bg-slate-950 text-white flex flex-col">
    <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900 px-3 md:px-5 flex items-center justify-between"><div><div className="font-bold">Dexmy Classroom</div><div className="text-xs text-slate-400">{status} · {isTeacher ? "Teacher" : "Student"}</div></div><div className="flex items-center gap-2 text-xs"><span className="rounded-full bg-emerald-500/10 text-emerald-400 px-2.5 py-1">● Secure</span>{timer !== null && <span className="font-mono">{Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}</span>}</div></header>
    <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 min-h-0 flex flex-col">
        <div className="grid md:grid-cols-[minmax(0,1fr)_250px] gap-2 p-2 bg-slate-950 h-[260px] shrink-0"><div id="dexmy-remote-video" className="relative rounded-xl bg-black overflow-hidden flex items-center justify-center"><span className="absolute top-2 left-2 z-20 rounded bg-black/60 px-2 py-1 text-xs">Participant</span></div><div id="dexmy-local-video" className="relative rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center"><span className="absolute top-2 left-2 z-20 rounded bg-black/60 px-2 py-1 text-xs">You</span><span className="text-xs text-slate-500">Camera off</span></div><div id="dexmy-remote-audio" className="hidden" /></div>
        <div className="px-2 flex flex-wrap items-center gap-1 border-y border-slate-800 bg-slate-900 py-2">{TOOLS.map((item) => <button key={item} onClick={() => setTool(item)} className={`px-2.5 py-1.5 rounded text-xs capitalize ${tool === item ? "bg-red-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>{item}</button>)}<label className="ml-1 flex items-center gap-1 text-xs text-slate-400">Color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label><label className="flex items-center gap-1 text-xs text-slate-400">Size <input type="range" min="1" max="18" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></label><button onClick={undo} className="px-2.5 py-1.5 bg-slate-800 rounded text-xs">Undo</button><button onClick={redo} className="px-2.5 py-1.5 bg-slate-800 rounded text-xs">Redo</button><button onClick={clearBoard} className="px-2.5 py-1.5 bg-slate-800 rounded text-xs">Clear</button><button onClick={() => setGrid((v) => !v)} className={`px-2.5 py-1.5 rounded text-xs ${grid ? "bg-slate-600" : "bg-slate-800"}`}>Grid</button><button onClick={() => setZoom((v) => clamp(v - 0.1, 0.5, 2))} className="px-2.5 py-1.5 bg-slate-800 rounded text-xs">−</button><span className="text-xs text-slate-400">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((v) => clamp(v + 0.1, 0.5, 2))} className="px-2.5 py-1.5 bg-slate-800 rounded text-xs">+</button>{isTeacher && <label className="ml-auto px-2.5 py-1.5 bg-slate-800 rounded text-xs cursor-pointer">PDF<input hidden type="file" accept="application/pdf,.pdf" onChange={(e) => uploadPdf(e.target.files?.[0])} /></label>}</div>
        <div className="flex-1 min-h-0 bg-slate-700 overflow-auto p-2"><div className="mx-auto relative" style={{ width: `${CANVAS_W * zoom}px`, height: `${CANVAS_H * zoom}px` }}><canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="absolute inset-0 bg-white rounded shadow-xl touch-none" style={{ width: "100%", height: "100%", backgroundImage: grid ? "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)" : undefined, backgroundSize: "32px 32px" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} /></div></div>
        <div className="shrink-0 bg-slate-900 border-t border-slate-800 px-2 py-2 flex flex-wrap items-center gap-2"><button onClick={() => toggleMedia("mic")} className={`px-3 py-2 rounded-lg text-xs ${mic ? "bg-emerald-600" : "bg-slate-800"}`}>{mic ? "Mute" : "Mic"}</button><button onClick={() => toggleMedia("camera")} className={`px-3 py-2 rounded-lg text-xs ${camera ? "bg-emerald-600" : "bg-slate-800"}`}>{camera ? "Camera off" : "Camera"}</button><button onClick={() => toggleMedia("screen")} className={`px-3 py-2 rounded-lg text-xs ${screen ? "bg-emerald-600" : "bg-slate-800"}`}>{screen ? "Stop share" : "Share screen"}</button><div className="flex items-center gap-1 ml-1"><button onClick={() => changePage(page - 1)} className="px-2 py-2 bg-slate-800 rounded">‹</button><span className="text-xs text-slate-400 min-w-16 text-center">Page {page}{pages.length ? ` / ${pages.length}` : ""}</span><button onClick={() => changePage(page + 1)} disabled={!pages.length || page >= pages.length} className="px-2 py-2 bg-slate-800 rounded disabled:opacity-30">›</button></div>{isTeacher && <><button onClick={() => sendWS({ type: "extend_class" })} className="px-3 py-2 bg-amber-600 rounded-lg text-xs">+5 min</button><button onClick={endClass} className="px-3 py-2 bg-red-600 rounded-lg text-xs">End class</button></>}<button onClick={() => setChatOpen((v) => !v)} className="ml-auto px-3 py-2 bg-slate-800 rounded-lg text-xs">{chatOpen ? "Hide chat" : "Show chat"}</button></div>{notice && <div className="px-3 py-2 text-xs bg-slate-900 text-amber-300 border-t border-slate-800">{notice}</div>}
      </section>
      {chatOpen && <aside className="border-l border-slate-800 bg-slate-900 min-h-0 flex flex-col"><div className="p-4 border-b border-slate-800"><div className="font-semibold">Class chat</div><div className="text-xs text-slate-500 mt-1">Live classroom messages and attachments.</div></div><div className="flex-1 overflow-y-auto p-3 space-y-2">{chat.length === 0 && <div className="text-xs text-slate-500 text-center py-10">No messages yet.</div>}{chat.map((item, i) => <div key={`${item.at}-${i}`} className={`flex ${item.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.mine ? "bg-red-600" : "bg-slate-800"}`}>{item.text && <div>{item.text}</div>}{item.file_url && <a className="underline text-xs break-all" href={item.file_url} target="_blank" rel="noreferrer">{item.file_name || "Attachment"}</a>}</div></div>)}</div><form onSubmit={sendMessage} className="p-3 border-t border-slate-800 flex gap-2"><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message…" className="flex-1 min-w-0 bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none" /><label className="cursor-pointer px-3 py-2 bg-slate-800 rounded-lg text-xs">📎<input hidden type="file" onChange={(e) => { uploadChatFile(e.target.files?.[0]); e.target.value = ""; }} /></label><button className="px-3 py-2 bg-red-600 rounded-lg text-xs">Send</button></form>{isTeacher && <div className="p-3 border-t border-slate-800 space-y-2"><div className="text-xs font-semibold text-slate-400">Student controls</div><div className="grid grid-cols-2 gap-2">{[["annotate", "Whiteboard"], ["screen_share", "Screen share"], ["mic", "Mic"], ["camera", "Camera"]].map(([key, label]) => <button key={key} onClick={() => setPermission(key, !permissions[key])} className={`px-2 py-2 rounded text-xs ${permissions[key] ? "bg-emerald-600/80" : "bg-slate-800 text-slate-400"}`}>{permissions[key] ? "✓ " : "✕ "}{label}</button>)}</div></div>}</aside>}
    </div>
  </div>;
}
