import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import ClassCard from "../../components/dashboard/ClassCard";
import { CalendarIcon, UsersIcon, BookIcon, GearIcon } from "../../components/dashboard/icons";
import * as bookingsApi from "../../api/bookings";

const navItems = [
  {
    label: "Learn",
    items: [
      { path: "/dashboard/student", label: "My classes", icon: <CalendarIcon /> },
      { path: "/dashboard/student/book", label: "Book a class", icon: <UsersIcon /> },
      { path: "/dashboard/student/notes", label: "My notes", icon: <BookIcon /> },
    ],
  },
  {
    label: "Account",
    items: [{ path: "/dashboard/student/account", label: "My account", icon: <GearIcon /> }],
  },
];

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("upcoming");

  useEffect(() => {
    bookingsApi
      .getMyBookings()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = bookings
    .filter((b) => new Date(b.scheduled_at) >= now && b.status !== "cancelled")
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = bookings
    .filter((b) => new Date(b.scheduled_at) < now || b.status === "completed")
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  async function handleJoin(booking) {
    const session = await bookingsApi.getBookingSession(booking.id);
    navigate(`/classroom/${session.id}`);
  }

  const nextClass = upcoming[0];

  return (
    <DashboardLayout navItems={navItems}>
      <div className="flex items-center justify-between px-8 py-5.5 border-b border-chalk-faint">
        <h1 className="font-display text-2xl">My classes</h1>
        <div className="flex gap-1 bg-panel-2 rounded-lg p-1">
          <button
            onClick={() => setTab("upcoming")}
            className={`px-4.5 py-2 rounded-md text-[13.5px] font-semibold transition-colors ${
              tab === "upcoming" ? "bg-brand-red text-chalk" : "text-chalk-muted"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab("past")}
            className={`px-4.5 py-2 rounded-md text-[13.5px] font-semibold transition-colors ${
              tab === "past" ? "bg-brand-red text-chalk" : "text-chalk-muted"
            }`}
          >
            Past
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        {loading ? (
          <p className="text-chalk-muted text-sm">Loading your classes…</p>
        ) : (
          <>
            {tab === "upcoming" && nextClass && (
              <div className="bg-gradient-to-r from-panel-2 to-panel-3 border border-chalk-faint border-l-[3px] border-l-brand-gold rounded-xl px-6 py-5 flex items-center justify-between mb-7">
                <div>
                  <h3 className="text-base font-semibold mb-1">Your next class</h3>
                  <p className="text-[13.5px] text-chalk-muted">
                    {nextClass.subject_name} with {nextClass.teacher_name}
                  </p>
                </div>
                <button
                  onClick={() => handleJoin(nextClass)}
                  className="bg-brand-gold text-[#2C1E04] text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-[#FFC94D] transition-colors"
                >
                  View details
                </button>
              </div>
            )}

            {tab === "upcoming" ? (
              upcoming.length === 0 ? (
                <div className="text-center py-16 text-chalk-muted">
                  <h3 className="font-display text-xl text-chalk mb-2">No upcoming classes</h3>
                  <p className="text-sm">Book a class to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {upcoming.map((b) => (
                    <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} onJoin={handleJoin} />
                  ))}
                </div>
              )
            ) : past.length === 0 ? (
              <div className="text-center py-16 text-chalk-muted">
                <h3 className="font-display text-xl text-chalk mb-2">No past classes yet</h3>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {past.map((b) => (
                  <ClassCard key={b.id} booking={b} otherPartyName={b.teacher_name} isPast />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}