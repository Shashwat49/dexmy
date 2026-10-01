import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const PAGE_SIZE = 25;

const statusClasses = {
  paid: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
  created: "bg-yellow-500/10 text-yellow-400",
  refunded: "bg-blue-500/10 text-blue-400",
};

export default function AdminPayments() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (status) params.status_filter = status;
      const r = await api.get("/admin/finance/payments", { params });
      setItems(r.data?.items || []);
      setTotal(Number(r.data?.total || 0));
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load payments.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="border-b border-chalk-faint px-8 py-5.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl">Payments</h1>
            <p className="mt-1 text-sm text-chalk-muted">Review package and booking payment transactions.</p>
          </div>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded-xl border border-chalk-faint bg-panel-2 px-3 py-2 text-sm text-chalk"
            aria-label="Filter payments by status"
          >
            <option value="">All statuses</option>
            <option value="created">Created</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">
            <span>{error}</span>
            <button onClick={load} className="ml-4 underline">Retry</button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-chalk-muted">Loading payments…</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between text-sm text-chalk-muted">
              <span>{total} payment{total === 1 ? "" : "s"} found</span>
              <span>Page {page} of {totalPages}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted">
                  <tr>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Student</th>
                    <th className="px-5 py-4">Package</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Provider</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Reference</th>
                    <th className="px-5 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-chalk-faint">
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-4 font-mono text-xs">{p.id}</td>
                      <td className="px-5 py-4">{p.student_name || p.student_id || "—"}</td>
                      <td className="px-5 py-4 font-semibold">{p.package_name || "Class Booking"}</td>
                      <td className="px-5 py-4 whitespace-nowrap">{p.currency} {Number(p.amount || 0).toFixed(2)}</td>
                      <td className="px-5 py-4 capitalize">{p.provider || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[p.status] || "bg-panel text-chalk-muted"}`}>
                          {p.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-chalk-muted">
                        {p.provider_payment_id || p.provider_order_id || "—"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-chalk-muted">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && <div className="px-6 py-10 text-sm text-chalk-muted">No payments found.</div>}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-chalk-faint px-3 py-2 text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-lg border border-chalk-faint px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
