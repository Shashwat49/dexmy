import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";

const navItems = [{ label: "Administration", items: [
  { path: "/dashboard/admin", label: "Overview" },
  { path: "/dashboard/admin/audit-logs", label: "Audit logs" },
  { path: "/dashboard/admin/users", label: "Admin users" },
] }];

export default function AdminUsers() {
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const r = await api.get("/admin/admin-users"); setUsers(r.data || []); } catch (e) { setError(e.response?.data?.detail || "Unable to load admin users."); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  return <DashboardLayout navItems={navItems}><div className="border-b border-chalk-faint px-8 py-5.5"><h1 className="font-display text-2xl">Admin users</h1><p className="mt-1 text-sm text-chalk-muted">Review administrative accounts and their roles.</p></div><div className="flex-1 overflow-auto px-8 py-7">{error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}{loading ? <p className="text-sm text-chalk-muted">Loading admin users…</p> : <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2"><table className="w-full min-w-[750px] text-left text-sm"><thead className="border-b border-chalk-faint text-xs uppercase tracking-wide text-chalk-muted"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Department</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-chalk-faint">{users.map((u) => <tr key={u.id}><td className="px-5 py-4 font-semibold">{u.full_name}</td><td className="px-5 py-4">{u.email}</td><td className="px-5 py-4 capitalize">{String(u.role).replaceAll("_", " ")}</td><td className="px-5 py-4">{u.department || "—"}</td><td className="px-5 py-4">{u.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table>{users.length === 0 && <div className="px-6 py-10 text-sm text-chalk-muted">No admin users found.</div>}</div>}</div></DashboardLayout>;
}
