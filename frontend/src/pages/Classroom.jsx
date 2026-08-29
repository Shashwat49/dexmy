import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Room, RoomEvent, Track } from "livekit-client";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const tools = ["select", "pen", "highlighter", "line", "rect", "circle", "text", "eraser"];
const MAX_CHAT_FILE = 20 * 1024 * 1024;
const MAX_PDF = 30 * 1024 * 1024;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export default function Classroom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session") || params.get("session_id");
  const isTeacher = user?.role === "teacher";
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const wsRef = useRef(null);
  const roomRef = useRef(null);
  const drawingRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const [status, setStatus] = useState("Connecting…");
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#111827");
  const [width, setWidth] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState([]);
  const [page, setPage] = useState(1);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [studentId, setStudentId] = useState(null);
  const [permissions, setPermissions] = useState({ screen_share: false, annotate: false, mic: true, camera: true });
  const [notice, setNotice] = useState("");
  const [participants, setParticipants] = useState([]);
  const [timer, setTimer] = useState(null);

  const wsUrl = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL;
    if (!base || !sessionId) return null;
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return `${u.origin}/ws/classroom/${sessionId}`;
  }, [sessionId]);

  const drawBackground = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (pages[page - 1]) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const s = Math.min(c.width / img.width, c.height / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
      };
      img.src = pages[page - 1].image_url;
    }
  }, [page, pages]);

  useEffect(() => { drawBackground(); }, [drawBackground]);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) * canvasRef.current.width / r.width, 0, canvasRef.current.width), y: clamp((e.clientY - r.top) * canvasRef.current.height / r.height, 0, canvasRef.current.height) };
  };

  const sendWS = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  const applyStroke = useCallback((s, record = true) => {
    const c = canvasRef.current, ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.tool === "eraser" ? "#fff" : s.color;
    ctx.lineWidth = s.tool === "highlighter" ? s.width * 5 : s.width;
    ctx.globalAlpha = s.tool === "highlighter" ? 0.25 : 1;
    if (["pen", "highlighter", "eraser"].includes(s.tool)) {
      ctx.beginPath(); s.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    } else if (s.tool === "line") { ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y); ctx.lineTo(s.points.at(-1).x, s.points.at(-1).y); ctx.stroke();
    } else if (["rect", "circle"].includes(s.tool)) {
      const a=s.points[0], b=s.points.at(-1); ctx.beginPath();
      if (s.tool === "rect") ctx.rect(a.x,a.y,b.x-a.x,b.y-a.y); else { const r=Math.hypot(b.x-a.x,b.y-a.y); ctx.arc(a.x,a.y,r,0,Math.PI*2); }
      ctx.stroke();
    } else if (s.tool === "text") { ctx.fillStyle=s.color; ctx.font=`${Math.max(14,s.width*6)}px sans-serif`; ctx.fillText(s.text || "Text", s.points[0].x, s.points[0].y); }
    ctx.restore();
    if (record) { historyRef.current.push(s); redoRef.current=[]; }
  }, []);

  const redrawHistory = useCallback(() => { drawBackground(); setTimeout(() => historyRef.current.forEach(s => applyStroke(s, false)), 0); }, [applyStroke, drawBackground]);

  const onPointerDown = (e) => {
    if (!isTeacher && !permissions.annotate) return;
    const p = point(e); drawingRef.current = { tool, color, width, points:[p] };
    canvasRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => { if (!drawingRef.current) return; drawingRef.current.points.push(point(e)); redrawHistory(); applyStroke(drawingRef.current, false); };
  const onPointerUp = (e) => {
    const s=drawingRef.current; drawingRef.current=null; if (!s) return;
    if (s.tool === "text") { const t=window.prompt("Text"); if (!t) return; s.text=t; }
    applyStroke(s); sendWS({type:"whiteboard_event", payload:{kind:"stroke", stroke:s, page_number:page}});
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const undo = () => { const s=historyRef.current.pop(); if(s){redoRef.current.push(s); redrawHistory(); sendWS({type:"whiteboard_event",payload:{kind:"undo",page_number:page}});} };
  const redo = () => { const s=redoRef.current.pop(); if(s){applyStroke(s); sendWS({type:"whiteboard_event",payload:{kind:"stroke",stroke:s,page_number:page}});} };
  const clearBoard = () => { historyRef.current=[]; redoRef.current=[]; drawBackground(); sendWS({type:"whiteboard_event",payload:{kind:"clear",page_number:page}}); };

  const toggleMedia = async (kind) => {
    const p=roomRef.current?.localParticipant; if(!p) return;
    try {
      if(kind === "mic"){ const next=!mic; await p.setMicrophoneEnabled(next); setMic(next); sendWS({type:"toggle_av",kind:"mic",enabled:next}); }
      if(kind === "camera"){ const next=!camera; await p.setCameraEnabled(next); setCamera(next); sendWS({type:"toggle_av",kind:"camera",enabled:next}); }
      if(kind === "screen"){
        if(!isTeacher && !permissions.screen_share){ setNotice("The teacher has not enabled screen sharing for you."); return; }
        const next=!screen; await p.setScreenShareEnabled(next); setScreen(next); sendWS({type:"toggle_av",kind:"screen",enabled:next});
      }
    } catch(err){ setNotice(err?.message || "Media permission failed"); }
  };

  const sendMessage = (e) => { e.preventDefault(); const text=message.trim(); if(!text)return; sendWS({type:"chat",message_text:text}); setChat(x=>[...x,{mine:true,text,at:new Date().toISOString()}]); setMessage(""); };
  const uploadChatFile = async (file) => {
    if(!file)return; if(file.size>MAX_CHAT_FILE){setNotice("Chat files are limited to 20 MB.");return;}
    const fd=new FormData(); fd.append("file",file);
    try{const {data}=await api.post(`/classroom/sessions/${sessionId}/chat-file`,fd); sendWS({type:"chat",file_url:data.file_url,file_name:data.file_name,message_text:""});}catch(err){setNotice(err.response?.data?.detail||"Upload failed");}
  };
  const uploadPdf = async (file) => {
    if(!isTeacher || !file)return; if(file.size>MAX_PDF){setNotice("PDFs are limited to 30 MB.");return;}
    const fd=new FormData(); fd.append("file",file);
    try{const {data}=await api.post(`/classroom/sessions/${sessionId}/whiteboard-pdf`,fd); const pgs=data.map((x,i)=>({page_number:i+1,image_url:x.file_url})); setPages(pgs);setPage(1);setNotice(`${pgs.length} PDF page${pgs.length===1?"":"s"} loaded.`); sendWS({type:"whiteboard_event",payload:{kind:"pdf",pages:pgs}});}catch(err){setNotice(err.response?.data?.detail||"PDF upload failed");}
  };

  const setPermission = (permission, granted) => { if(!studentId)return; setPermissions(p=>({...p,[permission]:granted})); sendWS({type:"permission_update",target_user_id:studentId,permission,granted}); };

  useEffect(() => {
    if(!sessionId || !user){return;}
    let disposed=false;
    (async()=>{
      try{
        const {data}=await api.post("/classroom/join-token",{session_id:sessionId});
        const room=new Room({adaptiveStream:true,dynacast:true}); roomRef.current=room;
        room.on(RoomEvent.ParticipantConnected,p=>setParticipants(x=>[...x.filter(i=>i.identity!==p.identity),p]));
        room.on(RoomEvent.ParticipantDisconnected,p=>setParticipants(x=>x.filter(i=>i.identity!==p.identity)));
        room.on(RoomEvent.Disconnected,()=>setStatus("Disconnected"));
        room.on(RoomEvent.TrackSubscribed,(track,publication,participant)=>{
          if(track.kind===Track.Kind.Video){ const el=track.attach(); el.autoplay=true; el.playsInline=true; el.dataset.participant=participant.identity; document.getElementById("dexmy-remote-video")?.appendChild(el); }
          if(track.kind===Track.Kind.Audio){ const el=track.attach(); el.autoplay=true; el.dataset.participant=participant.identity; document.getElementById("dexmy-remote-audio")?.appendChild(el); }
        });
        await room.connect(data.livekit_url,data.livekit_token); setStatus("Live");
        setParticipants(Array.from(room.remoteParticipants.values()));
        const token=localStorage.getItem("dexmy_token");
        const ws=new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`); wsRef.current=ws;
        ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data);
          if(m.type==="waiting_for_teacher")setStatus("Waiting for teacher…");
          if(m.type==="admitted")setStatus("Live");
          if(m.type==="student_joined")setStudentId(m.user_id);
          if(m.type==="chat")setChat(x=>[...x,{mine:false,text:m.message_text||"",file_url:m.file_url,file_name:m.file_name,at:new Date().toISOString()}]);
          if(m.type==="permission_update")setPermissions(p=>({...p,[m.permission]:m.granted}));
          if(m.type==="toggle_av")setNotice(`${m.kind} ${m.enabled?"enabled":"disabled"} by ${m.user_id===String(user.id)?"you":"participant"}`);
          if(m.type==="whiteboard_event"){
            const p=m.payload;
            if(p.kind==="stroke" && p.page_number===page)applyStroke(p.stroke);
            if(p.kind==="clear" && p.page_number===page){historyRef.current=[];redoRef.current=[];drawBackground();}
            if(p.kind==="undo" && p.page_number===page){historyRef.current.pop();redrawHistory();}
            if(p.kind==="pdf"){setPages(p.pages||[]);setPage(1);}
          }
          if(m.type==="pdf_pages_ready"){setPages(m.pages||[]);setPage(1);}
          if(m.type==="extend_prompt")setNotice(`Class ends in about ${Math.ceil(m.seconds_remaining/60)} minutes.`);
          if(m.type==="class_extended")setNotice("Class extended by 5 minutes.");
          if(m.type==="session_ended"){setStatus("Class ended"); setTimeout(()=>navigate("/dashboard"),2500);}
        };
        ws.onclose=()=>{if(!disposed)setStatus("Classroom connection closed");};
      }catch(err){setStatus(err.response?.data?.detail||err.message||"Unable to join classroom");}
    })();
    return()=>{disposed=true; wsRef.current?.close(); roomRef.current?.disconnect(); roomRef.current=null;};
  }, [sessionId,user,wsUrl,applyStroke,drawBackground,redrawHistory,navigate,page]);

  useEffect(()=>{
    const id=setInterval(()=>{
      if(!roomRef.current?.localParticipant)return;
      const remaining=roomRef.current.metadata?.deadline;
      if(remaining)setTimer(Math.max(0,Math.floor((new Date(remaining)-Date.now())/1000)));
    },1000); return()=>clearInterval(id);
  },[]);

  const endClass=async()=>{if(!isTeacher)return; if(!window.confirm("End this class for both participants?"))return; try{await api.post(`/classroom/sessions/${sessionId}/end`);}catch(err){setNotice(err.response?.data?.detail||"Could not end class");}};
  const extend=()=>sendWS({type:"extend_class"});

  if(!sessionId) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white"><div className="text-center"><h1 className="text-2xl font-bold">Classroom link is incomplete</h1><p className="text-slate-400 mt-2">Open the classroom from your dashboard.</p></div></div>;

  return <div className="min-h-screen bg-slate-950 text-white flex flex-col">
    <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/95">
      <div><div className="font-bold">Dexmy Classroom</div><div className="text-xs text-slate-400">{status} · {isTeacher?"Teacher":"Student"}</div></div>
      <div className="flex items-center gap-2 text-xs"><span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">● Secure session</span>{timer!==null&&<span>{Math.floor(timer/60)}:{String(timer%60).padStart(2,"0")}</span>}</div>
    </header>
    <main className="flex-1 grid lg:grid-cols-[1fr_320px] min-h-0">
      <section className="min-w-0 flex flex-col">
        <div className="grid md:grid-cols-[1fr_280px] gap-2 p-2 bg-slate-950 min-h-[220px]">
          <div id="dexmy-remote-video" className="relative min-h-[220px] rounded-xl overflow-hidden bg-black flex items-center justify-center"><span className="absolute top-2 left-2 z-10 text-xs bg-black/60 px-2 py-1 rounded">Live video</span></div>
          <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 min-h-[180px] flex items-center justify-center"><div className="text-center text-slate-400 text-sm">Your camera preview<br/><span className="text-xs">Camera: {camera?"on":"off"} · Mic: {mic?"on":"off"}</span></div></div>
          <div id="dexmy-remote-audio" className="hidden" />
        </div>
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <button onClick={()=>toggleMedia("mic")} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">🎙 {mic?"Mute":"Mic"}</button>
          <button onClick={()=>toggleMedia("camera")} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">📷 {camera?"Stop camera":"Camera"}</button>
          <button onClick={()=>toggleMedia("screen")} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700">🖥 {screen?"Stop share":"Share screen"}</button>
          {isTeacher&&<><button onClick={extend} className="px-3 py-2 rounded-lg bg-amber-600/80">+5 min</button><button onClick={endClass} className="px-3 py-2 rounded-lg bg-red-600">End class</button></>}
        </div>
        <div className="flex-1 p-2 min-h-[460px]">
          <div className="h-full rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-slate-800 flex flex-wrap items-center gap-1">
              {tools.map(t=><button key={t} onClick={()=>setTool(t)} className={`px-2 py-1.5 rounded text-xs ${tool===t?"bg-red-600":"bg-slate-800 hover:bg-slate-700"}`}>{t}</button>)}
              <input aria-label="Pen color" type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-8 h-8 bg-transparent" />
              <select value={width} onChange={e=>setWidth(Number(e.target.value))} className="bg-slate-800 rounded px-2 py-1 text-xs"><option value="2">2px</option><option value="3">3px</option><option value="6">6px</option><option value="10">10px</option></select>
              <button onClick={undo} className="px-2 py-1.5 rounded bg-slate-800 text-xs">↶ Undo</button><button onClick={redo} className="px-2 py-1.5 rounded bg-slate-800 text-xs">↷ Redo</button><button onClick={clearBoard} className="px-2 py-1.5 rounded bg-slate-800 text-xs">Clear</button>
              <button onClick={()=>setZoom(z=>clamp(z-.1,.5,2))} className="px-2 py-1.5 rounded bg-slate-800 text-xs">−</button><span className="text-xs text-slate-400">{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>clamp(z+.1,.5,2))} className="px-2 py-1.5 rounded bg-slate-800 text-xs">+</button>
              {isTeacher&&<label className="ml-auto px-2 py-1.5 rounded bg-red-600 text-xs cursor-pointer">Upload PDF<input type="file" accept="application/pdf" hidden onChange={e=>uploadPdf(e.target.files?.[0])}/></label>}
              {!isTeacher&&<span className="ml-auto text-xs text-slate-400">{permissions.annotate?"Annotation enabled":"Teacher controls annotation"}</span>}
            </div>
            <div ref={wrapRef} className="flex-1 overflow-auto bg-slate-800 flex items-center justify-center p-3">
              <canvas ref={canvasRef} width="1400" height="850" style={{transform:`scale(${zoom})`,transformOrigin:"center center",touchAction:"none"}} className="bg-white rounded shadow-2xl max-w-full" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
            </div>
            {pages.length>0&&<div className="px-3 py-2 border-t border-slate-800 flex items-center justify-between text-xs"><span>PDF page {page} / {pages.length}</span><div className="flex gap-1"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="px-2 py-1 bg-slate-800 rounded">Prev</button><button disabled={page>=pages.length} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 bg-slate-800 rounded">Next</button></div></div>}
          </div>
        </div>
      </section>
      <aside className="border-l border-slate-800 bg-slate-900 flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-800 font-semibold">Class chat</div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {chat.length===0?<div className="text-sm text-slate-500 text-center mt-10">Messages will appear here.</div>:chat.map((m,i)=><div key={i} className={`max-w-[90%] p-2 rounded-lg text-sm ${m.mine?"ml-auto bg-red-600":"bg-slate-800"}`}>{m.text}{m.file_url&&<div className="mt-1"><a className="underline text-xs" href={m.file_url} target="_blank" rel="noreferrer">📎 {m.file_name||"Attachment"}</a></div>}</div>)}
        </div>
        <form onSubmit={sendMessage} className="p-2 border-t border-slate-800 flex gap-2"><label className="px-3 py-2 rounded-lg bg-slate-800 cursor-pointer">📎<input type="file" hidden onChange={e=>uploadChatFile(e.target.files?.[0])}/></label><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type a message…" className="min-w-0 flex-1 bg-slate-800 rounded-lg px-3 outline-none"/><button className="px-3 rounded-lg bg-red-600">Send</button></form>
        {isTeacher&&<div className="p-3 border-t border-slate-800"><div className="text-sm font-semibold mb-2">Teacher controls</div><div className="text-xs text-slate-400 mb-2">Student: {studentId?"connected":"waiting"}</div>{["annotate","screen_share","mic","camera"].map(p=><label key={p} className="flex items-center justify-between py-1.5 text-sm"><span>{p.replace("_"," ")}</span><input type="checkbox" checked={!!permissions[p]} disabled={!studentId} onChange={e=>setPermission(p,e.target.checked)} /></label>)}</div>}
        {notice&&<div className="m-3 p-2 rounded bg-amber-500/10 text-amber-300 text-xs">{notice}</div>}
      </aside>
    </main>
  </div>;
}
