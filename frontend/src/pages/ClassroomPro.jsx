import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const W = 1600;
const H = 900;
const TOOLS = [
  ["select", "Select"], ["pen", "Pen"], ["highlighter", "Highlight"], ["line", "Line"],
  ["arrow", "Arrow"], ["rect", "Rectangle"], ["circle", "Circle"], ["text", "Text"],
  ["sticky", "Sticky"], ["eraser", "Eraser"],
];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function ClassroomPro() {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const isTeacher = user?.role === "teacher";
  const canvasRef = useRef(null);
  const roomRef = useRef(null);
  const wsRef = useRef(null);
  const drawingRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const pagesRef = useRef([]);
  const pageRef = useRef(1);
  const disposedRef = useRef(false);
  const snapshotTimer = useRef(null);
  // Stable whiteboard identity/synchronization state. These refs prevent
  // remote snapshots and redraws from replacing newer local annotations.
  const strokeIdsRef = useRef(new Set());
  const redrawVersionRef = useRef(0);
  const [status, setStatus] = useState("Connecting…");
  const [notice, setNotice] = useState("");
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(3);
  const [grid, setGrid] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(1);
  const [chatOpen, setChatOpen] = useState(true);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [peerName, setPeerName] = useState("");
  const [permissions, setPermissions] = useState({ mic: true, camera: true, annotate: false, screen_share: false });

  useEffect(() => { pagesRef.current = pages; }, [pages]);
  useEffect(() => { pageRef.current = page; }, [page]);

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

  const drawGrid = useCallback((ctx) => {
    if (!grid) return;
    ctx.save();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }, [grid]);

  const renderStroke = useCallback((s, record = true) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !s?.points?.length) return;
    const a = s.points[0];
    const b = s.points[s.points.length - 1];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width;
    ctx.globalAlpha = s.tool === "highlighter" ? 0.24 : 1;
    if (["pen", "highlighter", "eraser"].includes(s.tool)) {
      ctx.beginPath();
      s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.stroke();
    } else if (s.tool === "line") {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (s.tool === "arrow") {
      const angle = Math.atan2(b.y - a.y, b.x - a.x); const head = 16 + s.width * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 6), b.y - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 6), b.y - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (s.tool === "rect") {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (s.tool === "circle") {
      ctx.beginPath(); ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2); ctx.stroke();
    } else if (s.tool === "text") {
      ctx.globalAlpha = 1; ctx.font = `${Math.max(18, s.width * 6)}px sans-serif`; ctx.fillText(s.text || "Text", a.x, a.y);
    } else if (s.tool === "sticky") {
      ctx.globalAlpha = 0.92; ctx.fillStyle = "#fff7a8"; ctx.fillRect(a.x, a.y, Math.max(160, b.x - a.x), Math.max(100, b.y - a.y));
      ctx.globalAlpha = 1; ctx.fillStyle = "#111827"; ctx.font = "20px sans-serif";
      String(s.text || "Note").split("\n").forEach((line, i) => ctx.fillText(line.slice(0, 45), a.x + 12, a.y + 28 + i * 24));
    }
    ctx.restore();
    if (record) {
      // A stroke is a logical whiteboard object. Give it a stable ID and
      // record it only once, even if the server echoes the same event back.
      if (!s.id) s.id = crypto.randomUUID();
      if (!strokeIdsRef.current.has(s.id)) {
        historyRef.current.push(s);
        strokeIdsRef.current.add(s.id);
      }
      redoRef.current = [];
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Invalidate older asynchronous image loads. A PDF background can finish
    // loading after the user has already drawn more annotations.
    const version = ++redrawVersionRef.current;
    const renderPage = pageRef.current;

    // Snapshot the logical annotation state for this redraw. Rendering must
    // never mutate historyRef.current.
    const strokes = [...historyRef.current];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    drawGrid(ctx);

    const current = pagesRef.current[renderPage - 1];

    const renderStrokes = () => {
      if (
        version !== redrawVersionRef.current ||
        renderPage !== pageRef.current
      ) return;

      strokes.forEach((s) => renderStroke(s, false));
    };

    if (current?.image_url) {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        if (
          version !== redrawVersionRef.current ||
          renderPage !== pageRef.current
        ) return;

        const scale = Math.min(W / img.width, H / img.height);
        const w = img.width * scale;
        const h = img.height * scale;

        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        drawGrid(ctx);
        renderStrokes();
      };

      // If a background fails, the annotations must still remain visible.
      img.onerror = renderStrokes;
      img.src = current.image_url;
    } else {
      renderStrokes();
    }
  }, [drawGrid, renderStroke]);

  useEffect(() => { redraw(); }, [redraw, page, pages, grid]);

  const point = (event) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: clamp((event.clientX - r.left) * W / r.width, 0, W), y: clamp((event.clientY - r.top) * H / r.height, 0, H) };
  };

  const queueSnapshot = useCallback(() => {
    clearTimeout(snapshotTimer.current);
    snapshotTimer.current = setTimeout(() => sendWS({
      type: "save_snapshot",
      page_number: pageRef.current,
      canvas_json: { strokes: historyRef.current.map((stroke) => ({ ...stroke })) },
    }), 700);
  }, [sendWS]);

  const onPointerDown = (event) => {
    if (tool === "select") return;
    if (!isTeacher && !permissions.annotate) return setNotice("The teacher has not enabled annotation for you.");
    drawingRef.current = { id: crypto.randomUUID(), tool, color, width, points: [point(event)] };
    canvasRef.current.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(point(event));
    redraw();
    renderStroke(drawingRef.current, false);
  };
  const onPointerUp = (event) => {
    const stroke = drawingRef.current; drawingRef.current = null;
    if (!stroke) return;
    if (["text", "sticky"].includes(stroke.tool)) {
      const text = window.prompt(stroke.tool === "sticky" ? "Sticky note text" : "Text");
      if (!text) return;
      stroke.text = text;
      if (stroke.tool === "text") stroke.points = [stroke.points[0]];
    }
    renderStroke(stroke, true);
    sendWS({ type: "whiteboard_event", payload: { kind: "stroke", stroke, page_number: pageRef.current } });
    queueSnapshot();
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };

  const undo = () => {
    const s = historyRef.current.pop(); if (!s) return;
    if (s.id) strokeIdsRef.current.delete(s.id);
    redoRef.current.push(s); redraw();
    sendWS({ type: "whiteboard_event", payload: { kind: "undo", page_number: pageRef.current } }); queueSnapshot();
  };
  const redo = () => {
    const s = redoRef.current.pop(); if (!s) return;
    renderStroke(s, true); sendWS({ type: "whiteboard_event", payload: { kind: "stroke", stroke: s, page_number: pageRef.current } }); queueSnapshot();
  };
  const clearBoard = () => {
    historyRef.current = []; strokeIdsRef.current.clear(); redoRef.current = []; redraw();
    sendWS({ type: "whiteboard_event", payload: { kind: "clear", page_number: pageRef.current } }); queueSnapshot();
  };
  const changePage = (next) => {
    const target = clamp(next, 1, Math.max(1, pages.length));
    if (target === page) return;
    historyRef.current = [];
    strokeIdsRef.current.clear();
    redoRef.current = [];
    setPage(target);
    sendWS({ type: "whiteboard_event", payload: { kind: "page", page_number: target } });
  };

  const mountTrack = useCallback((track, targetId, identity, label) => {
    const container = document.getElementById(targetId);
    if (!container) return;
    [...container.querySelectorAll("video, audio")].forEach((el) => el.remove());
    const el = track.attach();
    el.autoplay = true; el.playsInline = true; el.muted = track.kind === Track.Kind.Video && targetId === "local-stage";
    el.className = "absolute inset-0 w-full h-full object-cover";
    el.dataset.participant = identity;
    container.appendChild(el);
    if (label) container.dataset.label = label;
  }, []);

  const toggleMedia = async (kind) => {
    const participant = roomRef.current?.localParticipant;
    if (!participant) return;
    try {
      if (kind === "mic") {
        if (!isTeacher && !permissions.mic) return setNotice("Microphone permission is disabled by the teacher.");
        const next = !mic; await participant.setMicrophoneEnabled(next); setMic(next); sendWS({ type: "toggle_av", kind: "mic", enabled: next });
      }
      if (kind === "camera") {
        if (!isTeacher && !permissions.camera) return setNotice("Camera permission is disabled by the teacher.");
        const next = !camera; await participant.setCameraEnabled(next); setCamera(next); sendWS({ type: "toggle_av", kind: "camera", enabled: next });
      }
      if (kind === "screen") {
        if (!isTeacher && !permissions.screen_share) return setNotice("The teacher has not enabled screen sharing for you.");
        const next = !screen; await participant.setScreenShareEnabled(next, { contentHint: "detail", selfBrowserSurface: "exclude" }); setScreen(next); sendWS({ type: "toggle_av", kind: "screen", enabled: next });
      }
    } catch (error) {
      setNotice(error?.message || "Could not change media permission.");
    }
  };

  useEffect(() => {
    if (!sessionId || !user || !wsUrl) return undefined;
    disposedRef.current = false;
    let reconnectTimer;
    const connect = async () => {
      try {
        setStatus("Authorizing…");
        const { data } = await api.post("/classroom/join-token", { session_id: sessionId });
        if (disposedRef.current) return;
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          const name = participant.name || "Participant";
          const label = participant.identity === String(user.id) ? "You" : (isTeacher ? `Dexmy Student - ${name}` : `Dexmy Tutor - ${name}`);
          if (track.kind === Track.Kind.Audio) mountTrack(track, "remote-audio", participant.identity, label);
          if (track.kind === Track.Kind.Video) mountTrack(track, publication.source === "screen_share" ? "remote-stage" : "remote-stage", participant.identity, label);
        });
        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.track?.kind === Track.Kind.Video) {
            const source = publication.source === "screen_share" ? "local-stage" : "local-stage";
            mountTrack(publication.track, source, user.id, isTeacher ? `Dexmy Tutor - ${user.full_name}` : `Dexmy Student - ${user.full_name}`);
          }
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
        room.on(RoomEvent.ParticipantConnected, (participant) => setPeerName(participant.name || "Participant"));
        room.on(RoomEvent.ParticipantNameChanged, (name, participant) => { if (participant.identity !== String(user.id)) setPeerName(name || "Participant"); });
        room.on(RoomEvent.ParticipantPermissionsChanged, (_prev, participant) => {
          if (participant.identity === String(user.id) && participant.permissions) {
            const sources = participant.permissions.canPublishSources || [];
            setPermissions((p) => ({ ...p, mic: sources.includes("microphone"), camera: sources.includes("camera"), screen_share: sources.includes("screen_share") }));
          }
        });
        room.on(RoomEvent.Disconnected, () => setStatus("Connection lost — reconnecting…"));
        await room.connect(data.livekit_url, data.livekit_token);
        setStatus("Live");
        const token = localStorage.getItem("dexmy_token");
        const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token || "")}`);
        wsRef.current = ws;
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.type === "waiting_for_teacher") setStatus("Waiting for teacher…");
          if (msg.type === "admitted" || msg.type === "class_started") { setStatus("Live"); if (msg.deadline) setDeadline(msg.deadline); if (msg.student_id) setStudentId(msg.student_id); }
          if (msg.type === "student_joined") { setStudentId(msg.user_id); setPeerName(msg.name || "Participant"); }
          if (msg.type === "participant_info" && msg.role === (isTeacher ? "student" : "teacher")) setPeerName(msg.name || "Participant");
          if (msg.type === "chat") setChat((items) => [...items, { mine: msg.sender_id === String(user.id), text: msg.message_text || "", file_url: msg.file_url, file_name: msg.file_name }]);
          if (msg.type === "permission_update") {
            setPermissions((p) => ({ ...p, [msg.permission]: msg.granted }));
            if (!msg.granted && msg.permission === "screen_share") setScreen(false);
            if (!msg.granted && msg.permission === "camera") { setCamera(false); room.localParticipant.setCameraEnabled(false).catch(() => {}); }
            if (!msg.granted && msg.permission === "mic") { setMic(false); room.localParticipant.setMicrophoneEnabled(false).catch(() => {}); }
          }
          if (msg.type === "pdf_pages_ready") {
            setPages(msg.pages || []);
            setPage(1);
            historyRef.current = [];
            strokeIdsRef.current.clear();
            redoRef.current = [];
          }

          if (msg.type === "whiteboard_state") {
            const nextPages = msg.pages?.length
              ? msg.pages
              : (msg.image_url
                ? [{
                    page_number: msg.page_number || 1,
                    image_url: msg.image_url
                  }]
                : []);

            // Never blindly replace local history. The server snapshot may
            // have been produced before a local stroke reached the backend.
            const serverStrokes = Array.isArray(msg.canvas_json?.strokes)
              ? msg.canvas_json.strokes.map((stroke) => ({
                  ...stroke,
                  id: stroke.id || crypto.randomUUID()
                }))
              : [];

            const serverIds = new Set(serverStrokes.map((stroke) => stroke.id));

            const localOnly = historyRef.current.filter(
              (stroke) => stroke?.id && !serverIds.has(stroke.id)
            );

            const merged = [...serverStrokes, ...localOnly];
            const seen = new Set();

            historyRef.current = merged.filter((stroke) => {
              if (!stroke?.id || seen.has(stroke.id)) return false;
              seen.add(stroke.id);
              return true;
            });

            strokeIdsRef.current = new Set(
              historyRef.current.map((stroke) => stroke.id)
            );

            redoRef.current = [];
            setPages(nextPages);
            setPage(msg.page_number || 1);
            setTimeout(redraw, 0);
          }

          if (msg.type === "whiteboard_event") {
            const p = msg.payload || {};

            if (
              p.kind === "stroke" &&
              p.page_number === pageRef.current &&
              p.stroke
            ) {
              const stroke = {
                ...p.stroke,
                id: p.stroke.id || crypto.randomUUID()
              };

              // The sender can receive its own event back from the server.
              // Do not add an already-known stroke a second time.
              if (!strokeIdsRef.current.has(stroke.id)) {
                strokeIdsRef.current.add(stroke.id);
                historyRef.current.push(stroke);
                renderStroke(stroke, false);
              }
            }

            if (p.kind === "undo" && p.page_number === pageRef.current) {
              const removed = historyRef.current.pop();
              if (removed?.id) strokeIdsRef.current.delete(removed.id);
              redoRef.current = [];
              redraw();
            }

            if (p.kind === "clear" && p.page_number === pageRef.current) {
              historyRef.current = [];
              strokeIdsRef.current.clear();
              redoRef.current = [];
              redraw();
            }

            if (p.kind === "pdf") {
              setPages(p.pages || []);
              setPage(1);
              historyRef.current = [];
              strokeIdsRef.current.clear();
              redoRef.current = [];
            }

            if (p.kind === "page") {
              historyRef.current = [];
              strokeIdsRef.current.clear();
              redoRef.current = [];
              setPage(p.page_number || 1);
            }
          }
          if (msg.type === "permission_denied") setNotice(`Permission denied: ${msg.permission || "action"}.`);
          if (msg.type === "permission_sync_failed") setNotice(`Could not update ${msg.permission || "student"} permission. Please retry.`);
          if (msg.type === "extend_prompt") setNotice(`Class ends in about ${Math.ceil(msg.seconds_remaining / 60)} minutes.`);
          if (msg.type === "class_extended") { setDeadline(msg.new_deadline); setNotice("Class extended by 5 minutes."); }
          if (msg.type === "session_ended") { setStatus("Class ended"); setTimeout(() => navigate("/dashboard"), 1600); }
        };
        ws.onclose = () => { if (!disposedRef.current) { setStatus("Classroom connection closed — retrying…"); reconnectTimer = setTimeout(connect, 2500); } };
      } catch (error) {
        if (!disposedRef.current) { setStatus(error.response?.data?.detail || error.message || "Unable to join classroom"); reconnectTimer = setTimeout(connect, 3500); }
      }
    };
    connect();
    return () => { disposedRef.current = true; clearTimeout(reconnectTimer); clearTimeout(snapshotTimer.current); wsRef.current?.close(); roomRef.current?.disconnect(); roomRef.current = null; };
  }, [sessionId, user, wsUrl, mountTrack, navigate, redraw, renderStroke, isTeacher]);

  useEffect(() => {
    if (!deadline) return undefined;
    const tick = () => setTimerState(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [deadline]);

  const [timerState, setTimerState] = useState(null);
  const sendMessage = (event) => { event.preventDefault(); const text = message.trim(); if (!text) return; sendWS({ type: "chat", message_text: text }); setChat((items) => [...items, { mine: true, text }]); setMessage(""); };
  const uploadChatFile = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setNotice("Chat files are limited to 20 MB.");
    const form = new FormData(); form.append("file", file);
    try { const { data } = await api.post(`/classroom/sessions/${sessionId}/chat-file`, form); sendWS({ type: "chat", file_url: data.file_url, file_name: data.file_name, message_text: "" }); setChat((items) => [...items, { mine: true, file_url: data.file_url, file_name: data.file_name }]); }
    catch (error) { setNotice(error.response?.data?.detail || "Upload failed."); }
  };
  const uploadPdf = async (file) => {
    if (!isTeacher || !file) return;
    if (file.size > 30 * 1024 * 1024) return setNotice("PDFs are limited to 30 MB.");
    const form = new FormData(); form.append("file", file);
    try { const { data } = await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf`, form); const loaded = data.map((item, i) => ({ page_number: i + 1, image_url: item.file_url })); setPages(loaded); setPage(1); historyRef.current = []; strokeIdsRef.current.clear(); redoRef.current = []; setNotice(`${loaded.length} PDF page${loaded.length === 1 ? "" : "s"} loaded onto the whiteboard.`); }
    catch (error) { setNotice(error.response?.data?.detail || "PDF upload failed."); }
  };
  const setPermission = (permission, granted) => {
    if (!studentId) return setNotice("Waiting for the student to join.");
    sendWS({ type: "permission_update", target_user_id: studentId, permission, granted });
  };
  const endClass = async () => {
    if (!isTeacher || !window.confirm("End this class for both participants?")) return;
    try { await api.post(`/classroom/sessions/${sessionId}/end`); } catch (error) { setNotice(error.response?.data?.detail || "Could not end class."); }
  };

  const peerLabel = peerName ? (isTeacher ? `Dexmy Student - ${peerName}` : `Dexmy Tutor - ${peerName}`) : (isTeacher ? "Dexmy Student" : "Dexmy Tutor");
  const localLabel = isTeacher ? `Dexmy Tutor - ${user?.full_name || "Teacher"}` : `Dexmy Student - ${user?.full_name || "Student"}`;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#0b1020] text-white flex flex-col select-none">
      <header className="h-14 shrink-0 px-4 border-b border-white/10 bg-[#111827] flex items-center justify-between gap-4">
        <div className="min-w-0"><div className="font-semibold tracking-tight">Dexmy Classroom</div><div className="text-[11px] text-slate-400 truncate">{status}</div></div>
        <div className="flex items-center gap-2 text-xs"><span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300">● Secure</span>{timerState !== null && <span className="font-mono text-slate-300">{Math.floor(timerState / 60)}:{String(timerState % 60).padStart(2, "0")}</span>}</div>
      </header>

      <main className="flex-1 min-h-0 flex overflow-hidden">
        <section className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 h-11 px-2 flex items-center gap-1 border-b border-white/10 bg-[#0f172a] overflow-x-auto">
            {TOOLS.map(([id, label]) => <button key={id} onClick={() => setTool(id)} className={`shrink-0 px-2.5 py-1.5 rounded-md text-[11px] ${tool === id ? "bg-red-600 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>{label}</button>)}
            <span className="h-5 w-px bg-white/10 mx-1" />
            <input aria-label="Pen color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 rounded bg-transparent" />
            <input aria-label="Pen size" type="range" min="1" max="18" value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-16" />
            <button onClick={undo} className="px-2.5 py-1.5 rounded-md bg-white/5 text-[11px]">Undo</button><button onClick={redo} className="px-2.5 py-1.5 rounded-md bg-white/5 text-[11px]">Redo</button><button onClick={clearBoard} className="px-2.5 py-1.5 rounded-md bg-white/5 text-[11px]">Clear</button>
            <button onClick={() => setGrid((v) => !v)} className={`px-2.5 py-1.5 rounded-md text-[11px] ${grid ? "bg-indigo-600" : "bg-white/5"}`}>Grid</button>
            <button onClick={() => setZoom((v) => clamp(v - .1, .7, 1.3))} className="px-2 py-1.5 rounded bg-white/5 text-xs">−</button><span className="text-[11px] text-slate-400 w-9 text-center">{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((v) => clamp(v + .1, .7, 1.3))} className="px-2 py-1.5 rounded bg-white/5 text-xs">+</button>
            {isTeacher && <label className="ml-auto shrink-0 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 text-[11px] cursor-pointer">Upload PDF<input hidden type="file" accept="application/pdf,.pdf" onChange={(e) => uploadPdf(e.target.files?.[0])} /></label>}
          </div>

          <div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-[#070b16] overflow-hidden">
            <div className="relative w-full max-w-[calc(100vh*1.777)] max-h-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-white" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
              <canvas ref={canvasRef} width={W} height={H} className="absolute inset-0 w-full h-full touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
              <div className="absolute left-3 bottom-3 px-2 py-1 rounded bg-black/55 text-[10px] text-white/80">Whiteboard · 16:9</div>
              {pages.length > 0 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 rounded-xl bg-black/65 backdrop-blur"><button onClick={() => changePage(page - 1)} className="px-2 py-1 rounded bg-white/10 text-xs">‹</button><span className="text-[11px] min-w-14 text-center">Page {page}/{pages.length}</span><button onClick={() => changePage(page + 1)} className="px-2 py-1 rounded bg-white/10 text-xs">›</button></div>}
            </div>
          </div>

          <div className="shrink-0 h-16 px-3 border-t border-white/10 bg-[#111827] flex items-center justify-center gap-2">
            <button onClick={() => toggleMedia("mic")} className={`h-10 px-4 rounded-full text-xs ${mic ? "bg-emerald-600" : "bg-white/10"}`}>{mic ? "Mute" : "Mic"}</button>
            <button onClick={() => toggleMedia("camera")} className={`h-10 px-4 rounded-full text-xs ${camera ? "bg-emerald-600" : "bg-white/10"}`}>{camera ? "Camera off" : "Camera"}</button>
            <button onClick={() => toggleMedia("screen")} className={`h-10 px-4 rounded-full text-xs ${screen ? "bg-indigo-600" : "bg-white/10"}`}>Share screen</button>
            <button onClick={() => setChatOpen((v) => !v)} className="h-10 px-4 rounded-full bg-white/10 text-xs">{chatOpen ? "Hide chat" : "Show chat"}</button>
            {isTeacher && <button onClick={() => sendWS({ type: "extend_class" })} className="h-10 px-4 rounded-full bg-white/10 text-xs">+5 min</button>}
            {isTeacher && <button onClick={endClass} className="h-10 px-4 rounded-full bg-red-600 text-xs">End class</button>}
          </div>
        </section>

        <aside className={`${chatOpen ? "w-[330px]" : "w-0"} shrink-0 min-h-0 overflow-hidden transition-[width] duration-200 border-l border-white/10 bg-[#0f172a]`}>
          <div className="w-[330px] h-full flex flex-col">
            <div className="h-14 shrink-0 px-3 border-b border-white/10 flex items-center justify-between"><div><div className="text-sm font-semibold">{peerLabel}</div><div className="text-[10px] text-slate-500">Live classroom</div></div><button onClick={() => setChatOpen(false)} className="text-slate-400">×</button></div>
            <div className="h-[150px] shrink-0 p-2 relative">
              <div id="remote-stage" className="relative h-full rounded-lg overflow-hidden bg-black"><span className="absolute z-10 top-2 left-2 px-2 py-1 rounded bg-black/60 text-[10px]">{peerLabel}</span><div id="remote-audio" className="hidden" /><div className="absolute inset-0 grid place-items-center text-xs text-slate-600">Camera off</div></div>
              <div id="local-stage" className="absolute right-4 bottom-4 w-24 aspect-video rounded-lg overflow-hidden border border-white/20 bg-slate-800 shadow-lg"><span className="absolute z-10 top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[8px]">{localLabel}</span></div>
            </div>
            {isTeacher && <div className="px-3 pb-2"><div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Student permissions</div><div className="grid grid-cols-2 gap-1.5">{[["mic","Mic"],["camera","Camera"],["annotate","Annotate"],["screen_share","Screen share"]].map(([key,label]) => <button key={key} onClick={() => setPermission(key, !permissions[key])} className={`px-2 py-2 rounded-md text-[10px] ${permissions[key] ? "bg-emerald-600/80" : "bg-white/5 text-slate-400"}`}>{permissions[key] ? "✓ " : ""}{label}</button>)}</div></div>}
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2">{chat.length === 0 && <div className="h-full grid place-items-center text-xs text-slate-600">No messages yet</div>}{chat.map((item, i) => <div key={i} className={`flex ${item.mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs ${item.mine ? "bg-red-600" : "bg-white/10"}`}>{item.file_url ? <a href={item.file_url} target="_blank" rel="noreferrer" className="underline">{item.file_name || "Open file"}</a> : item.text}</div></div>)}</div>
            <form onSubmit={sendMessage} className="shrink-0 p-2 border-t border-white/10 flex gap-2"><label className="shrink-0 h-9 w-9 grid place-items-center rounded-lg bg-white/5 cursor-pointer">＋<input hidden type="file" onChange={(e) => uploadChatFile(e.target.files?.[0])} /></label><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" className="min-w-0 flex-1 h-9 rounded-lg bg-white/5 px-3 text-xs outline-none" /><button className="h-9 px-3 rounded-lg bg-red-600 text-xs">Send</button></form>
          </div>
        </aside>
      </main>
      {notice && <button onClick={() => setNotice("")} className="fixed left-1/2 -translate-x-1/2 bottom-20 z-50 max-w-[90vw] px-4 py-2 rounded-full bg-slate-800 border border-white/10 shadow-xl text-xs">{notice}</button>}
    </div>
  );
}