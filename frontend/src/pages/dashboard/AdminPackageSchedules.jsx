import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function tomorrowLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function displayDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " IST";
}
const inputClass = "mt-1 w-full rounded-xl border border-chalk-faint bg-panel px-3 py-2.5 text-sm text-chalk outline-none focus:border-brand-gold";
const labelClass = "block text-sm font-medium text-chalk-muted";

export default function AdminPackageSchedules() {
  const [options, setOptions] = useState({ packages: [], subjects: [], teachers: [] });
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({
    student_package_id: "",
    subject_id: "",
    teacher_id: "",
    start_date: tomorrowLocal(),
    start_time: "18:00",
    weekdays: [1, 3, 5],
    duration_minutes: 55,
    class_count: 1,
  });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalKey, setApprovalKey] = useState(() => crypto.randomUUID());

  const selectedPackage = options.packages.find((p) => p.id === form.student_package_id);
  const eligibleTeachers = useMemo(
    () => options.teachers.filter((t) => form.subject_id && t.subject_ids.includes(Number(form.subject_id))),
    [options.teachers, form.subject_id],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [optionsResponse, schedulesResponse] = await Promise.all([
        api.get("/admin/package-schedules/options"),
        api.get("/admin/package-schedules"),
      ]);
      const nextOptions = optionsResponse.data || { packages: [], subjects: [], teachers: [] };
      setOptions(nextOptions);
      setSchedules(schedulesResponse.data || []);
      setForm((current) => {
        const packageStillExists = nextOptions.packages.some((p) => p.id === current.student_package_id);
        const pkg = nextOptions.packages.find((p) => p.id === (packageStillExists ? current.student_package_id : nextOptions.packages[0]?.id));
        return {
          ...current,
          student_package_id: pkg?.id || "",
          subject_id: current.subject_id || String(nextOptions.subjects[0]?.id || ""),
          class_count: pkg?.remaining_classes == null ? 32 : Math.min(120, pkg.remaining_classes),
        };
      });
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load package scheduling data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setError("");
    setNotice("");
    setApprovalKey(crypto.randomUUID());
  }
  function selectPackage(value) {
    const pkg = options.packages.find((p) => p.id === value);
    setForm((current) => ({
      ...current,
      student_package_id: value,
      class_count: pkg?.remaining_classes == null ? 32 : Math.min(120, pkg.remaining_classes),
    }));
    setPreview(null);
    setApprovalKey(crypto.randomUUID());
  }
  function toggleWeekday(value) {
    const days = form.weekdays.includes(value)
      ? form.weekdays.filter((day) => day !== value)
      : [...form.weekdays, value];
    setField("weekdays", days);
  }
  function payload() {
    return {
      student_package_id: form.student_package_id,
      subject_id: Number(form.subject_id),
      teacher_id: form.teacher_id,
      start_date: form.start_date,
      start_time: form.start_time,
      weekdays: form.weekdays,
      duration_minutes: Number(form.duration_minutes),
      class_count: Number(form.class_count),
    };
  }
  async function makePreview(event) {
    event.preventDefault();
    setPreviewing(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post("/admin/package-schedules/preview", payload());
      setPreview(response.data);
      if (!response.data?.valid) setError("There are conflicts in the proposed schedule. Resolve them before approval.");
    } catch (e) {
      setPreview(null);
      const detail = e.response?.data?.detail;
      setError(typeof detail === "string" ? detail : detail?.message || "Unable to validate this schedule.");
    } finally {
      setPreviewing(false);
    }
  }
  async function cancelSchedule(item) {
    if (!window.confirm("Cancel all future classes in this package schedule and restore their package credits? Completed/past class records will remain unchanged.")) return;
    setError("");
    setNotice("");
    try {
      const response = await api.post(`/admin/package-schedules/${item.id}/cancel-future`);
      setNotice(`Schedule cancelled. ${response.data.cancelled_future_classes} future classes cancelled and ${response.data.credits_restored} credits restored.`);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to cancel future schedule classes.");
    }
  }

  async function approveSchedule() {
    if (!preview?.valid || approving) return;
    setApproving(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post("/admin/package-schedules/approve", {
        ...payload(),
        idempotency_key: approvalKey,
      });
      setNotice(`Schedule approved. ${response.data.class_count ?? response.data.booking_ids?.length ?? 0} classes were assigned to the teacher and student calendars.`);
      setPreview(null);
      setApprovalKey(crypto.randomUUID());
      await load();
    } catch (e) {
      const detail = e.response?.data?.detail;
      setError(typeof detail === "string" ? detail : detail?.message || "Approval failed. No partial schedule was committed; refresh the preview and try again.");
      if (detail?.conflicts) setPreview((current) => current ? { ...current, valid: false, conflicts: detail.conflicts } : current);
    } finally {
      setApproving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 md:px-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">Academic operations</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Package Schedules</h1>
          <p className="mt-2 max-w-3xl text-sm text-chalk-muted">
            Build a recurring timetable for a purchased package. Validate every occurrence, then approve once to create the same class records in the teacher and student calendars.
          </p>
        </header>

        {error && <div role="alert" className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

        <section className="rounded-2xl border border-chalk-faint bg-panel p-5 md:p-7">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Create recurring schedule</h2>
            <p className="mt-1 text-sm text-chalk-muted">Approval reserves package credits and creates all class occurrences in one database transaction.</p>
          </div>
          {loading ? <p className="text-sm text-chalk-muted">Loading students, packages and teachers…</p> : options.packages.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">No active student packages with available credits were found.</div>
          ) : (
            <form onSubmit={makePreview} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className={labelClass}>Student package
                  <select required className={inputClass} value={form.student_package_id} onChange={(e) => selectPackage(e.target.value)}>
                    {options.packages.map((p) => <option key={p.id} value={p.id}>{p.student_name} — {p.package_name} ({p.remaining_classes == null ? "Unlimited" : `${p.remaining_classes} credits left`})</option>)}
                  </select>
                </label>
                <label className={labelClass}>Subject
                  <select required className={inputClass} value={form.subject_id} onChange={(e) => { setField("subject_id", e.target.value); setField("teacher_id", ""); }}>
                    {options.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className={labelClass}>Verified teacher
                  <select required className={inputClass} value={form.teacher_id} onChange={(e) => setField("teacher_id", e.target.value)}>
                    <option value="">Select eligible teacher</option>
                    {eligibleTeachers.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.email}</option>)}
                  </select>
                </label>
                <label className={labelClass}>First eligible date
                  <input required type="date" min={tomorrowLocal()} className={inputClass} value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
                </label>
                <label className={labelClass}>Start time (IST)
                  <select required className={inputClass} value={form.start_time} onChange={(e) => setField("start_time", e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => i + 10).filter((hour) => hour < 22).map((hour) => {
                      const value = `${String(hour).padStart(2, "0")}:00`;
                      const label = new Date(`2000-01-01T${value}:00+05:30`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
                      return <option key={value} value={value}>{label}</option>;
                    })}
                  </select>
                </label>
                <label className={labelClass}>Class duration
                  <select className={inputClass} value={form.duration_minutes} onChange={(e) => setField("duration_minutes", Number(e.target.value))}>
                    <option value={55}>55 minutes + existing slot buffer</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </label>
                <label className={labelClass}>Number of classes
                  <input required type="number" min="1" max={Math.min(120, selectedPackage?.remaining_classes ?? 120)} className={inputClass} value={form.class_count} onChange={(e) => setField("class_count", Number(e.target.value))} />
                  <span className="mt-1 block text-xs text-chalk-muted">{selectedPackage?.remaining_classes == null ? "Unlimited package; up to 120 occurrences per schedule." : `Available credits: ${selectedPackage.remaining_classes}`}</span>
                </label>
              </div>
              <fieldset>
                <legend className={labelClass}>Recurring days</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => <label key={day.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${form.weekdays.includes(day.value) ? "border-brand-gold/60 bg-brand-gold/10 text-chalk" : "border-chalk-faint text-chalk-muted"}`}>
                    <input type="checkbox" checked={form.weekdays.includes(day.value)} onChange={() => toggleWeekday(day.value)} />
                    {day.label}
                  </label>)}
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center gap-3">
                <button disabled={previewing || !form.student_package_id || !form.subject_id || !form.teacher_id || !form.weekdays.length || !form.class_count} className="rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {previewing ? "Checking every class…" : "Validate schedule"}
                </button>
                <span className="text-xs text-chalk-muted">No credits are reserved until approval succeeds.</span>
              </div>
            </form>
          )}
        </section>

        {preview && <section className="rounded-2xl border border-chalk-faint bg-panel p-5 md:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Schedule preview</h2>
              <p className="mt-1 text-sm text-chalk-muted">{preview.class_count} occurrences · {preview.duration_minutes} minutes · Asia/Kolkata</p>
              <p className="mt-1 text-sm text-chalk-muted">Student: {preview.student_name} · Teacher: {preview.teacher_name}</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${preview.valid ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}>{preview.valid ? "All slots validated" : "Conflicts found"}</span>
          </div>
          {preview.conflicts?.length > 0 && <ul className="mt-4 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">{preview.conflicts.map((item) => <li key={item}>{item}</li>)}</ul>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {preview.dates?.map((item) => <div key={item} className="rounded-lg border border-chalk-faint px-3 py-2 text-sm">{displayDate(item)}</div>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={!preview.valid || approving} onClick={approveSchedule} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {approving ? "Approving atomically…" : "Approve and assign all classes"}
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-chalk-faint px-5 py-3 text-sm font-semibold text-chalk-muted">Discard preview</button>
          </div>
          <p className="mt-3 text-xs text-chalk-muted">Approval revalidates slots in the backend. If another booking claims a slot meanwhile, the transaction rolls back and no partial schedule is created.</p>
        </section>}

        <section className="rounded-2xl border border-chalk-faint bg-panel p-5 md:p-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Recently approved schedules</h2><p className="mt-1 text-sm text-chalk-muted">All occurrences are shared booking records used by both calendars.</p></div>
            <button type="button" onClick={load} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs font-semibold">Refresh</button>
          </div>
          {schedules.length === 0 ? <p className="text-sm text-chalk-muted">No recurring package schedules yet.</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Teacher</th><th className="py-3 pr-4">Subject</th><th className="py-3 pr-4">Pattern</th><th className="py-3 pr-4">Classes</th><th className="py-3 pr-4">Status</th><th className="py-3">Actions</th></tr></thead>
              <tbody>{schedules.map((item) => <tr key={item.id} className="border-b border-chalk-faint/60 last:border-0"><td className="py-3 pr-4">{item.student_name}</td><td className="py-3 pr-4">{item.teacher_name}</td><td className="py-3 pr-4">{item.subject_name}</td><td className="py-3 pr-4">{item.weekday_labels.join(", ")} · {item.start_time}</td><td className="py-3 pr-4">{item.created_classes}/{item.class_count}</td><td className="py-3 pr-4"><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === "approved" ? "bg-emerald-500/10 text-emerald-300" : "bg-chalk-faint text-chalk-muted"}`}>{item.status}</span></td><td className="py-3">{item.status === "approved" ? <button type="button" onClick={() => cancelSchedule(item)} className="rounded-lg border border-brand-red/40 px-3 py-1.5 text-xs font-semibold text-brand-red hover:bg-brand-red/10">Cancel future classes</button> : <span className="text-xs text-chalk-muted">—</span>}</td></tr>)}</tbody>
            </table>
          </div>}
        </section>
      </div>
    </DashboardLayout>
  );
}
