import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/classroom/reviews/admin");
      setReviews(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load reviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return <DashboardLayout>
    <div className="border-b border-chalk-faint px-8 py-5.5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Class Reviews</h1>
          <p className="mt-1 text-sm text-chalk-muted">View feedback submitted by students and teachers after completed classes.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-chalk-faint px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
      {!loading && !error && reviews.length === 0 && <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6 text-sm text-chalk-muted">No reviews have been submitted yet.</div>}
      {reviews.length > 0 && <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
            <tr>
              <th className="px-5 py-4">Reviewer</th>
              <th className="px-5 py-4">Reviewed</th>
              <th className="px-5 py-4">Class</th>
              <th className="px-5 py-4">Selected points</th>
              <th className="px-5 py-4">Additional opinion</th>
              <th className="px-5 py-4">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-chalk-faint">
            {reviews.map((review) => <tr key={review.id} className="align-top">
              <td className="px-5 py-4"><div className="font-semibold">{review.reviewer_name}</div><div className="text-xs text-chalk-muted">{review.reviewer_email}</div><span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize">{review.reviewer_role}</span></td>
              <td className="px-5 py-4">{review.reviewee_name || "—"}</td>
              <td className="px-5 py-4">{review.subject_name || "Class"}<div className="text-xs text-chalk-muted">{new Date(review.scheduled_at).toLocaleString()}</div></td>
              <td className="px-5 py-4"><div className="max-w-[360px] space-y-1">{(review.checked_points || []).length ? review.checked_points.map((point) => <div key={point} className="text-xs">✓ {point}</div>) : <span className="text-xs text-chalk-muted">None selected</span>}</div></td>
              <td className="px-5 py-4"><div className="max-w-[260px] whitespace-pre-wrap text-xs text-chalk-muted">{review.additional_opinion || "—"}</div></td>
              <td className="px-5 py-4 whitespace-nowrap text-xs text-chalk-muted">{new Date(review.created_at).toLocaleString()}</td>
            </tr>)}
          </tbody>
        </table>
      </div>}
    </div>
  </DashboardLayout>;
}
