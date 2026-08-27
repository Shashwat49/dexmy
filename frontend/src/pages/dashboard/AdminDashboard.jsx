import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Operations", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/students", label: "Students" },
  { path: "/dashboard/admin/teachers", label: "Teachers" },
  { path: "/dashboard/admin/bookings", label: "Bookings" },
] }];
const metricLabels = [["total_students", "Students"], ["total_teachers", "Teachers"], ["active_students", "Active students"], ["verified_teachers", "Verified teachers"], ["upcoming_bookings", "Upcoming classes"], ["pending_teacher_assignments", "Teacher assignments"], ["unresolved_contact_messages", "Unresolved messages"], ["pending_payments", "Pending payments"]];

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const r = await api.get("/admin/dashboard/metrics"); setMetrics(r.data?.metrics ?? r.data ?? {}); } catch (err) { setError(err.response?.data?.detail || "Unable to load admin data."); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  return <DashboardLayout navItems={navItems}>
    <div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Admin operations</h1><p className="mt-1 text-sm text-chalk-muted">Manage students, teachers, bookings, payments and operations.</p></div>
    <div className="flex-1 overflow-auto px-8 py-7">{error && <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}{loading ? <p className="text-sm text-chalk-muted">Loading admin dashboard…</p> : <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{metricLabels.map(([key, label]) => <div key={key} className="rounded-xl border border-chalk-faint bg-panel-2 p-5"><p className="text-xs text-chalk-muted">{label}</p><p className="mt-2 font-display text-2xl">{metrics?.[key] ?? 0}</p></div>)}</div>}</div>
  </DashboardLayout>;
}
