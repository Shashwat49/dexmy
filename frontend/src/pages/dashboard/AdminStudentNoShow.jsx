import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const INPUT = "w-full rounded-lg border border-chalk-faint bg-panel-2 px-3 py-2.5 text-sm text-chalk outline-none focus:border-brand-gold";
const pad = (n) => String(n).padStart(2, "0");
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function AdminStudentNoShow() {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 60 * 1000);
  const [form, setForm] = useState({
    student_id: "", student_package_id: "", teacher_id: "", subject: "Mathematics",
    started_at: localInput(start), ended_at: localInput(end), admin_notes: "",
  });

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [studentResponse, teacherResponse] = await Promise.all([
        api.get("/admin/no-show-class-records/options/students"),
        api.get("/admin/no-show-class-records/options/teachers"),
      ]);
      setStudents(studentResponse.data || []);
      setTeachers(teacherResponse.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load students and verified teachers.");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const selectStudent = (studentId) => {
    const s = students.find((x) => x.student_id === studentId);
    setForm((f) => ({ ...f, student_id: studentId, student_package_id: s?.student_package_id || "" }));
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      await api.post("/admin/no-show-class-records", {
        ...form,
        started_at: new Date(form.started_at).toISOString(),
        ended_at: new Date(form.ended_at).toISOString(),
      });
      setSuccess("No-show record created. The student's class balance was deducted and the teacher's payout was not increased.");
      setForm((f) => ({ ...f, student_id: "", student_package_id: "", teacher_id: "", admin_notes: "" }));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to create the no-show record.");
    } finally { setSaving(false); }
  };

  return <DashboardLayout>
    <div className="border-b border-chalk-faint px-8 py-5.5">
      <h1 className="font-display text-2xl">Student Did Not Join</h1>
      <p className="mt-1 text-sm text-chalk-muted">Create a Google Meet class record when the teacher was present but the student did not join.</p>
    </div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}<button onClick={load} className="ml-3 underline">Retry</button></div>}
      {success && <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-5 py-4 text-sm text-green-400">{success}</div>}
      <section className="max-w-3xl rounded-2xl border border-chalk-faint bg-panel p-6">
        {loading ? <p className="text-sm text-chalk-muted">Loading form options…</p> : <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Student</span><select required value={form.student_id} onChange={(e) => selectStudent(e.target.value)} className={INPUT}><option value="">Select student</option>{students.map((s) => <option key={s.student_id} value={s.student_id}>{s.student_name} — {s.student_email}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Verified teacher</span><select required value={form.teacher_id} onChange={(e) => setField("teacher_id", e.target.value)} className={INPUT}><option value="">Select teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} — {t.email}</option>)}</select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Subject</span><select required value={form.subject} onChange={(e) => setField("subject", e.target.value)} className={INPUT}><option>Mathematics</option><option>English</option><option>Science</option></select></label>
            <div className="rounded-lg border border-chalk-faint bg-panel-2 px-3 py-2.5"><div className="text-xs text-chalk-muted">Record status</div><div className="mt-1 text-sm font-semibold">Student did not join · Teacher was present</div></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-medium">Start time</span><input required type="datetime-local" value={form.started_at} onChange={(e) => setField("started_at", e.target.value)} className={INPUT}/></label>
            <label className="block"><span className="mb-1.5 block text-sm font-medium">End time</span><input required type="datetime-local" value={form.ended_at} onChange={(e) => setField("ended_at", e.target.value)} className={INPUT}/></label>
          </div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium">Admin notes (optional)</span><textarea value={form.admin_notes} onChange={(e) => setField("admin_notes", e.target.value)} className={`${INPUT} min-h-24`} placeholder="Optional note for the class record"/></label>
          <button disabled={saving || !form.student_id || !form.student_package_id || !form.teacher_id} className="w-full rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Creating record…" : "Create No-Show Record"}</button>
        </form>}
      </section>
    </div>
  </DashboardLayout>;
}
