import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Operations", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/students", label: "Students" },
  { path: "/dashboard/admin/teachers", label: "Teachers" },
  { path: "/dashboard/admin/packages", label: "Packages" },
] }];

export default function AdminPackages() {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const r = await api.get("/admin/packages"); setItems(r.data?.items || r.data || []); } catch (e) { setError(e.response?.data?.detail || "Unable to load packages."); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  return <DashboardLayout navItems={navItems}>
    <div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Packages</h1><p className="mt-1 text-sm text-chalk-muted">Manage class packages and pricing.</p></div>
    <div className="flex-1 overflow-auto px-8 py-7">{error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}{loading ? <p className="text-sm text-chalk-muted">Loading packages…</p> : <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Package</th><th className="px-5 py-4">Classes</th><th className="px-5 py-4">Price</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-chalk-faint">{items.map((p) => <tr key={p.id}><td className="px-5 py-4"><div className="font-semibold">{p.name}</div><div className="text-xs text-chalk-muted">{p.description || "—"}</div></td><td className="px-5 py-4">{p.class_count}</td><td className="px-5 py-4">{p.currency} {p.price}</td><td className="px-5 py-4">{p.is_custom ? "Custom" : "Standard"}</td><td className="px-5 py-4">{p.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table>{items.length === 0 && <div className="px-6 py-10 text-sm text-chalk-muted">No package plans configured.</div>}</div>}</div>
  </DashboardLayout>;
}
