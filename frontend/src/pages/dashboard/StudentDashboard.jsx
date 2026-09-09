import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClassCard from "../../components/dashboard/ClassCard";
import { CalendarIcon, UsersIcon, BookIcon, GearIcon } from "../../components/dashboard/icons";
import * as bookingsApi from "../../api/bookings";
import { getMyClassRecords } from "../../api/classRecords";

const navItems = [
  { label: "Learn", items: [
    { path: "/dashboard/student", label: "My classes", icon: <CalendarIcon /> },
    { path: "/dashboard/student/book", label: "Book a class", icon: <UsersIcon /> },
    { path: "/dashboard/student/notes", label: "My notes", icon: <BookIcon /> },
  ]},
  { label: "Account", items: [{ path: "/dashboard/student/account", label: "My account", icon: <GearIcon /> }] },
];

const formatDate = (v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatTime = (v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [classData, setClassData] = useState({ package: null, classes: [] });
  const [loading, setLoading] = useState(true);
  const [recordLoading, setRecordLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordError, setRecordError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [joiningBookingId, setJoiningBookingId] = useState(null);

  const load = async () => {
    setLoading(true); setRecordLoading(true); setError(""); setRecordError("");
    const [bookingResult, recordResult] = await Promise.allSettled([bookingsApi.getMyBookings(), getMyClassRecords()]);
    if (bookingResult.status === "fulfilled") setBookings(bookingResult.value || []); else setError(bookingResult.reason?.response?.data?.detail || "Unable to load classes.");
    if (recordResult.status === "fulfilled") setClassData(recordResult.value || { package: null, classes: [] }); else setRecordError(recordResult.reason?.response?.data?.detail || "Unable to load package information.");
    setLoading(false); setRecordLoading(false);
  };
  useEffect(() => { load(); }, []);

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.scheduled_at) >= now && b.status === "confirmed").sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = bookings.filter((b) => b.status === "completed" || b.status === "cancelled" || new Date(b.scheduled_at) < now).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  async function handleJoin(booking) {
    if (joiningBookingId) return;
    setJoiningBookingId(booking.id); setError("");
    try { const session = await bookingsApi.getBookingSession(booking.id); navigate(`/classroom/${session.id}`); }
    catch (e) { setError(e.response?.data?.detail || "This classroom is not ready yet."); }
    finally { setJoiningBookingId(null); }
  }

  const nextClass = upcoming[0];
  const pkg = classData.package;
  return <DashboardLayout navItems={navItems}>
    <div className="flex items-center justify-between px-8 py-5.5 border-b border-chalk-faint"><h1 className="font-display text-2xl">My classes</h1><div className="flex gap-1 bg-panel-2 rounded-lg p-1"><button onClick={() => setTab("upcoming")} className={`px-4.5 py-2 rounded-md text-[13.5px] font-semibold ${tab === "upcoming" ? "bg-brand-red text-chalk" : "text-chalk-muted"}`}>Upcoming</button><button onClick={() => setTab("past")} className={`px-4.5 py-2 rounded-md text-[13.5px] font-semibold ${tab === "past" ? "bg-brand-red text-chalk" : "text-chalk-muted"}`}>Past</button></div></div>
    <div className="relative flex-1 overflow-auto px-8 py-7">
      {joiningBookingId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"><div className="rounded-2xl border border-chalk-faint bg-panel px-8 py-7 text-center shadow-2xl"><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-gold"/><h3 className="text-base font-semibold">Opening classroom…</h3><p className="mt-1 text-sm text-chalk-muted">Connecting you securely. Please wait.</p></div></div>}
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}<button onClick={load} className="ml-3 underline">Retry</button></div>}
      <section className="mb-8 rounded-2xl border border-chalk-faint bg-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-xs uppercase tracking-widest text-brand-gold">Package</p><h2 className="mt-1 text-xl font-semibold">{recordLoading ? "Loading package…" : pkg?.name || "No active package"}</h2></div>{pkg && <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">{pkg.status}</span>}</div>
        {recordError && <p className="mt-3 text-sm text-chalk-muted">{recordError}</p>}
        {pkg && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><PackageStat label="Total classes" value={pkg.total_classes}/><PackageStat label="Completed classes" value={pkg.completed_classes}/><PackageStat label="Remaining classes" value={pkg.remaining_classes}/></div>}
      </section>
      {pkg && classData.classes.length > 0 && <section className="mb-8"><div className="mb-4"><h2 className="text-xl font-semibold">Classes taken through Google Meet</h2><p className="mt-1 text-sm text-chalk-muted">Your completed class records and teacher notes.</p></div><div className="space-y-3">{classData.classes.map((r) => <article key={r.id} className="rounded-2xl border border-chalk-faint bg-panel p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h3 className="font-semibold">{r.subject} — {r.topic}</h3><p className="mt-1 text-sm text-chalk-muted">{formatDate(r.started_at)} · {formatTime(r.started_at)} – {formatTime(r.ended_at)} · {r.duration_minutes} min</p><p className="mt-1 text-xs text-chalk-muted">Teacher: {r.teacher_name}</p></div><span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs text-green-400">{r.status}</span></div>{r.teacher_notes && <p className="mt-4 whitespace-pre-wrap text-sm text-chalk-muted"><strong className="text-chalk">Teacher notes:</strong> {r.teacher_notes}</p>}{r.homework && <p className="mt-2 whitespace-pre-wrap text-sm text-chalk-muted"><strong className="text-chalk">Homework:</strong> {r.homework}</p>}</article>)}</div></section>}
      {loading ? <p className="text-chalk-muted text-sm">Loading your classes…</p> : <>
        {tab === "upcoming" && nextClass && <div className="bg-gradient-to-r from-panel-2 to-panel-3 border border-chalk-faint border-l-[3px] border-l-brand-gold rounded-xl px-6 py-5 flex items-center justify-between mb-7"><div><h3 className="text-base font-semibold mb-1">Your next class</h3><p className="text-[13.5px] text-chalk-muted">{nextClass.subject_name} with {nextClass.teacher_name}</p></div><button disabled={!!joiningBookingId} onClick={() => handleJoin(nextClass)} className="bg-brand-gold text-[#2C1E04] text-sm font-bold px-5 py-2.5 rounded-lg disabled:opacity-60">{joiningBookingId === nextClass.id ? "Opening…" : "Join classroom"}</button></div>}
        {tab === "upcoming" ? (upcoming.length === 0 ? <div className="text-center py-16 text-chalk-muted"><h3 className="font-display text-xl text-chalk mb-2">No upcoming classes</h3><p className="text-sm">Book a class to get started.</p></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">{upcoming.map((b) => <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} onJoin={handleJoin} />)}</div>) : (past.length === 0 ? <div className="text-center py-16 text-chalk-muted"><h3 className="font-display text-xl text-chalk mb-2">No past classes yet</h3></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">{past.map((b) => <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} isPast />)}</div>)}
      </>}
    </div>
  </DashboardLayout>;
}
function PackageStat({ label, value }) { return <div className="rounded-xl border border-chalk-faint bg-panel-2 p-4"><p className="text-xs text-chalk-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
