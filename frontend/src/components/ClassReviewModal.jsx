import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function ClassReviewModal({ sessionId, open, onClose }) {
  const [step, setStep] = useState("quick");
  const [role, setRole] = useState(null);
  const [points, setPoints] = useState([]);
  const [checked, setChecked] = useState([]);
  const [opinion, setOpinion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || !sessionId) return;
    setStep("quick");
    setChecked([]);
    setOpinion("");
    setError("");
    api.get(`/classroom/reviews/sessions/${sessionId}/options`)
      .then(({ data }) => {
        if (data?.submitted) { onClose(); navigate(data?.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"); return; }
        setRole(data?.role || null);
        setPoints(data?.points || []);
      })
      .catch(() => setError("Unable to load the review form."));
  }, [open, sessionId]);

  if (!open) return null;

  const isTeacher = role === "teacher";
  const title = isTeacher ? "How was your student?" : "How was your class?";

  const finish = () => { onClose(); navigate(isTeacher ? "/dashboard/teacher" : "/dashboard/student"); };

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.post(`/classroom/reviews/sessions/${sessionId}`, {
        checked_points: checked,
        additional_opinion: opinion.trim() || null,
      });
      finish();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to submit your review.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4">
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl text-white">
      {step === "quick" ? <>
        <div className="text-lg font-semibold">Quick review</div>
        <p className="mt-2 text-sm text-slate-400">Your class has ended. Take a moment to share quick feedback about the class.</p>
        {error && <div className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={finish} className="rounded-lg bg-white/10 px-4 py-2 text-sm">Skip</button>
          <button type="button" disabled={!!error || !role} onClick={() => setStep("form")} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">Start review</button>
        </div>
      </> : <>
        <div className="text-lg font-semibold">{title}</div>
        <p className="mt-1 text-xs text-slate-400">Select all that apply.</p>
        <div className="mt-5 space-y-3">
          {points.map((point) => <label key={point} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <input type="checkbox" checked={checked.includes(point)} onChange={(e) => setChecked((items) => e.target.checked ? [...items, point] : items.filter((item) => item !== point))} className="mt-0.5 h-4 w-4" />
            <span className="text-sm text-slate-200">{point}</span>
          </label>)}
        </div>
        <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)} maxLength={5000} rows={4} placeholder="Additional opinions (optional)" className="mt-4 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm outline-none placeholder:text-slate-500 focus:border-red-500" />
        {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={finish} disabled={loading} className="rounded-lg bg-white/10 px-4 py-2 text-sm disabled:opacity-50">Skip</button>
          <button type="button" onClick={submit} disabled={loading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? "Submitting…" : "Submit review"}</button>
        </div>
      </>}
    </div>
  </div>;
}
