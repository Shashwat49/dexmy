import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/client";

const ADMIN_NAV = [
  { label: "Operations", items: [{ path: "/dashboard/admin", label: "Overview" }, { path: "/dashboard/admin/students", label: "Students" }, { path: "/dashboard/admin/teachers", label: "Teachers" }, { path: "/dashboard/admin/bookings", label: "Bookings" }, { path: "/dashboard/admin/meet-class-records", label: "Meet Class Records", icon: "records" }, { path: "/dashboard/admin/student-packages", label: "Student Packages" }, { path: "/dashboard/admin/support", label: "Support" }] },
  { label: "Finance", items: [{ path: "/dashboard/admin/packages", label: "Packages" }, { path: "/dashboard/admin/payments", label: "Payments" }, { path: "/dashboard/admin/finance", label: "Finance" }, { path: "/dashboard/admin/payouts", label: "Payouts" }] },
  { label: "Administration", items: [{ path: "/dashboard/admin/audit-logs", label: "Audit Logs" }, { path: "/dashboard/admin/users", label: "Admin Users" }] },
];

// Canonical student navigation. Keeping this in the shared layout means every
// student dashboard page always gets the same sidebar options. Add future
// student tabs here once and they will appear on every student dashboard page.
const STUDENT_NAV = [
  { label: "Learn", items: [
    { path: "/dashboard/student", label: "My classes", icon: "calendar" },
    { path: "/dashboard/student/book", label: "Book a class", icon: "calendar" },
    { path: "/dashboard/student/notes", label: "My notes", icon: "records" },
    { path: "/dashboard/student/tests", label: "Tests & Assessments", icon: "records" },
  ] },
  { label: "Account", items: [
    { path: "/dashboard/student/account", label: "My account", icon: "profile" },
  ] },
  { label: "Explore Packages", items: [
    { path: "/dashboard/student/packages", label: "Packages", icon: "records" },
  ] },
];


function NavIcon({ type }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" };
  if (type === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 9h18"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></svg>;
  if (type === "records") return <svg {...common}><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/></svg>;
  if (type === "profile") return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
  if (type === "bell") return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
}

function DexmyLogo({ mobile = false }) {
  return <img src="/dexmy-logo-bg-removed.png" alt="Dexmy" className={mobile ? "h-8 w-auto max-w-[120px] object-contain" : "h-8 w-auto max-w-[140px] object-contain"} />;
}

export default function DashboardLayout({ navItems = [], children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isAdmin = ["admin", "super_admin", "academic_manager", "teacher_manager", "finance_manager", "support_agent"].includes(user?.role);
  const isStudent = user?.role === "student";
  const effectiveNav = isAdmin ? ADMIN_NAV : isStudent ? STUDENT_NAV : navItems.map((section) => ({ ...section, items: [...section.items] }));

  const loadNotifications = async () => {
    if (!isAdmin) return;
    try {
      const [countResponse, listResponse] = await Promise.all([
        api.get("/admin/notifications/unread-count"),
        api.get("/admin/notifications", { params: { limit: 20 } }),
      ]);
      setNotificationCount(Number(countResponse.data?.count || 0));
      setNotifications(Array.isArray(listResponse.data) ? listResponse.data : []);
    } catch {
      // Notifications are non-blocking UI; dashboard navigation should remain unaffected.
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 10000);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  async function markNotificationsRead() {
    if (!isAdmin) return;
    try {
      await api.post("/admin/notifications/read-all");
      setNotificationCount(0);
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    } catch {
      // The Students page also marks notifications read, so this is best-effort.
    }
  }
  const initials = user?.full_name ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

  // The assessment page owns the entire viewport while a student is in the
  // test flow. Keep the normal dashboard sidebar everywhere else, but remove
  // it from the assessment route so it cannot remain visible beside the test UI.
  const isStudentAssessment = isStudent && location.pathname === "/dashboard/student/tests";

  const nav = () => <>
    <div className="flex items-center justify-between mb-3 shrink-0"><Link to="/" onClick={() => setMobileOpen(false)} className="inline-flex items-center shrink-0" aria-label="Dexmy home"><DexmyLogo /></Link><button onClick={() => setMobileOpen(false)} className="md:hidden text-chalk-muted p-1 rounded-lg hover:bg-panel-2">×</button></div>
    {isAdmin && <div className="relative mb-2">
      <button type="button" onClick={() => setNotificationsOpen((open) => !open)} className="flex w-full items-center gap-3 px-3 py-1.5 rounded-xl text-[13.5px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors">
        <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-2"><NavIcon type="bell" />{notificationCount > 0 && <span className="absolute -right-1 -top-1 min-w-[17px] h-[17px] px-1 rounded-full bg-brand-red text-[9px] font-bold text-white grid place-items-center">{notificationCount > 99 ? "99+" : notificationCount}</span>}</span>
        <span className="truncate">Notifications</span>
      </button>
      {notificationsOpen && <div className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-chalk-faint bg-panel-2 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-chalk-faint px-4 py-3"><span className="text-sm font-semibold">Notifications</span>{notificationCount > 0 && <button type="button" onClick={markNotificationsRead} className="text-[11px] text-brand-red hover:underline">Mark all read</button>}</div>
        <div className="max-h-80 overflow-auto">{notifications.length === 0 ? <div className="px-4 py-6 text-xs text-chalk-muted">No notifications.</div> : notifications.map((item) => <div key={item.id} className={`border-b border-chalk-faint px-4 py-3 last:border-b-0 ${item.is_read ? "opacity-60" : ""}`}><div className="text-xs font-semibold">{item.title}</div><div className="mt-1 text-xs text-chalk-muted">{item.message}</div><div className="mt-1 text-[10px] text-chalk-muted/70">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</div></div>)}</div>
      </div>}
    </div>}
    <nav aria-label="Dashboard navigation" className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden overscroll-contain pr-2 pb-3 [scrollbar-width:auto] [scrollbar-color:rgba(148,163,184,0.75)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/70 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">{effectiveNav.map((section) => <div key={section.label} className="mb-2 last:mb-0"><div className="text-[9px] font-bold tracking-[0.16em] uppercase text-chalk-muted/60 mb-0.5 ml-2">{section.label}</div><div className="space-y-0">{section.items.map((item) => { const isDashboardRoot = ["/dashboard/admin", "/dashboard/teacher", "/dashboard/student"].includes(item.path); const active = location.pathname === item.path || (!isDashboardRoot && location.pathname.startsWith(`${item.path}/`)); return <Link key={item.path} to={item.path} onClick={() => { setMobileOpen(false); if (isAdmin && item.path === "/dashboard/admin/students") markNotificationsRead(); }} className={`group flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13.5px] font-medium transition-all ${active ? "bg-brand-red-soft text-chalk shadow-[inset_3px_0_0_#E4271C]" : "text-chalk-muted hover:bg-panel-2 hover:text-chalk"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-brand-red/15 text-brand-red" : "bg-panel-2 text-chalk-muted group-hover:text-chalk"}`}><NavIcon type={item.icon} /></span><span className="truncate">{item.label}</span>{isAdmin && item.path === "/dashboard/admin/students" && notificationCount > 0 && <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-brand-red" aria-label="New student registrations" />}</Link>; })}</div></div>)}</nav>
    <div className="shrink-0 pt-2">
      <button onClick={() => { setMobileOpen(false); logout(); }} className="flex items-center gap-3 px-3 py-1.5 rounded-xl text-[13.5px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors text-left w-full"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-panel-2">↪</span><span>Log out</span></button>
      <div className="mt-2 pt-2 border-t border-chalk-faint flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs shrink-0">{initials}</div><div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{user?.full_name}</div><div className="text-[11px] text-chalk-muted capitalize truncate">{user?.role}</div></div></div>
    </div>
  </>;

  return <div className={`min-h-screen flex flex-col md:flex-row bg-void text-chalk font-body ${isStudentAssessment ? "assessment-fullscreen-shell" : ""}`}><header className={`${isStudentAssessment ? "hidden" : ""} md:hidden flex items-center justify-between px-4 py-3 bg-panel/95 backdrop-blur border-b border-chalk-faint sticky top-0 z-30`}><button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-chalk-faint hover:bg-panel-2">☰</button><Link to="/" className="inline-flex items-center shrink-0" aria-label="Dexmy home"><DexmyLogo mobile /></Link><div className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs">{initials}</div></header>{mobileOpen && !isStudentAssessment && <div className="fixed inset-0 z-50 flex md:hidden"><div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><aside className="relative z-50 w-72 max-w-[88vw] bg-panel h-dvh min-h-0 flex flex-col p-4 sm:p-5 shadow-2xl border-r border-chalk-faint overflow-hidden">{nav()}</aside></div>}{!isStudentAssessment && <aside className="hidden md:flex w-64 shrink-0 bg-panel border-r border-chalk-faint flex-col p-4 lg:p-5 h-dvh max-h-dvh sticky top-0 overflow-hidden min-h-0">{nav()}</aside>}<main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">{children}</main></div>;
}
