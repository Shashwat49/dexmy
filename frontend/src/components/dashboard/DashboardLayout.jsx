import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ADMIN_NAV = [
  { label: "Operations", items: [{ path: "/dashboard/admin", label: "Overview" }, { path: "/dashboard/admin/students", label: "Students" }, { path: "/dashboard/admin/teachers", label: "Teachers" }, { path: "/dashboard/admin/bookings", label: "Bookings" }, { path: "/dashboard/admin/meet-class-records", label: "Meet Class Records", icon: "records" }, { path: "/dashboard/admin/student-packages", label: "Student Packages" }, { path: "/dashboard/admin/support", label: "Support" }] },
  { label: "Finance", items: [{ path: "/dashboard/admin/packages", label: "Packages" }, { path: "/dashboard/admin/payments", label: "Payments" }, { path: "/dashboard/admin/finance", label: "Finance" }, { path: "/dashboard/admin/payouts", label: "Payouts" }] },
  { label: "Administration", items: [{ path: "/dashboard/admin/audit-logs", label: "Audit Logs" }, { path: "/dashboard/admin/users", label: "Admin Users" }] },
];

function NavIcon({ type }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  if (type === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 9h18"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></svg>;
  if (type === "records") return <svg {...common}><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></svg>;
  if (type === "profile") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
}

function DexmyLogo({ mobile = false }) {
  return <img src="/dexmy-logo-bg-removed.png" alt="Dexmy" className={mobile ? "h-8 w-auto max-w-[120px] object-contain" : "h-8 w-auto max-w-[140px] object-contain"} />;
}

export default function DashboardLayout({ navItems = [], children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = ["admin", "super_admin", "academic_manager", "teacher_manager", "finance_manager", "support_agent"].includes(user?.role);
  const isShopper = user?.role === "student" || user?.role === "parent";
  const effectiveNav = isAdmin ? ADMIN_NAV : navItems.map((section) => ({ ...section, items: [...section.items] }));
  if (isShopper && !effectiveNav.some((section) => section.label === "Explore Packages")) effectiveNav.push({ label: "Explore Packages", items: [{ path: "/packages", label: "Packages", icon: "records" }] });
  const initials = user?.full_name ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  const nav = () => <>
    <div className="flex items-center justify-between mb-3 shrink-0"><Link to="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center shrink-0" aria-label="Dexmy home"><DexmyLogo /></Link><button onClick={() => setMobileOpen(false)} className="md:hidden text-chalk-muted p-1 rounded-lg hover:bg-panel-2">×</button></div>
    <nav className="flex-1 min-h-0 overflow-hidden pr-1">{effectiveNav.map((section) => <div key={section.label} className="mb-2 last:mb-0"><div className="text-[9px] font-bold tracking-[0.16em] uppercase text-chalk-muted/60 mb-0.5 ml-2">{section.label}</div><div className="space-y-0">{section.items.map((item) => { const isDashboardRoot = ["/dashboard/admin", "/dashboard/teacher", "/dashboard/student"].includes(item.path); const active = location.pathname === item.path || (!isDashboardRoot && location.pathname.startsWith(`${item.path}/`)); return <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13.5px] font-medium transition-all ${active ? "bg-brand-red-soft text-chalk shadow-[inset_3px_0_0_#E4271C]" : "text-chalk-muted hover:bg-panel-2 hover:text-chalk"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-brand-red/15 text-brand-red" : "bg-panel-2 text-chalk-muted group-hover:text-chalk"}`}><NavIcon type={item.icon} /></span><span className="truncate">{item.label}</span></Link>; })}</div></div>)}</nav>
    <div className="shrink-0 pt-2">
      <button onClick={() => { setMobileOpen(false); logout(); }} className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13.5px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors text-left w-full"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-2">↪</span><span>Log out</span></button>
      <div className="mt-2 pt-2 border-t border-chalk-faint flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs shrink-0">{initials}</div><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{user?.full_name}</div><div className="text-[11px] text-chalk-muted capitalize truncate">{user?.role}</div></div></div>
    </div>
  </>;
  return <div className="min-h-screen flex flex-col md:flex-row bg-void text-chalk font-body"><header className="md:hidden flex items-center justify-between px-4 py-3 bg-panel/95 backdrop-blur border-b border-chalk-faint sticky top-0 z-30"><button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-chalk-faint hover:bg-panel-2">☰</button><Link to="/" className="inline-flex items-center shrink-0" aria-label="Dexmy home"><DexmyLogo mobile /></Link><div className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs">{initials}</div></header>{mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative z-50 w-72 max-w-[88vw] bg-panel h-dvh flex flex-col p-4 sm:p-5 shadow-2xl border-r border-chalk-faint overflow-hidden">{nav()}</aside></div>}<aside className="hidden md:flex w-64 shrink-0 bg-panel border-r border-chalk-faint flex-col p-4 lg:p-5 h-dvh max-h-dvh sticky top-0 overflow-hidden">{nav()}</aside><main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">{children}</main></div>;
}
