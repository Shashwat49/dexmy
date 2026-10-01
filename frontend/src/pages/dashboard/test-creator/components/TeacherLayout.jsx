import { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import {
  DashboardIcon,
  TestsIcon,
  PlusIcon,
  QuestionIcon,
  AnalyticsIcon,
  UserIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
} from "./Icons";

// --- Dexmy palette ---
const C = {
  void: "#0F1D17",
  panel: "#152922",
  panel2: "#1B3229",
  panel3: "#223B31",
  chalk: "#F2ECDD",
  chalkMuted: "#9BAFA0",
  chalkFaint: "rgba(242,236,221,0.08)",
  red: "#E4271C",
  redSoft: "rgba(228,39,28,0.16)",
  gold: "#F0B429",
  goldDark: "#2C1E04",
};

const NAV_SECTIONS = [
  {
    label: "Assessments",
    items: [
      { path: "/test-creator", label: "Dashboard", Icon: DashboardIcon },
      { path: "/test-creator/tests/create", label: "Create Test", Icon: PlusIcon },
      { path: "/test-creator/tests", label: "My Tests", Icon: TestsIcon },
    ],
  },
  {
    label: "Question Bank",
    items: [
      { path: "/test-creator/questions", label: "Repository", Icon: QuestionIcon },
      { path: "/test-creator/questions/add", label: "New Question", Icon: PlusIcon },
    ],
  },
  {
    label: "Performance",
    items: [
      { path: "/test-creator/results", label: "Test Results", Icon: AnalyticsIcon },
      { path: "/profile", label: "Teacher Profile", Icon: UserIcon },
    ],
  },
];

function initials(name) {
  if (!name) return "T";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarNav({ profile, onClose, onLogout }) {
  const location = useLocation();

  return (
    <>
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-7">
        <Link to="/test-creator" onClick={onClose} className="flex items-center gap-2.5">
          <img src="/dexmy.png" alt="Dexmy" className="h-8 w-auto object-contain" />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-chalk-muted hover:text-chalk p-1 transition"
            aria-label="Close menu"
          >
            <CloseIcon size={20} />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-chalk-muted opacity-60 mb-2 ml-3">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path === "/test-creator" && location.pathname === "/");
                const IconComp = item.Icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition ${
                      isActive
                        ? "bg-brand-red-soft text-chalk shadow-[inset_3px_0_0_#E4271C]"
                        : "text-chalk-muted hover:bg-panel-2 hover:text-chalk"
                    }`}
                  >
                    <span className={isActive ? "text-brand-red" : "text-chalk-muted"}>
                      <IconComp size={18} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile & Logout */}
      <div className="pt-4 mt-auto border-t border-chalk-faint space-y-3">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition w-full text-left"
        >
          <LogoutIcon size={18} />
          <span>Log out</span>
        </button>

        <Link
          to="/profile"
          onClick={onClose}
          className="pt-3 border-t border-chalk-faint flex items-center gap-2.5 hover:opacity-90 transition"
        >
          <div className="w-9 h-9 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow">
            {profile?.photo ? (
              <img
                src={profile.photo}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              initials(profile?.fullName)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-chalk truncate">
              {profile?.fullName || "Teacher"}
            </div>
            <div className="text-xs text-chalk-muted truncate">
              {profile?.designation || "Test Creator"}
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}

function TeacherLayout({ children }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    designation: "",
    photo: "",
  });

  useEffect(() => {
    const load = () => {
      const raw = localStorage.getItem("teacherProfile");
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        setProfile({
          fullName: data.fullName || "",
          email: data.email || "",
          designation: data.designation || "",
          photo: data.photo || "",
        });
      } catch {}
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("teacherToken");
    localStorage.removeItem("dexmy_token");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-void text-chalk font-body">
      {/* --- Mobile Header (identical to Dexmy) --- */}
      <header className="md:hidden flex items-center justify-between px-4 py-3.5 bg-panel border-b border-chalk-faint sticky top-0 z-40">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl border border-chalk-faint text-chalk hover:bg-panel-2 transition"
          aria-label="Open navigation menu"
        >
          <MenuIcon size={20} />
        </button>

        <Link to="/test-creator">
          <img src="/dexmy.png" alt="Dexmy" className="h-7 w-auto object-contain" />
        </Link>

        <Link
          to="/profile"
          className="w-8 h-8 rounded-full bg-brand-gold text-[#2C1E04] flex items-center justify-center font-bold text-xs shadow"
        >
          {initials(profile?.fullName)}
        </Link>
      </header>

      {/* --- Mobile Slide-out Drawer --- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] bg-panel h-full flex flex-col p-6 shadow-2xl border-r border-chalk-faint">
            <SidebarNav
              profile={profile}
              onClose={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      {/* --- Desktop Fixed Sidebar (stationary on PC, does not scroll with main content) --- */}
      <aside className="hidden md:flex w-64 shrink-0 bg-panel border-r border-chalk-faint flex-col p-6 fixed inset-y-0 left-0 z-30 overflow-y-auto">
        <SidebarNav profile={profile} onLogout={handleLogout} />
      </aside>

      {/* Spacer to preserve layout flow with fixed sidebar */}
      <div className="hidden md:block w-64 shrink-0" aria-hidden="true" />

      {/* --- Main Content Area --- */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}

export default TeacherLayout;