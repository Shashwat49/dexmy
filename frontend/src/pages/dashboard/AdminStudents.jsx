
function DetailItem({ label, value }) {
  return <div className="rounded-lg border border-chalk-faint bg-panel px-4 py-3"><p className="text-[10px] uppercase tracking-wide text-chalk-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value === null || value === undefined || value === "" ? "—" : value}</p></div>;
}

import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

export default function AdminStudents() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async ({ manual = false } = {}) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const params = { page, page_size: 25 };
      if (search.trim()) params.search = search.trim();
      if (active !== "") params.is_active = active === "true";
      const response = await api.get("/admin/students", { params });
      const next = response.data || { items: [], total: 0 };
      setData({ items: Array.isArray(next.items) ? next.items : [], total: Number(next.total || 0) });
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load students.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, active]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.post("/admin/notifications/read-all").catch(() => {});
  }, []);

  async function toggle(student) {
    const reason = window.prompt(student.is_active ? "Reason for suspension:" : "Reason for activation:");
    if (!reason?.trim()) return;
    try {
      await api.patch(`/admin/students/${student.id}/status`, { is_active: !student.is_active, reason: reason.trim() });
      await load({ manual: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to update student.");
    }
  }

  function submitSearch(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  async function openStudent(student) {
    setSelectedStudent(student);
    setStudentDetail(null);
    setDetailLoading(true);
    try {
      const response = await api.get(`/admin/students/${student.id}`);
      setStudentDetail(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load student details.");
      setSelectedStudent(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeStudent() {
    if (detailLoading) return;
    setSelectedStudent(null);
    setStudentDetail(null);
  }

  return <DashboardLayout>
    <div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Students</h1><p className="mt-1 text-sm text-chalk-muted">Review student accounts, activity and access.</p></div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
      <form onSubmit={submitSearch} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone" className="min-w-0 flex-1 rounded-lg border border-chalk-faint bg-panel-2 px-4 py-2.5 text-sm outline-none focus:border-brand-red" />
        <select value={active} onChange={e => { setActive(e.target.value); setPage(1); }} className="rounded-lg border border-chalk-faint bg-panel-2 px-4 py-2.5 text-sm"><option value="">All students</option><option value="true">Active</option><option value="false">Suspended</option></select>
        <button className="rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold">Search</button>
        <button type="button" onClick={() => load({ manual: true })} disabled={refreshing || loading} className="rounded-lg border border-chalk-faint px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{refreshing ? "Refreshing…" : "Refresh"}</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-chalk-faint bg-panel-2">
        {loading ? <div className="px-6 py-10 text-sm text-chalk-muted">Loading students…</div> : data.items.length === 0 ? <div className="px-6 py-10 text-sm text-chalk-muted">No students found.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Grade / School</th><th className="px-5 py-4">Classes</th><th className="px-5 py-4">Status</th><th className="px-5 py-4" /></tr></thead><tbody className="divide-y divide-chalk-faint">{data.items.map(student => <tr key={student.id} onClick={() => openStudent(student)} className="cursor-pointer hover:bg-panel transition-colors"><td className="px-5 py-4"><div className="font-semibold">{student.full_name}</div><div className="text-xs text-chalk-muted">{student.email}</div></td><td className="px-5 py-4 text-chalk-muted">{student.grade_level || "—"}<br />{student.school_name || "—"}</td><td className="px-5 py-4"><span>{student.completed_classes} completed</span><br /><span className="text-xs text-chalk-muted">{student.upcoming_classes} upcoming</span></td><td className="px-5 py-4"><span className={student.is_active ? "text-emerald-400" : "text-brand-red"}>{student.is_active ? "Active" : "Suspended"}</span></td><td className="px-5 py-4 text-right"><button onClick={(e) => { e.stopPropagation(); toggle(student); }} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold hover:border-brand-red">{student.is_active ? "Suspend" : "Activate"}</button></td></tr>)}</tbody></table></div>}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-chalk-muted"><span>{data.total} students</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-chalk-faint px-3 py-2 disabled:opacity-40">Previous</button><span className="px-2 py-2">Page {page}</span><button disabled={page * 25 >= data.total} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-chalk-faint px-3 py-2 disabled:opacity-40">Next</button></div></div>
      {selectedStudent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeStudent}>
        <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-chalk-faint bg-panel-2 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-chalk-faint pb-4">
            <div><h2 className="font-display text-2xl">{selectedStudent.full_name}</h2><p className="mt-1 text-sm text-chalk-muted">{selectedStudent.email}</p></div>
            <button onClick={closeStudent} className="rounded-lg px-2 py-1 text-xl text-chalk-muted hover:bg-panel hover:text-chalk" aria-label="Close">×</button>
          </div>
          {detailLoading ? <div className="py-12 text-center text-sm text-chalk-muted">Loading student details…</div> : studentDetail && <div className="mt-5 space-y-6">
            <section><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-chalk-muted">Personal Details</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><DetailItem label="Full name" value={studentDetail.full_name}/><DetailItem label="Email" value={studentDetail.email}/><DetailItem label="Phone" value={studentDetail.phone}/><DetailItem label="Date of birth" value={studentDetail.date_of_birth}/><DetailItem label="Grade level" value={studentDetail.grade_level}/><DetailItem label="School" value={studentDetail.school_name}/></div></section>
            <section><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-chalk-muted">Account</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><DetailItem label="Status" value={studentDetail.is_active ? "Active" : "Suspended"}/><DetailItem label="Email verified" value={studentDetail.email_verified ? "Yes" : "No"}/><DetailItem label="Account created" value={studentDetail.created_at ? new Date(studentDetail.created_at).toLocaleString() : null}/><DetailItem label="Student ID" value={studentDetail.id}/></div></section>
            <section><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-chalk-muted">Class & Booking Details</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><DetailItem label="Total bookings" value={studentDetail.total_bookings}/><DetailItem label="Completed" value={studentDetail.completed_classes}/><DetailItem label="Upcoming" value={studentDetail.upcoming_classes}/><DetailItem label="Pending" value={studentDetail.pending_classes}/><DetailItem label="Confirmed" value={studentDetail.confirmed_classes}/><DetailItem label="Cancelled" value={studentDetail.cancelled_classes}/><DetailItem label="No-show" value={studentDetail.no_show_classes}/></div></section>
          </div>}
        </div>
      </div>}
    </div>
  </DashboardLayout>;
}
