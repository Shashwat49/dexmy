import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

export default function AdminBookings() {
  const [items, setItems] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assigning, setAssigning] = useState(null);
  const [discarding, setDiscarding] = useState(null);
  const [teacherLists, setTeacherLists] = useState({});
  const [selected, setSelected] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [bookingsResponse, pendingResponse] = await Promise.all([
        api.get("/admin/bookings", {
          params: { page: 1, page_size: 100, ...(status ? { status } : {}) },
        }),
        api.get("/admin/bookings/pending-teacher-assignment"),
      ]);
      setItems(bookingsResponse.data?.items || []);
      setPendingRequests(pendingResponse.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function openAssign(b) {
    setAssigning(b.id);
    setError("");
    try {
      const r = await api.get(`/admin/bookings/${b.id}/eligible-teachers`);
      setTeacherLists((x) => ({ ...x, [b.id]: r.data || [] }));
      setSelected((x) => ({ ...x, [b.id]: "" }));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load eligible teachers.");
    } finally {
      setAssigning(null);
    }
  }

  async function assign(b) {
    const teacherId = selected[b.id];
    if (!teacherId) return;
    if (!window.confirm("Assign this teacher to the booking?")) return;

    setAssigning(b.id);
    setError("");
    try {
      await api.post(`/admin/bookings/${b.id}/assign-teacher`, { teacher_id: teacherId });
      const chosen = (teacherLists[b.id] || []).find((t) => t.id === teacherId);
      const assignedName = chosen?.full_name || "Assigned";

      setItems((x) => x.map((row) => row.id === b.id
        ? { ...row, teacher_id: teacherId, teacher_name: assignedName, teacher_assignment_status: "assigned" }
        : row));
      setPendingRequests((x) => x.filter((row) => row.booking_id !== b.id));
      setTeacherLists((x) => ({ ...x, [b.id]: undefined }));
      setSelected((x) => ({ ...x, [b.id]: undefined }));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to assign teacher.");
    } finally {
      setAssigning(null);
    }
  }

  async function discardAssignment(request) {
    if (!window.confirm("Discard the teacher assignment request for this booking? The booking will remain confirmed, but it will no longer appear in Pending Teacher Assignment.")) return;

    setDiscarding(request.booking_id);
    setError("");
    try {
      await api.post(`/admin/bookings/${request.booking_id}/discard-teacher-assignment`);
      setPendingRequests((x) => x.filter((row) => row.booking_id !== request.booking_id));
      setItems((x) => x.map((row) => row.id === request.booking_id
        ? { ...row, teacher_assignment_status: "discarded" }
        : row));
      setTeacherLists((x) => ({ ...x, [request.booking_id]: undefined }));
      setSelected((x) => ({ ...x, [request.booking_id]: undefined }));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to discard teacher assignment request.");
    } finally {
      setDiscarding(null);
    }
  }

  const pendingIds = new Set(pendingRequests.map((request) => request.booking_id));
  const pendingItems = items.filter((booking) => pendingIds.has(booking.id));

  return (
    <DashboardLayout>
      <div className="border-b border-chalk-faint px-8 py-5.5">
        <h1 className="font-display text-2xl">Bookings</h1>
        <p className="mt-1 text-sm text-chalk-muted">Monitor class schedules and assign eligible teachers.</p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}

        {pendingRequests.length > 0 && (
          <div className="mb-7 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg">Pending Teacher Assignment</h2>
                <p className="mt-1 text-xs text-chalk-muted">New confirmed bookings waiting for a teacher.</p>
              </div>
              <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-300">{pendingRequests.length} pending</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
                  <tr>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Subject</th>
                    <th className="px-5 py-4">Schedule</th>
                    <th className="px-5 py-4">Assignment</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk-faint">
                  {pendingRequests.map((request) => {
                    const booking = pendingItems.find((item) => item.id === request.booking_id);
                    const candidates = teacherLists[request.booking_id] || [];
                    return (
                      <tr key={request.booking_id}>
                        <td className="px-5 py-4">
                          <div className="font-semibold">{request.student_name}</div>
                          <div className="text-xs text-chalk-muted">{request.student_id}</div>
                        </td>
                        <td className="px-5 py-4">{request.subject_name}</td>
                        <td className="px-5 py-4">
                          {new Date(request.scheduled_at).toLocaleString()}
                          <div className="text-xs text-chalk-muted">{request.duration_minutes} min</div>
                        </td>
                        <td className="px-5 py-4 text-amber-300">{request.teacher_assignment_status || "pending"}</td>
                        <td className="px-5 py-4">
                          {booking && teacherLists[booking.id] !== undefined ? (
                            <div className="min-w-[420px]">
                              <div className="mb-2 text-xs text-chalk-muted">
                                {candidates.filter((t) => t.is_available).length} available / {candidates.length} eligible
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={selected[booking.id] || ""}
                                  onChange={(e) => setSelected((x) => ({ ...x, [booking.id]: e.target.value }))}
                                  className="max-w-[220px] rounded-lg border border-chalk-faint bg-panel px-2 py-2 text-xs"
                                >
                                  <option value="">Select available teacher</option>
                                  {candidates.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id} disabled={!teacher.is_available}>
                                      {teacher.full_name}{teacher.is_available ? " — Available" : " — Busy"}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  disabled={!selected[booking.id] || assigning === booking.id || discarding === booking.id}
                                  onClick={() => assign(booking)}
                                  className="rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold disabled:opacity-50"
                                >
                                  Assign
                                </button>
                                <button
                                  disabled={assigning === booking.id || discarding === booking.id}
                                  onClick={() => discardAssignment(request)}
                                  className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold text-chalk-muted hover:border-brand-red hover:text-brand-red disabled:opacity-50"
                                >
                                  {discarding === booking.id ? "Discarding…" : "Discard"}
                                </button>
                              </div>
                              {candidates.length === 0 && <div className="text-xs text-brand-red">No eligible teachers found.</div>}
                            </div>
                          ) : booking ? (
                            <div className="flex items-center gap-2">
                              <button
                                disabled={assigning === booking.id || discarding === booking.id}
                                onClick={() => openAssign(booking)}
                                className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold hover:border-brand-red disabled:opacity-50"
                              >
                                {assigning === booking.id ? "Loading…" : "View Eligible Teachers"}
                              </button>
                              <button
                                disabled={assigning === booking.id || discarding === booking.id}
                                onClick={() => discardAssignment(request)}
                                className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold text-chalk-muted hover:border-brand-red hover:text-brand-red disabled:opacity-50"
                              >
                                {discarding === booking.id ? "Discarding…" : "Discard"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-brand-red">Booking not found in current list</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mb-6">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-chalk-faint bg-panel px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? <p className="text-sm text-chalk-muted">Loading bookings…</p> : (
          <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
                <tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Subject</th><th className="px-5 py-4">Teacher</th><th className="px-5 py-4">Schedule</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Assignment</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-chalk-faint">
                {items.map((b) => {
                  const candidates = teacherLists[b.id] || [];
                  const isDiscarded = b.teacher_assignment_status === "discarded";
                  return (
                    <tr key={b.id}>
                      <td className="px-5 py-4"><div className="font-semibold">{b.student_name}</div><div className="text-xs text-chalk-muted">{b.student_id}</div></td>
                      <td className="px-5 py-4">{b.subject_name}</td>
                      <td className="px-5 py-4">{b.teacher_name || "Unassigned"}</td>
                      <td className="px-5 py-4">{new Date(b.scheduled_at).toLocaleString()}<div className="text-xs text-chalk-muted">{b.duration_minutes} min</div></td>
                      <td className="px-5 py-4">{b.status}</td>
                      <td className={`px-5 py-4 ${isDiscarded ? "font-semibold text-red-300" : ""}`}>{isDiscarded ? "Discarded" : (b.teacher_assignment_status || "—")}</td>
                      <td className="px-5 py-4">{b.price == null ? "—" : b.price}</td>
                      <td className="px-5 py-4">
                        {!b.teacher_id && b.status === "confirmed" && !isDiscarded ? (
                          <div className="min-w-[360px]">
                            {teacherLists[b.id] !== undefined ? (
                              <>
                                <div className="mb-2 text-xs text-chalk-muted">{candidates.filter((t) => t.is_available).length} available / {candidates.length} eligible</div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select value={selected[b.id] || ""} onChange={(e) => setSelected((x) => ({ ...x, [b.id]: e.target.value }))} className="max-w-[210px] rounded-lg border border-chalk-faint bg-panel px-2 py-2 text-xs">
                                    <option value="">Select available teacher</option>
                                    {candidates.map((t) => <option key={t.id} value={t.id} disabled={!t.is_available}>{t.full_name}{t.is_available ? " — Available" : " — Busy"}</option>)}
                                  </select>
                                  <button disabled={!selected[b.id] || assigning === b.id} onClick={() => assign(b)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold disabled:opacity-50">Assign</button>
                                </div>
                                {candidates.length === 0 && <div className="text-xs text-brand-red">No eligible teachers found.</div>}
                              </>
                            ) : (
                              <button disabled={assigning === b.id} onClick={() => openAssign(b)} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold hover:border-brand-red">{assigning === b.id ? "Loading…" : "View Eligible Teachers"}</button>
                            )}
                          </div>
                        ) : b.teacher_id ? <span className="text-xs text-chalk-muted">Assigned</span> : isDiscarded ? <span className="text-xs font-semibold text-red-300">Discarded</span> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 && <div className="px-6 py-10 text-sm text-chalk-muted">No bookings found.</div>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
