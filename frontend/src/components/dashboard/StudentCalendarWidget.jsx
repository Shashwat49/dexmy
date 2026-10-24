import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBookingSession, getMyBookings } from "../../api/bookings";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEndTime(scheduledAt, durationMinutes) {
  const date = new Date(scheduledAt);
  date.setMinutes(date.getMinutes() + (Number(durationMinutes) || 55));
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusOf(booking) {
  return String(booking?.status || "").toLowerCase().split(".").pop();
}

function tomorrowDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function sameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function getCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const days = [];

  for (let i = first.getDay() - 1; i >= 0; i--) {
    const date = new Date(first);
    date.setDate(first.getDate() - i - 1);
    days.push({ date, currentMonth: false });
  }

  for (let day = 1; day <= last.getDate(); day++) {
    days.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth(), day),
      currentMonth: true,
    });
  }

  let nextDay = 1;
  while (days.length < 42) {
    days.push({
      date: new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, nextDay++),
      currentMonth: false,
    });
  }

  return days;
}

export default function StudentCalendarWidget() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = tomorrowDate();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => tomorrowDate());
  const [joiningBookingId, setJoiningBookingId] = useState(null);
  const [joinError, setJoinError] = useState("");
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  function canJoinClass(booking) {
    const status = statusOf(booking);
    if (!["confirmed", "in_progress", "ongoing"].includes(status)) return false;
    const start = new Date(booking.scheduled_at).getTime();
    const end = start + Math.max(1, Number(booking.duration_minutes) || 55) * 60 * 1000;
    return clockNow >= start - 5 * 60 * 1000 && clockNow < end;
  }

  async function joinClass(booking) {
    if (!canJoinClass(booking) || joiningBookingId) return;
    setJoiningBookingId(booking.id);
    setJoinError("");
    try {
      const session = await getBookingSession(booking.id);
      if (!session?.id) throw new Error("The classroom session is not ready yet.");
      navigate(`/classroom/${session.id}`);
    } catch (err) {
      setJoinError(err.response?.data?.detail || err.message || "Unable to open this classroom. Please try again.");
    } finally {
      setJoiningBookingId(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadBookings() {
      try {
        setLoading(true);
        setError("");
        const data = await getMyBookings();
        if (active) setBookings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.detail || "Unable to load your calendar."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBookings();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Keep the student calendar aligned with the teacher calendar: show every assigned class on its date.
  const visibleBookings = useMemo(
    () => bookings.filter((booking) => booking?.scheduled_at && !Number.isNaN(new Date(booking.scheduled_at).getTime())),
    [bookings]
  );

  const calendarDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);

  const selectedDayBookings = useMemo(
    () =>
      visibleBookings
        .filter((booking) => sameDay(new Date(booking.scheduled_at), selectedDate))
        .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)),
    [visibleBookings, selectedDate]
  );

  function previousMonth() {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function goToToday() {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  if (loading) {
    return (
      <section className="bg-panel px-4 py-6 sm:px-6 lg:px-8" aria-label="Your class calendar">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-chalk-muted">Loading calendar...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-panel px-4 py-6 sm:px-6 lg:px-8" aria-label="Your class calendar">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-semibold">Class calendar</h2>
            <p className="mt-2 text-sm text-chalk-muted">
              View your scheduled classes and learning schedule.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
            {error}
            <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="ml-3 underline">
              Retry
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-chalk-faint bg-panel">
          <div className="flex flex-col gap-4 border-b border-chalk-faint p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={previousMonth}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-chalk-faint hover:border-chalk-muted"
              >
                ←
              </button>
              <h3 className="min-w-[180px] text-center text-lg font-semibold">
                {formatMonth(currentMonth)}
              </h3>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-chalk-faint hover:border-chalk-muted"
              >
                →
              </button>
            </div>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-xl border border-chalk-faint px-4 py-2 text-sm font-medium hover:border-brand-gold"
            >
              Today
            </button>
          </div>

          <div className="flex flex-wrap gap-4 border-b border-chalk-faint px-5 py-3 text-xs text-chalk-muted">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Scheduled classes</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-green-400" /> Completed classes</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-slate-500" /> Cancelled / other</span>
          </div>

          <div className="grid grid-cols-7 border-b border-chalk-faint">
            {WEEKDAYS.map((day) => (
              <div key={day} className="border-r border-chalk-faint px-2 py-3 text-center text-xs font-medium text-chalk-muted last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, currentMonth: isCurrentMonth }) => {
              const dayBookings = visibleBookings.filter((booking) =>
                sameDay(new Date(booking.scheduled_at), date)
              );
              const selected = sameDay(date, selectedDate);
              const today = sameDay(date, new Date());

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  aria-pressed={selected}
                  aria-label={date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  className={[
                    "min-h-[110px] border-r border-b border-chalk-faint p-2 text-left transition",
                    selected ? "bg-brand-gold/10" : "hover:bg-panel-3",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={[
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs",
                        today ? "bg-brand-red text-white" : isCurrentMonth ? "text-chalk" : "text-chalk-muted/40",
                      ].join(" ")}
                    >
                      {date.getDate()}
                    </span>
                    {dayBookings.length > 0 && (
                      <span className="text-[10px] text-brand-gold">{dayBookings.length}</span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const status = statusOf(booking);
                      const bookingTone =
                        status === "completed"
                          ? "bg-green-500/10 text-green-400"
                          : status === "confirmed"
                            ? "bg-amber-300/15 text-amber-200"
                            : "bg-slate-500/10 text-slate-300";

                      return (
                        <div key={booking.id} className={["truncate rounded-md px-2 py-1 text-[10px]", bookingTone].join(" ")}>
                          {formatTime(booking.scheduled_at)} · {booking.subject_name || "Class"}
                        </div>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <div className="px-2 text-[10px] text-chalk-muted">
                        +{dayBookings.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {joinError && <div role="alert" className="mt-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{joinError}<button type="button" onClick={() => setJoinError("")} className="ml-3 underline">Dismiss</button></div>}

        <section className="mt-8">
          <div className="mb-4">
            <h3 className="text-xl font-semibold">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
            <p className="mt-1 text-sm text-chalk-muted">Your classes for this day.</p>
          </div>

          {selectedDayBookings.length === 0 ? (
            <div className="rounded-2xl border border-chalk-faint bg-panel p-8">
              <p className="text-sm text-chalk-muted">No classes scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayBookings.map((booking) => {
                const status = statusOf(booking);
                const statusTone =
                  status === "completed"
                    ? "bg-green-500/10 text-green-400"
                    : status === "confirmed"
                      ? "bg-amber-300/15 text-amber-200"
                      : "bg-slate-500/10 text-slate-300";

                return (
                  <article key={booking.id} className="rounded-2xl border border-chalk-faint bg-panel p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="font-semibold">{booking.subject_name || "Class"}</h4>
                        <p className="mt-1 text-sm text-chalk-muted">
                          Teacher: {booking.teacher_name || "Assigned teacher"}
                        </p>
                        <p className="mt-1 text-sm text-chalk-muted">
                          {formatTime(booking.scheduled_at)} – {getEndTime(booking.scheduled_at, booking.duration_minutes)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={["rounded-full px-3 py-1.5 text-xs capitalize", statusTone].join(" ")}>
                          {String(booking.status || "other").replaceAll("_", " ")}
                        </span>
                        <button
                          type="button"
                          onClick={() => joinClass(booking)}
                          disabled={!canJoinClass(booking) || joiningBookingId !== null}
                          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          title={!canJoinClass(booking) ? "Join is available 5 minutes before class and during its scheduled duration." : "Join classroom"}
                        >
                          {joiningBookingId === booking.id ? "Joining…" : canJoinClass(booking) ? "Join Class" : status === "completed" ? "Class Completed" : status === "cancelled" ? "Class Cancelled" : "Join Class"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
