import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Operations", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/students", label: "Students" },
] }];

export default function AdminStudents() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const params = { page, page_size: 25 };
      if (search.trim()) params.search = search.trim();
      if (active !== "") params.is_active = active === "true";
      const response = await api.get("/admin/students", { params });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load students.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [page, active]);

  async function toggle(student) {
    const reason = window.prompt(student.is_active ? "Reason for suspension:" : "Reason for activation:");
    if (!reason?.trim()) return;
    try {
      await api.patch(`/admin/students/${student.id}/status`, {
        is_active: !student.is_active,
        reason: reason.trim(),
      });
      await load();
    } catch (err) { setError(err.response?.data?.detail || "Unable to update student."); }
  }

  return <DashboardLayout navItems={navItems}>
    <div className="border-b border-chalk-faint px-8 py-5.5">
      <h1 className="font-display text-2xl">Students</h1>
      <p className="mt-1 text-sm text-chalk-muted">Review student accounts, activity and access.</p>
    </div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="min-w-0 flex-1 rounded-lg border border-chalk-faint bg-panel-2 px-4 py-2.5 text-sm outline-none focus:border-brand-red" />
        <select value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="rounded-lg border border-chalk-faint bg-panel-2 px-4 py-2.5 text-sm">
          <option value="">All students</option><option value="true">Active</option><option value="false">Suspended</option>
        </select>
        <button className="rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold">Search</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-chalk-faint bg-panel-2">
        {loading ? <div className="px-6 py-10 text-sm text-chalk-muted">Loading students…</div> : data.items.length === 0 ? <div className="px-6 py-10 text-sm text-chalk-muted">No students found.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Grade / School</th><th className="px-5 py-4">Classes</th><th className="px-5 py-4">Status</th><th className="px-5 py-4" /></tr></thead><tbody className="divide-y divide-chalk-faint">{data.items.map((student) => <tr key={student.id}><td className="px-5 py-4"><div className="font-semibold">{student.full_name}</div><div className="text-xs text-chalk-muted">{student.email}</div></td><td className="px-5 py-4 text-chalk-muted">{student.grade_level || "—"}<br />{student.school_name || "—"}</td><td className="px-5 py-4"><span>{student.completed_classes} completed</span><br /><span className="text-xs text-chalk-muted">{student.upcoming_classes} upcoming</span></td><td className="px-5 py-4"><span className={student.is_active ? "text-emerald-400" : "text-brand-red"}>{student.is_active ? "Active" : "Suspended"}</span></td><td className="px-5 py-4 text-right"><button onClick={() => toggle(student)} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold hover:border-brand-red">{student.is_active ? "Suspend" : "Activate"}</button></td></tr>)}</tbody></table></div>}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-chalk-muted"><span>{data.total} students</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-chalk-faint px-3 py-2 disabled:opacity-40">Previous</button><span className="px-2 py-2">Page {page}</span><button disabled={page * 25 >= data.total} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-chalk-faint px-3 py-2 disabled:opacity-40">Next</button></div></div>
    </div>
  </DashboardLayout>;
}
