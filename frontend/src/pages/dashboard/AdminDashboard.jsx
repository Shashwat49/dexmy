import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Operations", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/students", label: "Students" },
  { path: "/dashboard/admin/teachers", label: "Teachers" },
] }];

const metricLabels = [["total_students", "Students"], ["total_teachers", "Teachers"], ["active_students", "Active students"], ["verified_teachers", "Verified teachers"], ["upcoming_bookings", "Upcoming classes"], ["pending_teacher_assignments", "Teacher assignments"], ["unresolved_contact_messages", "Unresolved messages"], ["pending_payments", "Pending payments"]];

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null), [pending, setPending] = useState([]), [teachers, setTeachers] = useState({}), [loading, setLoading] = useState(true), [error, setError] = useState(""), [working, setWorking] = useState("");
  async function load() { setError(""); try { const [dashboard, assignments] = await Promise.all([api.get("/admin/dashboard/metrics"), api.get("/admin/bookings/pending-teacher-assignment")]); setMetrics(dashboard.data.metrics); setPending(assignments.data || []); } catch (err) { setError(err.response?.data?.detail || "Unable to load admin data."); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function openTeachers(bookingId) { setWorking(bookingId); setError(""); try { const r = await api.get(`/admin/bookings/${bookingId}/eligible-teachers`); setTeachers((x) => ({ ...x, [bookingId]: r.data || [] })); } catch (err) { setError(err.response?.data?.detail || "Unable to load eligible teachers."); } finally { setWorking(""); } }
  async function assign(bookingId, teacherId) { setWorking(bookingId); setError(""); try { await api.post(`/admin/bookings/${bookingId}/assign-teacher`, { teacher_id: teacherId }); setPending((x) => x.filter((i) => i.booking_id !== bookingId)); setTeachers((x) => { const n = { ...x }; delete n[bookingId]; return n; }); await load(); } catch (err) { setError(err.response?.data?.detail || "Teacher assignment failed."); } finally { setWorking(""); } }
  return <DashboardLayout navItems={navItems}>
    <div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Admin operations</h1><p className="mt-1 text-sm text-chalk-muted">Manage students, teachers, bookings, payments and operations.</p></div>
    <div className="flex-1 overflow-auto px-8 py-7">{error && <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
      {loading ? <p className="text-sm text-chalk-muted">Loading admin dashboard…</p> : <>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{metricLabels.map(([key, label]) => <div key={key} className="rounded-xl border border-chalk-faint bg-panel-2 p-5"><p className="text-xs text-chalk-muted">{label}</p><p className="mt-2 font-display text-2xl">{metrics?.[key] ?? 0}</p></div>)}</div>
        <section className="mt-8 rounded-xl border border-chalk-faint bg-panel-2"><div className="border-b border-chalk-faint px-6 py-5"><h2 className="font-display text-xl">Teacher assignments</h2><p className="mt-1 text-sm text-chalk-muted">Assign teachers only after the booking has been created.</p></div>
          {pending.length === 0 ? <div className="px-6 py-10 text-sm text-chalk-muted">No bookings are waiting for teacher assignment.</div> : <div className="divide-y divide-chalk-faint">{pending.map((b) => <div key={b.booking_id} className="px-6 py-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold">{b.student_name} · {b.subject_name}</p><p className="mt-1 text-sm text-chalk-muted">{new Date(b.scheduled_at).toLocaleString()} · {b.duration_minutes} min</p></div><button onClick={() => openTeachers(b.booking_id)} disabled={working === b.booking_id} className="rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{working === b.booking_id ? "Checking…" : "Assign teacher"}</button></div>{teachers[b.booking_id] && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{teachers[b.booking_id].map((t) => <button key={t.id} onClick={() => assign(b.booking_id, t.id)} disabled={working === b.booking_id} className="rounded-lg border border-chalk-faint bg-panel px-4 py-3 text-left text-sm hover:border-brand-gold disabled:opacity-50"><span className="font-semibold">{t.full_name}</span><span className="mt-1 block text-xs text-chalk-muted">Select this teacher</span></button>)}{teachers[b.booking_id].length === 0 && <p className="text-sm text-chalk-muted">No eligible teacher is available for this slot.</p>}</div>}</div>)}</div>}
        </section>
      </>}
    </div>
  </DashboardLayout>;
}
