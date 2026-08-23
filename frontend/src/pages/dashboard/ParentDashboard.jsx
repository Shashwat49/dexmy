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
      <div className="flex items-center justify-between px-8 py-5.5 border-b border-chalk-faint">
        <div>
          <h1 className="font-display text-2xl">Parent Dashboard</h1>
          <p className="mt-1 text-sm text-chalk-muted">Welcome, {user?.full_name}</p>
        </div>
        <button
          onClick={() => {
            setShowLinkModal(true);
            setLinkSuccess("");
            setLinkError("");
          }}
          className="bg-brand-red text-chalk text-sm font-semibold px-4.5 py-2.5 rounded-lg transition-colors hover:bg-brand-red/90"
        >
          + Add Child
        </button>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {loading ? (
          <p className="text-chalk-muted text-sm">Loading dashboard...</p>
        ) : (
          <div className="space-y-10">
            {/* My Children */}
            <section>
              <h2 className="text-lg font-semibold mb-4">My Children</h2>
              {children.length === 0 ? (
                <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6 text-center">
                  <p className="text-sm text-chalk-muted mb-4">You have no children linked to your account.</p>
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="bg-panel px-4 py-2 text-sm font-semibold rounded-md border border-chalk-faint"
                  >
                    Link a child
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChildId(child.id)}
                      className={`px-5 py-3 rounded-xl border text-left transition-all ${
                        selectedChildId === child.id
                          ? "border-brand-gold bg-brand-gold/10"
                          : "border-chalk-faint bg-panel-2 hover:border-chalk-muted"
                      }`}
                    >
                      <p className="font-semibold">{child.full_name}</p>
                      <p className="text-xs text-chalk-muted mt-1">{child.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Selected Child Section */}
            {selectedChild && (
              <>
                <section>
                  <h2 className="text-lg font-semibold mb-4">Upcoming Classes for {selectedChild.full_name}</h2>
                  {loadingBookings ? (
                    <p className="text-sm text-chalk-muted">Loading upcoming classes...</p>
                  ) : upcoming.length === 0 ? (
                    <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">
                      <p className="text-sm text-chalk-muted">No upcoming classes.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                      {upcoming.map((b) => (
                        <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="text-lg font-semibold mb-4">Completed Classes</h2>
                  {loadingBookings ? (
                    <p className="text-sm text-chalk-muted">Loading completed classes...</p>
                  ) : past.length === 0 ? (
                    <div className="rounded-xl border border-chalk-faint bg-panel-2 p-6">
                      <p className="text-sm text-chalk-muted">No completed classes yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
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
              <h2 className="text-lg font-semibold mb-4">Explore Courses</h2>
              {subjects.length === 0 ? (
                <p className="text-sm text-chalk-muted">No courses available.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {subjects.map((subject) => (
                    <div key={subject.id} className="rounded-xl border border-chalk-faint bg-panel-2 p-5 flex flex-col">
                      <h3 className="font-semibold">{subject.name}</h3>
                      {subject.description && (
                        <p className="text-xs text-chalk-muted mt-2 flex-1 line-clamp-2">
                          {subject.description}
                        </p>
                      )}
                      <Link
                        to={`/dashboard/parent/courses/${subject.id}`}
                        className="mt-4 block text-center rounded-lg bg-panel border border-chalk-faint px-4 py-2 text-sm font-semibold transition-colors hover:border-chalk-muted"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-chalk-faint bg-panel-2 p-6 shadow-xl">
            <h2 className="font-display text-xl mb-2">Link a Child</h2>
            <p className="text-sm text-chalk-muted mb-6">Enter your child's registered Dexmy email address to link them to your account.</p>
            
            {linkError && <div className="mb-4 rounded-lg bg-brand-red/10 p-3 text-sm text-brand-red border border-brand-red/20">{linkError}</div>}
            {linkSuccess && <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-400 border border-green-500/20">{linkSuccess}</div>}
            
            <form onSubmit={handleLinkChild}>
              <div className="mb-5">
                <label className="block text-xs font-semibold text-chalk-muted mb-2">Student Email</label>
                <input
                  type="email"
                  required
                  value={childEmail}
                  onChange={(e) => setChildEmail(e.target.value)}
                  className="w-full rounded-lg border border-chalk-faint bg-panel px-4 py-2.5 text-sm outline-none focus:border-brand-gold transition-colors"
                  placeholder="child@example.com"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg hover:bg-panel transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="px-5 py-2 text-sm font-bold bg-brand-red text-chalk rounded-lg disabled:opacity-50"
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
