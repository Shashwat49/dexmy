import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Finance", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/packages", label: "Packages" },
  { path: "/dashboard/admin/payments", label: "Payments" },
] }];

export default function AdminPayments() {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { (async () => { try { const r = await api.get("/admin/finance/payments", { params: { page: 1, page_size: 50 } }); setItems(r.data?.items || r.data || []); } catch (e) { setError(e.response?.data?.detail || "Unable to load payments."); } finally { setLoading(false); } })(); }, []);
  return <DashboardLayout navItems={navItems}><div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Payments</h1><p className="mt-1 text-sm text-chalk-muted">Review package and booking payment transactions.</p></div><div className="flex-1 overflow-auto px-8 py-7">{error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}{loading ? <p className="text-sm text-chalk-muted">Loading payments…</p> : <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Student</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Provider</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Date</th></tr></thead><tbody className="divide-y divide-chalk-faint">{items.map((p) => <tr key={p.id}><td className="px-5 py-4 font-mono text-xs">{p.id}</td><td className="px-5 py-4">{p.student_name || p.student_id || "—"}</td><td className="px-5 py-4">{p.currency} {p.amount}</td><td className="px-5 py-4 capitalize">{p.provider || "—"}</td><td className="px-5 py-4">{p.status}</td><td className="px-5 py-4 text-chalk-muted">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</td></tr>)}</tbody></table>{items.length === 0 && <div className="px-6 py-10 text-sm text-chalk-muted">No payments found.</div>}</div>}</div></DashboardLayout>;
}
