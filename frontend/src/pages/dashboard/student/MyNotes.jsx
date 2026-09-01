import { useEffect, useState } from "react";
import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import { CalendarIcon, UsersIcon, BookIcon, GearIcon } from "../../../components/dashboard/icons";
import * as bookingsApi from "../../../api/bookings";
import api from "../../../api/client";

const navItems = [
  { label: "Learn", items: [
    { path: "/dashboard/student", label: "My classes", icon: <CalendarIcon /> },
    { path: "/dashboard/student/book", label: "Book a class", icon: <UsersIcon /> },
    { path: "/dashboard/student/notes", label: "My notes", icon: <BookIcon /> },
  ]},
  { label: "Account", items: [{ path: "/dashboard/student/account", label: "My account", icon: <GearIcon /> }] },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MyNotes() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      setLoading(true);
      setError("");
      try {
        const bookings = await bookingsApi.getMyBookings();
        const pastClasses = bookings
          .filter((booking) => booking.status === "completed" || new Date(booking.scheduled_at) < new Date())
          .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

        const results = await Promise.all(
          pastClasses.map(async (booking) => {
            try {
              const session = await bookingsApi.getBookingSession(booking.id);
              try {
                const { data: notes } = await api.get(`/classroom/sessions/${session.id}/notes`);
                return { booking, session, notes, available: !!notes?.pdf_url };
              } catch (notesError) {
                if (notesError.response?.status === 404) return { booking, session, notes: null, available: false };
                throw notesError;
              }
            } catch {
              return { booking, session: null, notes: null, available: false };
            }
          })
        );

        if (!cancelled) setClasses(results);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || "Unable to load your notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotes();
    return () => { cancelled = true; };
  }, []);

  const openNotes = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return <DashboardLayout navItems={navItems}>
    <div className="flex items-center justify-between px-8 py-5.5 border-b border-chalk-faint">
      <div>
        <h1 className="font-display text-2xl">My notes</h1>
        <p className="mt-1 text-sm text-chalk-muted">Notes from your completed classes.</p>
      </div>
    </div>

    <div className="relative flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}

      {loading ? <p className="text-chalk-muted text-sm">Loading your notes…</p> : classes.length === 0 ? (
        <div className="text-center py-16 text-chalk-muted">
          <h3 className="font-display text-xl text-chalk mb-2">No class notes yet</h3>
          <p className="text-sm">Your notes will appear here after a class is completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {classes.map(({ booking, notes, available }) => (
            <div key={booking.id} className="rounded-xl border border-chalk-faint bg-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base">{booking.subject_name}</h3>
                  <p className="mt-1 text-sm text-chalk-muted">with {booking.teacher_name || "Teacher"}</p>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wide text-chalk-muted">Completed</span>
              </div>

              <div className="mt-5 space-y-2 text-[13px] text-chalk-muted">
                <div className="flex justify-between gap-4"><span>Date</span><span className="text-chalk">{formatDate(booking.scheduled_at)}</span></div>
                <div className="flex justify-between gap-4"><span>Time</span><span className="text-chalk">{formatTime(booking.scheduled_at)}</span></div>
                <div className="flex justify-between gap-4"><span>Duration</span><span className="text-chalk">{booking.duration_minutes} minutes</span></div>
              </div>

              <button
                onClick={() => openNotes(notes?.pdf_url)}
                disabled={!available}
                className="mt-5 w-full rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-bold text-[#2C1E04] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {available ? "View notes" : "Notes not available yet"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </DashboardLayout>;
}
