import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function DashboardLayout({ navItems = [], children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const renderNavContent = () => (
    <>
      <div className="flex items-center justify-between mb-8">
        <Link to="/" onClick={() => setMobileOpen(false)} className="font-display text-2xl text-brand-red -skew-x-6 inline-block">Dexmy</Link>
        <button onClick={() => setMobileOpen(false)} className="md:hidden text-chalk-muted p-1" aria-label="Close menu">×</button>
      </div>
      <nav className="flex-1">
        {navItems.map((section) => <div key={section.label}>
          <div className="text-[11px] font-semibold tracking-wider uppercase text-chalk-muted opacity-60 mt-4 mb-2 ml-3">{section.label}</div>
          {section.items.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14.5px] font-medium mb-0.5 transition-colors ${location.pathname === item.path ? "bg-brand-red-soft text-chalk shadow-[inset_3px_0_0_#E4271C]" : "text-chalk-muted hover:bg-panel-2 hover:text-chalk"}`}>{item.icon}{item.label}</Link>)}
        </div>)}
      </nav>
      <button onClick={() => { setMobileOpen(false); logout(); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14.5px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors mb-3 text-left w-full">Log out</button>
      <div className="pt-5 border-t border-chalk-faint flex items-center gap-2.5"><div className="w-9 h-9 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-sm shrink-0">{initials}</div><div className="min-w-0 flex-1"><div className="text-[13.5px] font-semibold truncate">{user?.full_name}</div><div className="text-xs text-chalk-muted capitalize">{user?.role}</div></div></div>
    </>
  );

  return <div className="min-h-screen flex flex-col md:flex-row bg-void text-chalk font-body">
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-panel border-b border-chalk-faint sticky top-0 z-30"><button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg border border-chalk-faint" aria-label="Open menu">☰</button><Link to="/" className="font-display text-xl text-brand-red -skew-x-6">Dexmy</Link><div className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs">{initials}</div></header>
    {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} /><aside className="relative z-50 w-72 max-w-[80vw] bg-panel h-full flex flex-col p-6 shadow-2xl border-r border-chalk-faint overflow-y-auto">{renderNavContent()}</aside></div>}
    <aside className="hidden md:flex w-60 shrink-0 bg-panel border-r border-chalk-faint flex-col p-7 min-h-screen">{renderNavContent()}</aside>
    <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">{children}</main>
  </div>;
}
