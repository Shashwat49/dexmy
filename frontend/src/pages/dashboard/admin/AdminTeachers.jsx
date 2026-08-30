import { useEffect, useState } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import api from "../../../api/client";

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filters, setFilters] = useState({ verified: "", active: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [showRequests, setShowRequests] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filters.verified !== "") params.verified = filters.verified;
      if (filters.active !== "") params.active = filters.active;
      const [a, b] = await Promise.all([
        api.get("/admin/teachers", { params }),
        api.get("/admin/teachers/profile-change-requests"),
      ]);
      setTeachers(a.data || []);
      setRequests((b.data || []).filter((r) => r.status === "pending"));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load teachers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filters.verified, filters.active]);

  async function openTeacherDetails(teacherId) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await api.get(`/admin/teachers/${teacherId}`);
      setSelectedTeacher(response.data);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load teacher details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function verifyTeacher(teacherId) {
    setBusy(`verify-${teacherId}`);
    setError("");
    try {
      await api.patch(`/admin/teachers/${teacherId}/verify`);
      await load();
      if (selectedTeacher?.id === teacherId) {
        const response = await api.get(`/admin/teachers/${teacherId}`);
        setSelectedTeacher(response.data);
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to verify teacher.");
    } finally {
      setBusy(null);
    }
  }

  async function review(id, decision) {
    const reason = window.prompt(
      decision === "approved"
        ? "Optional approval note:"
        : "Reason for rejecting this profile change:"
    );
    if (reason === null) return;
    if (decision === "rejected" && !reason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setBusy(id);
    try {
      await api.patch(`/admin/teachers/profile-change-requests/${id}/review`, {
        status: decision,
        review_reason: reason.trim(),
      });
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to review request.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(t) {
    const next = !t.is_active;
    const reason = window.prompt(
      next ? "Reason for activating this teacher:" : "Reason for deactivating this teacher:"
    );
    if (reason === null || !reason.trim()) return;
    try {
      await api.patch(`/admin/teachers/${t.id}/status`, { is_active: next });
      await load();
      if (selectedTeacher?.id === t.id) {
        const response = await api.get(`/admin/teachers/${t.id}`);
        setSelectedTeacher(response.data);
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to update teacher status.");
    }
  }

  return (
    <DashboardLayout>
      <div className="border-b border-chalk-faint px-8 py-5.5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-2xl">Teachers</h1>
            <p className="mt-1 text-sm text-chalk-muted">
              Review teachers, verification and profile change requests.
            </p>
          </div>
          <button
            onClick={() => setShowRequests((v) => !v)}
            className="rounded-xl border border-chalk-faint bg-panel px-4 py-2.5 text-sm font-semibold"
          >
            Profile Update Requests
            {requests.length > 0 && (
              <span className="ml-2 rounded-full bg-brand-red/15 px-2 py-0.5 text-xs text-brand-red">
                {requests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {error && (
          <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">
            {error}
          </div>
        )}

        {showRequests && (
          <section className="mb-8 rounded-2xl border border-chalk-faint bg-panel p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Teacher profile approvals
                  {requests.length > 0 && (
                    <span className="ml-2 rounded-full bg-brand-red/10 px-2 py-1 text-xs text-brand-red">
                      {requests.length} pending
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-sm text-chalk-muted">
                  Review new teacher applications and profile changes before they become active.
                </p>
              </div>
              <button onClick={load} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold">
                Refresh
              </button>
            </div>
            {requests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-chalk-faint px-5 py-8 text-center text-sm text-chalk-muted">
                No pending teacher profile requests.
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="rounded-xl border border-chalk-faint bg-panel-2 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.teacher_name || r.teacher_email}</p>
                        <p className="mt-1 text-xs text-chalk-muted">
                          {r.teacher_email} · Submitted {new Date(r.created_at).toLocaleString()}
                        </p>
                        <pre className="mt-4 max-w-3xl overflow-auto rounded-lg bg-panel-3 p-4 text-xs whitespace-pre-wrap">
                          {JSON.stringify(r.requested_changes, null, 2)}
                        </pre>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          disabled={busy === r.id}
                          onClick={() => review(r.id, "approved")}
                          className="rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={busy === r.id}
                          onClick={() => review(r.id, "rejected")}
                          className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <select
            value={filters.verified}
            onChange={(e) => setFilters((f) => ({ ...f, verified: e.target.value }))}
            className="rounded-lg border border-chalk-faint bg-panel px-3 py-2 text-sm"
          >
            <option value="">All verification</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <select
            value={filters.active}
            onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value }))}
            className="rounded-lg border border-chalk-faint bg-panel px-3 py-2 text-sm"
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-chalk-muted">Loading teachers…</p>
        ) : teachers.length === 0 ? (
          <p className="rounded-xl border border-chalk-faint p-8 text-sm text-chalk-muted">
            No teachers match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
                <tr>
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-5 py-4">Verification</th>
                  <th className="px-5 py-4">Subjects</th>
                  <th className="px-5 py-4">Classes</th>
                  <th className="px-5 py-4">Rate</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk-faint">
                {teachers.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTeacherDetails(t.id)}
                    className="cursor-pointer transition hover:bg-panel"
                    title="Click to view teacher details"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold">{t.full_name}</div>
                      <div className="text-xs text-chalk-muted">{t.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      {t.is_verified ? (
                        <span className="text-emerald-400">✓ Verified</span>
                      ) : (
                        <span className="text-amber-400">Pending verification</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{t.subject_count}</td>
                    <td className="px-5 py-4">
                      {t.completed_classes} completed · {t.upcoming_classes} upcoming
                    </td>
                    <td className="px-5 py-4">{t.hourly_rate ?? "—"}</td>
                    <td className="px-5 py-4">{t.is_active ? "Active" : "Inactive"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {!t.is_verified && (
                          <button
                            disabled={busy === `verify-${t.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              verifyTeacher(t.id);
                            }}
                            className="rounded-lg bg-brand-red px-3 py-2 text-xs font-semibold disabled:opacity-50"
                          >
                            {busy === `verify-${t.id}` ? "Verifying…" : "Verify Teacher"}
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(t);
                          }}
                          className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold"
                        >
                          {t.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(selectedTeacher || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => !detailLoading && setSelectedTeacher(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-chalk-faint bg-panel p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="py-12 text-center text-sm text-chalk-muted">Loading teacher details…</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-chalk-faint pb-5">
                  <div>
                    <h2 className="font-display text-2xl">{selectedTeacher.full_name}</h2>
                    <p className="mt-1 text-sm text-chalk-muted">Teacher profile details</p>
                  </div>
                  <button
                    onClick={() => setSelectedTeacher(null)}
                    className="rounded-lg border border-chalk-faint px-3 py-2 text-sm font-semibold"
                    aria-label="Close teacher details"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Detail label="Email" value={selectedTeacher.email} />
                  <Detail label="Phone" value={selectedTeacher.phone || "—"} />
                  <Detail label="Verification" value={selectedTeacher.is_verified ? "Verified" : "Pending verification"} />
                  <Detail label="Status" value={selectedTeacher.is_active ? "Active" : "Inactive"} />
                  <Detail label="Years of experience" value={selectedTeacher.years_experience ?? "—"} />
                  <Detail label="Hourly rate" value={selectedTeacher.hourly_rate ?? "—"} />
                  <Detail label="Rating" value={selectedTeacher.rating_avg != null ? `${selectedTeacher.rating_avg} (${selectedTeacher.rating_count || 0} reviews)` : "No ratings yet"} />
                  <Detail label="Classes" value={`${selectedTeacher.completed_classes || 0} completed · ${selectedTeacher.upcoming_classes || 0} upcoming`} />
                  <Detail label="Joined" value={selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleString() : "—"} />
                </div>

                <div className="mt-5 rounded-xl border border-chalk-faint bg-panel-2 p-5">
                  <h3 className="text-sm font-semibold">Subjects</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedTeacher.subjects || []).length > 0 ? (
                      selectedTeacher.subjects.map((subject) => (
                        <span key={subject} className="rounded-full border border-chalk-faint px-3 py-1.5 text-xs">
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-chalk-muted">No subjects assigned.</span>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-chalk-faint bg-panel-2 p-5">
                  <h3 className="text-sm font-semibold">Qualifications</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-chalk-muted">
                    {selectedTeacher.qualifications || "No qualifications provided."}
                  </p>
                </div>

                <div className="mt-5 rounded-xl border border-chalk-faint bg-panel-2 p-5">
                  <h3 className="text-sm font-semibold">Bio</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-chalk-muted">
                    {selectedTeacher.bio || "No bio provided."}
                  </p>
                </div>

                {!selectedTeacher.is_verified && (
                  <div className="mt-6 flex justify-end">
                    <button
                      disabled={busy === `verify-${selectedTeacher.id}`}
                      onClick={() => verifyTeacher(selectedTeacher.id)}
                      className="rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      {busy === `verify-${selectedTeacher.id}` ? "Verifying…" : "Verify Teacher"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-chalk-faint bg-panel-2 p-4">
      <p className="text-xs text-chalk-muted">{label}</p>
      <p className="mt-1 text-sm font-medium break-words">{value}</p>
    </div>
  );
}
