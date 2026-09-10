import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const formatDate = (value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const formatTime = (value) => new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function AdminMeetClassRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/meet-class-records");
      setRecords(response.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load Meet class records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <DashboardLayout>
      <div className="border-b border-chalk-faint px-8 py-5.5">
        <h1 className="font-display text-2xl">Meet Class Records</h1>
        <p className="mt-1 text-sm text-chalk-muted">Google Meet classes logged by teachers, including student, teacher, timing, notes and homework.</p>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}<button onClick={load} className="ml-3 underline">Retry</button></div>}

        {loading ? <p className="text-sm text-chalk-muted">Loading Meet class records…</p> : (
          <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-5 py-4">Subject / Topic</th>
                  <th className="px-5 py-4">Class Time</th>
                  <th className="px-5 py-4">Duration</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Teacher Notes</th>
                  <th className="px-5 py-4">Homework</th>
                  <th className="px-5 py-4">Meet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk-faint">
                {records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="px-5 py-4"><div className="font-semibold">{record.student_name}</div><div className="text-xs text-chalk-muted">{record.student_email}</div></td>
                    <td className="px-5 py-4">{record.teacher_name}</td>
                    <td className="px-5 py-4"><div className="font-semibold">{record.subject}</div><div className="text-xs text-chalk-muted">{record.topic}</div></td>
                    <td className="whitespace-nowrap px-5 py-4">{formatDate(record.started_at)}<div className="text-xs text-chalk-muted">{formatTime(record.started_at)} – {formatTime(record.ended_at)}</div></td>
                    <td className="px-5 py-4">{record.duration_minutes} min</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-3 py-1.5 text-xs ${record.status === "completed" ? "bg-green-500/10 text-green-400" : "bg-amber-400/10 text-amber-300"}`}>{record.status}</span></td>
                    <td className="max-w-[260px] whitespace-pre-wrap px-5 py-4 text-xs text-chalk-muted">{record.teacher_notes || "—"}</td>
                    <td className="max-w-[260px] whitespace-pre-wrap px-5 py-4 text-xs text-chalk-muted">{record.homework || "—"}</td>
                    <td className="px-5 py-4">{record.google_meet_link ? <a href={record.google_meet_link} target="_blank" rel="noreferrer" className="text-brand-gold hover:underline">Open Meet</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {records.length === 0 && <div className="px-6 py-12 text-center text-sm text-chalk-muted">No Meet class records have been logged yet.</div>}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
