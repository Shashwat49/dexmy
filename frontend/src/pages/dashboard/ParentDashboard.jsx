import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClassCard from "../../components/dashboard/ClassCard";
import { UsersIcon } from "../../components/dashboard/icons";
import { useAuth } from "../../context/AuthContext";
import * as parentsApi from "../../api/parents";
import * as subjectsApi from "../../api/subjects";

const navItems = [
  {
    label: "Parent",
    items: [
      { path: "/dashboard/parent", label: "My children", icon: <UsersIcon /> },
    ],
  },
];

export default function ParentDashboard() {
  const { user } = useAuth();

  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  
  const [bookings, setBookings] = useState([]);
  const [subjects, setSubjects] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  
  // Link child state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [childEmail, setChildEmail] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSuccess, setLinkSuccess] = useState("");
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    Promise.all([
      parentsApi.getLinkedStudents(),
      subjectsApi.getSubjects(),
    ])
      .then(([studentsRes, subjectsRes]) => {
        setChildren(studentsRes);
        setSubjects(subjectsRes);
        if (studentsRes.length > 0) {
          setSelectedChildId(studentsRes[0].id);
        }
      })
      .catch((err) => console.error("Failed to load dashboard data", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChildId) {
      setBookings([]);
      return;
    }
    setLoadingBookings(true);
    parentsApi
      .getStudentBookings(selectedChildId)
      .then(setBookings)
      .catch((err) => console.error("Failed to load bookings", err))
      .finally(() => setLoadingBookings(false));
  }, [selectedChildId]);

  const handleLinkChild = async (e) => {
    e.preventDefault();
    if (!childEmail) return;
    
    setLinking(true);
    setLinkError("");
    setLinkSuccess("");

    try {
      const newChild = await parentsApi.linkStudent(childEmail);
      setLinkSuccess("Child linked successfully.");
      setChildren((prev) => [...prev, newChild]);
      if (!selectedChildId) {
        setSelectedChildId(newChild.id);
      }
      setChildEmail("");
      setTimeout(() => setShowLinkModal(false), 2000);
    } catch (err) {
      setLinkError(err.response?.data?.detail || "Failed to link child.");
    } finally {
      setLinking(false);
    }
  };

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const now = new Date();
  const upcoming = bookings
    .filter((b) => new Date(b.scheduled_at) >= now && b.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = bookings
    .filter((b) => new Date(b.scheduled_at) < now || b.status === "completed")
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return (
    <DashboardLayout navItems={navItems}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 sm:px-6 md:px-8 md:py-5.5 border-b border-chalk-faint">
        <div>
          <h1 className="font-display text-xl sm:text-2xl">Parent Dashboard</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-chalk-muted">Welcome, {user?.full_name}</p>
        </div>
        <button
          onClick={() => {
            setShowLinkModal(true);
            setLinkSuccess("");
            setLinkError("");
          }}
          className="bg-brand-red text-chalk text-xs sm:text-sm font-semibold px-4 py-2 sm:px-4.5 sm:py-2.5 rounded-lg transition-colors hover:bg-brand-red/90 self-start sm:self-auto"
        >
          + Add Child
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 md:px-8 md:py-7">
        {loading ? (
          <p className="text-chalk-muted text-sm">Loading dashboard...</p>
        ) : (
          <div className="space-y-8 sm:space-y-10 max-w-7xl">
            {/* My Children */}
            <section>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">My Children</h2>
              {children.length === 0 ? (
                <div className="rounded-xl border border-chalk-faint bg-panel-2 p-5 sm:p-6 text-center">
                  <p className="text-xs sm:text-sm text-chalk-muted mb-4">You have no children linked to your account.</p>
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="bg-panel px-4 py-2 text-xs sm:text-sm font-semibold rounded-md border border-chalk-faint hover:border-chalk-muted transition-colors"
                  >
                    Link a child
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all w-full ${
                        selectedChildId === child.id
                          ? "border-brand-gold bg-brand-gold/10 shadow-sm"
                          : "border-chalk-faint bg-panel-2 hover:border-chalk-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm sm:text-base truncate">{child.full_name}</p>
                        {selectedChildId === child.id && (
                          <span className="w-2 h-2 rounded-full bg-brand-gold shrink-0 ml-2" />
                        )}
                      </div>
                      <p className="text-xs text-chalk-muted mt-1 truncate">{child.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Selected Child Section */}
            {selectedChild && (
              <>
                <section>
                  <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Upcoming Classes for {selectedChild.full_name}</h2>
                  {loadingBookings ? (
                    <p className="text-xs sm:text-sm text-chalk-muted">Loading upcoming classes...</p>
                  ) : upcoming.length === 0 ? (
                    <div className="rounded-xl border border-chalk-faint bg-panel-2 p-5 sm:p-6">
                      <p className="text-xs sm:text-sm text-chalk-muted">No upcoming classes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                      {upcoming.map((b) => (
                        <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Completed Classes</h2>
                  {loadingBookings ? (
                    <p className="text-xs sm:text-sm text-chalk-muted">Loading completed classes...</p>
                  ) : past.length === 0 ? (
                    <div className="rounded-xl border border-chalk-faint bg-panel-2 p-5 sm:p-6">
                      <p className="text-xs sm:text-sm text-chalk-muted">No completed classes yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                      {past.map((b) => (
                        <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} isPast />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Explore Courses */}
            <section>
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Explore Courses</h2>
              {subjects.length === 0 ? (
                <p className="text-xs sm:text-sm text-chalk-muted">No courses available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {subjects.map((subject) => (
                    <div key={subject.id} className="rounded-xl border border-chalk-faint bg-panel-2 p-4 sm:p-5 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base">{subject.name}</h3>
                        {subject.description && (
                          <p className="text-xs text-chalk-muted mt-2 line-clamp-3">
                            {subject.description}
                          </p>
                        )}
                      </div>
                      <Link
                        to={`/dashboard/parent/courses/${subject.id}`}
                        className="mt-4 block text-center rounded-lg bg-panel border border-chalk-faint px-4 py-2 text-xs sm:text-sm font-semibold transition-colors hover:border-chalk-muted"
                      >
                        View Course
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Add Child Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-chalk-faint bg-panel-2 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg sm:text-xl">Link a Child</h2>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-chalk-muted hover:text-chalk p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-xs sm:text-sm text-chalk-muted mb-5">
              Enter your child's registered Dexmy email address to link them to your account.
            </p>
            
            {linkError && <div className="mb-4 rounded-lg bg-brand-red/10 p-3 text-xs sm:text-sm text-brand-red border border-brand-red/20">{linkError}</div>}
            {linkSuccess && <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-xs sm:text-sm text-green-400 border border-green-500/20">{linkSuccess}</div>}
            
            <form onSubmit={handleLinkChild}>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-chalk-muted mb-2">Student Email</label>
                <input
                  type="email"
                  required
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  className="w-full rounded-lg border border-chalk-faint bg-panel px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-brand-gold transition-colors"
                  placeholder="child@example.com"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg hover:bg-panel transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-4.5 py-2 text-xs sm:text-sm font-bold bg-brand-red text-chalk rounded-lg disabled:opacity-50 transition-opacity"
                >
                  {linking ? "Linking..." : "Link Child"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
