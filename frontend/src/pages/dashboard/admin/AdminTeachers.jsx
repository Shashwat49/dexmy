import { useEffect, useState } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import api from "../../../api/client";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [filters, setFilters] = useState({ verified: "", active: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.verified !== "") params.verified = filters.verified;
      if (filters.active !== "") params.active = filters.active;
      const { data } = await api.get("/admin/teachers", { params });
      setTeachers(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load teachers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters.verified, filters.active]);

  async function toggleStatus(teacher) {
    const next = !teacher.is_active;
    const reason = window.prompt(next ? "Reason for activating this teacher:" : "Reason for deactivating this teacher:");
    if (reason === null) return;
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    try {
      await api.patch(`/admin/teachers/${teacher.id}/status`, {
        is_active: next,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update teacher status.");
    }
  }

  return (
    <DashboardLayout navItems={[{ label: "Operations", items: [
      { path: "/dashboard/admin", label: "Overview" },
      { path: "/dashboard/admin/students", label: "Students" },
      { path: "/dashboard/admin/teachers", label: "Teachers" },
    ] }]}>
      <div className="border-b border-chalk-faint px-8 py-5.5">
        <h1 className="font-display text-2xl">Teachers</h1>
        <p className="mt-1 text-sm text-chalk-muted">Review teacher status, verification and teaching activity.</p>
      </div>
      <div className="flex-1 overflow-auto px-8 py-7">
        {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
        <div className="mb-6 flex flex-wrap gap-3">
          <select value={filters.verified} onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value }))} className="rounded-lg border border-chalk-faint bg-panel px-3 py-2 text-sm">
            <option value="">All verification</option><option value="true">Verified</option><option value="false">Unverified</option>
          </select>
          <select value={filters.active} onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value }))} className="rounded-lg border border-chalk-faint bg-panel px-3 py-2 text-sm">
            <option value="">All status</option><option value="true">Active</option><option value="false">Inactive</option>
          </select>
        </div>
        {loading ? <p className="text-sm text-chalk-muted">Loading teachers…</p> : teachers.length === 0 ? <p className="rounded-xl border border-chalk-faint p-8 text-sm text-chalk-muted">No teachers match these filters.</p> : (
          <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Teacher</th><th className="px-5 py-4">Verification</th><th className="px-5 py-4">Subjects</th><th className="px-5 py-4">Classes</th><th className="px-5 py-4">Rate</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead>
              <tbody className="divide-y divide-chalk-faint">
                {teachers.map((teacher) => <tr key={teacher.id}>
                  <td className="px-5 py-4"><div className="font-semibold">{teacher.full_name}</div><div className="text-xs text-chalk-muted">{teacher.email}</div></td>
                  <td className="px-5 py-4">{teacher.is_verified ? "Verified" : "Unverified"}</td>
                  <td className="px-5 py-4">{teacher.subject_count}</td>
                  <td className="px-5 py-4">{teacher.completed_classes} completed · {teacher.upcoming_classes} upcoming</td>
                  <td className="px-5 py-4">{teacher.hourly_rate ?? "—"}</td>
                  <td className="px-5 py-4">{teacher.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-5 py-4"><button onClick={() => toggleStatus(teacher)} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold hover:border-brand-red">{teacher.is_active ? "Deactivate" : "Activate"}</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
