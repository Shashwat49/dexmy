import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// navItems shape: [{ label: "Section", items: [{ path, label, icon }] }]
export default function DashboardLayout({ navItems, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="min-h-screen flex bg-void text-chalk font-body">
      <aside className="w-60 shrink-0 bg-panel border-r border-chalk-faint flex flex-col p-7">
        <Link to="/" className="font-display text-2xl text-brand-red -skew-x-6 inline-block mb-10">
          Dexmy
        </Link>

        <nav className="flex-1">
          {navItems.map((section) => (
            <div key={section.label}>
              <div className="text-[11px] font-semibold tracking-wider uppercase text-chalk-muted opacity-60 mt-5 mb-2.5 ml-3">
                {section.label}
              </div>
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14.5px] font-medium mb-0.5 transition-colors ${
                      active
                        ? "bg-brand-red-soft text-chalk shadow-[inset_3px_0_0_#E4271C]"
                        : "text-chalk-muted hover:bg-panel-2 hover:text-chalk"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14.5px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors mb-3 text-left"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Log out
        </button>

        <div className="pt-5 border-t border-chalk-faint flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate">{user?.full_name}</div>
            <div className="text-xs text-chalk-muted capitalize">{user?.role}</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}