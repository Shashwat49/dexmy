import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClassCard from "../../components/dashboard/ClassCard";
import { CalendarIcon, UsersIcon, BookIcon, GearIcon } from "../../components/dashboard/icons";
import * as bookingsApi from "../../api/bookings";
import { getMyClassRecords } from "../../api/classRecords";

export const navItems = [
  { label: "Learn", items: [
    { path: "/dashboard/student", label: "My classes", icon: <CalendarIcon /> },
    { path: "/dashboard/student/book", label: "Book a class", icon: <UsersIcon /> },
    { path: "/dashboard/student/notes", label: "My notes", icon: <BookIcon /> },
    { path: "/dashboard/student/tests", label: "Tests & Assessments", icon: <BookIcon /> },
  ]},
  { label: "Account", items: [{ path: "/dashboard/student/account", label: "My account", icon: <GearIcon /> }] },
];

const formatDate = (v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatTime = (v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isRestrictedStudent = String(user?.email || "").toLowerCase() === "wargod3508@gmail.com";
  const [bookings, setBookings] = useState([]);
  const [classData, setClassData] = useState({ package: null, classes: [], student_email: "" });
  const [loading, setLoading] = useState(true);
  const [recordLoading, setRecordLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordError, setRecordError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [joiningBookingId, setJoiningBookingId] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [dismissNoShowNotice, setDismissNoShowNotice] = useState(false);
  const [packageInfoOpen, setPackageInfoOpen] = useState(false);

  const load = async () => {
    setLoading(true); setRecordLoading(true); setError(""); setRecordError("");
    bookingsApi.getMyBookings()
      .then((data) => setBookings(data || []))
      .catch((e) => setError(e.response?.data?.detail || "Unable to load classes."))
      .finally(() => setLoading(false));
    getMyClassRecords()
      .then((data) => setClassData(data || { package: null, classes: [], student_email: "" }))
      .catch((e) => setRecordError(e.response?.data?.detail || "Unable to load package information."))
      .finally(() => setRecordLoading(false));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { const interval = setInterval(() => setClockNow(Date.now()), 15000); return () => clearInterval(interval); }, []);

  const now = new Date(clockNow);
  // The Upcoming section is intentionally limited to the next calendar day
  // in the student's local timezone (e.g. Oct 14 shows Oct 15 only).
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);
  const upcoming = bookings.filter((b) => {
    const scheduledAt = new Date(b.scheduled_at);
    return b.status === "confirmed" && scheduledAt >= tomorrowStart && scheduledAt < dayAfterTomorrowStart;
  }).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = bookings.filter((b) => b.status === "completed" || b.status === "cancelled" || b.status === "no_show" || new Date(b.scheduled_at) < now).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  const noShowCount = bookings.filter((b) => b.status === "no_show").length;

  async function handleJoin(booking) {
    if (joiningBookingId) return;
    setJoiningBookingId(booking.id); setError("");
    try { const session = await bookingsApi.getBookingSession(booking.id); navigate(`/classroom/${session.id}`); }
    catch (e) { setError(e.response?.data?.detail || "This classroom is not ready yet."); }
    finally { setJoiningBookingId(null); }
  }

  const nextClass = upcoming[0];
  const pkg = classData.package;
  const studentEmail = String(classData.student_email || "").toLowerCase();
  const isSubjectBalanceStudent = ["ayansh.abhilash@gmail.com", "wargod3508@gmail.com", "sskUsagm@gmail.com"].includes(studentEmail);
  const subjectClassLimit = studentEmail === "sskUsagm@gmail.com" ? 25 : 50;
  const completedSubjectClasses = (subject) => classData.classes.filter((r) => String(r.subject || "").trim().toLowerCase() === subject && r.status === "completed").length;
  const englishCompleted = completedSubjectClasses("english");
  const mathematicsCompleted = completedSubjectClasses("mathematics");
  const subjectEnglishRemaining = Math.max(0, subjectClassLimit - englishCompleted);
  const subjectMathematicsRemaining = Math.max(0, subjectClassLimit - mathematicsCompleted);
  const subjectPackageRemaining = subjectEnglishRemaining + subjectMathematicsRemaining;
  const subjectPackageTotal = subjectClassLimit * 2;
  // For the unlimited testing account, the authoritative "taken" count
  // comes from Dexmy classroom bookings that have actually completed.
  // This keeps the package card in sync with the classroom end flow.
  const classroomCompletedClasses = bookings.filter((b) => b.status === "completed").length;
  const freeDemoSubjectsUsed = new Set(bookings.filter((b) => Number(b.price) === 0 && b.status !== "cancelled").map((b) => b.subject_id)).size;
  const canBookDemoClass = !recordLoading && !recordError && !pkg && freeDemoSubjectsUsed < 2;

  return <DashboardLayout navItems={navItems}>
    <div className="relative z-30 flex flex-col gap-4 border-b border-chalk-faint px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5.5 lg:px-8"><h1 className="font-display text-2xl">My classes</h1><div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:flex-nowrap"><div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-chalk-faint bg-panel-2 p-1.5 shadow-inner"><button onClick={() => setTab("upcoming")} aria-pressed={tab === "upcoming"} className={`min-w-0 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 sm:min-w-[6.5rem] sm:px-5 sm:text-sm ${tab === "upcoming" ? "bg-brand-red text-chalk shadow-md" : "text-chalk-muted hover:bg-panel-3 hover:text-chalk"}`}>Upcoming</button><button onClick={() => setTab("past")} aria-pressed={tab === "past"} className={`min-w-0 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 sm:min-w-[6.5rem] sm:px-5 sm:text-sm ${tab === "past" ? "bg-brand-red text-chalk shadow-md" : "text-chalk-muted hover:bg-panel-3 hover:text-chalk"}`}>Past</button></div><button type="button" aria-expanded={packageInfoOpen} aria-controls="student-package-info" onClick={() => setPackageInfoOpen((open) => !open)} className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-gold px-3 py-2.5 text-xs font-semibold text-[#2C1E04] transition-colors hover:brightness-105 sm:px-3.5 sm:text-[13px]"><svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="7.2"/><path d="M10 9v4M10 6.5h.01" strokeLinecap="round"/></svg><span>Package Info</span></button></div><div id="student-package-info" aria-hidden={!packageInfoOpen} className={`absolute right-8 top-full z-40 w-[min(22rem,calc(100vw-2rem))] sm:w-[24rem] origin-top-right overflow-y-auto rounded-2xl border border-chalk-faint bg-panel shadow-2xl transition-all duration-300 ease-out ${packageInfoOpen ? "max-h-[min(80vh,48rem)] min-h-[28rem] translate-y-1 scale-y-100 opacity-100" : "pointer-events-none max-h-0 translate-y-0 scale-y-95 opacity-0"}`}><div className="space-y-5 p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-brand-gold">Package</p><h2 className="mt-1 text-lg font-semibold">{recordLoading ? "Loading package…" : pkg?.name || "No packages bought!"}</h2></div>{pkg && <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">{pkg.status}</span>}</div>{recordError && <p className="text-sm text-chalk-muted">{recordError}</p>}{pkg && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><PackageStat label="Total classes" value={isRestrictedStudent ? "Unlimited" : isSubjectBalanceStudent ? subjectPackageTotal : pkg.total_classes}/><PackageStat label="Completed classes" value={isRestrictedStudent ? classroomCompletedClasses : isSubjectBalanceStudent ? Math.min(subjectPackageTotal, (englishCompleted + mathematicsCompleted)) : pkg.completed_classes}/><PackageStat label="Remaining classes" value={isRestrictedStudent ? "Unlimited" : isSubjectBalanceStudent ? subjectPackageRemaining : pkg.remaining_classes}/></div>}{!isRestrictedStudent && isSubjectBalanceStudent && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><SubjectClassBox subject="English Classes" completed={englishCompleted} total={subjectClassLimit}/><SubjectClassBox subject="Mathematics Classes" completed={mathematicsCompleted} total={subjectClassLimit}/></div>}</div></div></div>
    <div className="relative flex-1 overflow-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
      {canBookDemoClass && <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 to-panel p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-brand-gold">New to Dexmy?</p><h2 className="mt-1 text-lg font-semibold sm:text-xl">Try a free demo class</h2><p className="mt-1 max-w-xl text-sm leading-6 text-chalk-muted">Book a demo class and experience learning with Dexmy. You can book up to two free classes before choosing a package.</p></div><button type="button" onClick={() => navigate("/dashboard/student/book")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3 text-sm font-bold text-[#2C1E04] transition-colors hover:brightness-105">Book a Demo Class <span aria-hidden="true">→</span></button></section>}
      {joiningBookingId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"><div className="rounded-2xl border border-chalk-faint bg-panel px-8 py-7 text-center shadow-2xl"><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-gold"/><h3 className="text-base font-semibold">Opening classroom…</h3><p className="mt-1 text-sm text-chalk-muted">Connecting you securely. Please wait.</p></div></div>}
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}<button onClick={load} className="ml-3 underline">Retry</button></div>}
      {!dismissNoShowNotice && noShowCount > 0 && <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><div><strong>No-show notice:</strong> {noShowCount === 1 ? "One class was marked as a no-show" : `${noShowCount} classes were marked as no-shows`} because the student did not join within 15 minutes. The package has been charged for {noShowCount === 1 ? "one class" : `${noShowCount} classes`}; the teacher was not credited for a completed class. See Past classes for details.</div><button type="button" aria-label="Dismiss no-show notice" onClick={() => setDismissNoShowNotice(true)} className="shrink-0 rounded px-2 py-1 text-amber-200 hover:bg-amber-400/10">×</button></div>}

      {tab === "upcoming" && nextClass && <div className="bg-gradient-to-r from-panel-2 to-panel-3 border border-chalk-faint border-l-[3px] border-l-brand-gold rounded-xl px-6 py-5 flex items-center justify-between mb-7"><div><h3 className="text-base font-semibold mb-1">Your next class</h3><p className="text-[13.5px] text-chalk-muted">{nextClass.subject_name} with {nextClass.teacher_name}</p></div><button disabled={!!joiningBookingId || clockNow < new Date(nextClass.scheduled_at).getTime() - 5 * 60 * 1000} onClick={() => handleJoin(nextClass)} className="bg-brand-gold text-[#2C1E04] text-sm font-bold px-5 py-2.5 rounded-lg disabled:opacity-60">{joiningBookingId === nextClass.id ? "Opening…" : "Join classroom"}</button></div>}

      {loading ? <p className="text-chalk-muted text-sm">Loading your classes…</p> : <>
        {tab === "upcoming" ? (upcoming.length === 0 ? <div className="text-center py-16 text-chalk-muted"><h3 className="font-display text-xl text-chalk mb-2">No classes scheduled for tomorrow</h3><p className="text-sm">Your next-day classes will appear here when scheduled.</p></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 mb-8">{upcoming.map((b) => <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} onJoin={handleJoin} />)}</div>) : (past.length === 0 ? <div className="text-center py-16 text-chalk-muted"><h3 className="font-display text-xl text-chalk mb-2">No past classes yet</h3></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 mb-8">{past.map((b) => <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} isPast />)}</div>)}
      </>}

      {!isRestrictedStudent && pkg && classData.classes.length > 0 && <section className="mb-8"><div className="mb-4"><h2 className="text-xl font-semibold">Classes taken through Google Meet</h2><p className="mt-1 text-sm text-chalk-muted">Your completed class records and teacher notes.</p></div><div className="space-y-3">{classData.classes.map((r) => <article key={r.id} className={`rounded-2xl border border-chalk-faint bg-panel p-5 ${r.status === "no_show" ? "border-amber-400/30" : ""}`}><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h3 className="font-semibold">{r.subject} — {r.topic}</h3><p className="mt-1 text-sm text-chalk-muted">{formatDate(r.started_at)} · {formatTime(r.started_at)} – {formatTime(r.ended_at)} · {r.duration_minutes} min</p><p className="mt-1 text-xs text-chalk-muted">Teacher: {r.teacher_name}</p></div>{r.status === "no_show" ? <div className="text-right"><span className="inline-block rounded-md bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-300">Student did not join</span><div className="mt-1 text-xs font-semibold text-green-400">Teacher was present</div></div> : <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs text-green-400">{r.status}</span>}</div>{r.teacher_notes && <p className="mt-4 whitespace-pre-wrap text-sm text-chalk-muted"><strong className="text-chalk">Teacher notes:</strong> {r.teacher_notes}</p>}{r.homework && <p className="mt-2 whitespace-pre-wrap text-sm text-chalk-muted"><strong className="text-chalk">Homework:</strong> {r.homework}</p>}</article>)}</div></section>}
    </div>
  </DashboardLayout>;
}

function SubjectClassBox({ subject, completed, total }) {
  const remaining = Math.max(0, total - completed);
  return <article className="rounded-2xl border border-chalk-faint bg-panel p-5 md:p-6"><h2 className="text-lg font-semibold">{subject}</h2><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl border border-chalk-faint bg-panel-2 p-4"><p className="text-xs text-chalk-muted">Total classes</p><p className="mt-1 text-2xl font-semibold">{total}</p></div><div className="rounded-xl border border-chalk-faint bg-panel-2 p-4"><p className="text-xs text-chalk-muted">Remaining classes</p><p className="mt-1 text-2xl font-semibold">{remaining}</p></div></div></article>;
}

function PackageStat({ label, value }) { return <div className="rounded-xl border border-chalk-faint bg-panel-2 p-4"><p className="text-xs text-chalk-muted">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
