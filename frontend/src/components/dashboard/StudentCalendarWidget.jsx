import { useEffect, useMemo, useState } from "react";
import { getMyBookings } from "../../api/bookings";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const sameDay = (a, b) => {
  const left = new Date(a), right = new Date(b);
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
};
const monthLabel = (date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
const timeLabel = (date) => new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const result = [];
  for (let i = 0; i < first.getDay(); i++) {
    result.push({ date: new Date(first.getFullYear(), first.getMonth(), 1 - (first.getDay() - i)), inMonth: false });
  }
  for (let day = 1; day <= count; day++) {
    result.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true });
  }
  let next = 1;
  while (result.length < 42) {
    result.push({ date: new Date(month.getFullYear(), month.getMonth() + 1, next++), inMonth: false });
  }
  return result;
}

export default function StudentCalendarWidget() {
  const [bookings, setBookings] = useState([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyBookings()
      .then((data) => { if (active) setBookings(Array.isArray(data) ? data : []); })
      .catch((err) => { if (active) setError(err.response?.data?.detail || "Calendar classes could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Keep completed history visible, but only expose confirmed upcoming classes for tomorrow.
  const visibleBookings = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return bookings.filter((booking) =>
      booking.status !== "confirmed" ||
      (booking.scheduled_at && sameDay(booking.scheduled_at, tomorrow))
    );
  }, [bookings]);

  const days = useMemo(() => monthDays(month), [month]);
  const selectedBookings = useMemo(() => visibleBookings
    .filter((booking) => booking.scheduled_at && sameDay(booking.scheduled_at, selectedDate))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [visibleBookings, selectedDate]);

  const moveMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const goToday = () => {
    const today = new Date();
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  };
  const completedCount = selectedBookings.filter((booking) => booking.status === "completed").length;

  return (
    <section className="border-b border-chalk-faint bg-panel/95 px-4 py-4 sm:px-6 lg:px-8" aria-label="Your class calendar">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Class calendar</h2>
            <p className="mt-1 text-xs text-chalk-muted">Your scheduled and completed classes, across all dates.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center rounded-lg border border-chalk-faint hover:border-chalk-muted">←</button>
            <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(month)}</span>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center rounded-lg border border-chalk-faint hover:border-chalk-muted">→</button>
            <button type="button" onClick={goToday} className="rounded-lg border border-chalk-faint px-3 py-1.5 text-xs hover:border-brand-gold">Today</button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-chalk-muted"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> Scheduled</span>
          <span className="inline-flex items-center gap-1.5 text-chalk-muted"><span className="h-2.5 w-2.5 rounded-sm bg-green-400" /> Completed</span>
          <span className="inline-flex items-center gap-1.5 text-chalk-muted"><span className="h-2.5 w-2.5 rounded-sm bg-slate-500" /> Cancelled / other</span>
        </div>

        {error && <p role="status" className="mb-3 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">{error}</p>}
        {loading ? <p className="py-5 text-sm text-chalk-muted">Loading calendar…</p> : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
            <div className="overflow-hidden rounded-xl border border-chalk-faint">
              <div className="grid grid-cols-7 border-b border-chalk-faint bg-panel-2">
                {WEEKDAYS.map((day) => <div key={day} className="py-2 text-center text-[10px] font-semibold text-chalk-muted sm:text-xs">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {days.map(({ date, inMonth }) => {
                  const dayBookings = visibleBookings.filter((booking) => booking.scheduled_at && sameDay(booking.scheduled_at, date));
                  const scheduled = dayBookings.filter((booking) => booking.status === "confirmed").length;
                  const completed = dayBookings.filter((booking) => booking.status === "completed").length;
                  const selected = sameDay(date, selectedDate);
                  const today = sameDay(date, new Date());
                  return (
                    <button key={date.toISOString()} type="button" onClick={() => setSelectedDate(date)} aria-pressed={selected}
                      className={`min-h-[48px] border-b border-r border-chalk-faint p-1.5 text-left transition sm:min-h-[62px] sm:p-2 ${selected ? "bg-brand-gold/10 ring-1 ring-inset ring-brand-gold" : "hover:bg-panel-2"}`}>
                      <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] sm:text-xs ${today ? "bg-brand-red text-white" : inMonth ? "text-chalk" : "text-chalk-muted/40"}`}>{date.getDate()}</span>
                      {dayBookings.length > 0 && <div className="mt-1 flex flex-wrap gap-1">
                        {scheduled > 0 && <span title={`${scheduled} scheduled`} className="rounded-sm bg-amber-300 px-1 text-[9px] font-bold leading-4 text-amber-950">{scheduled}</span>}
                        {completed > 0 && <span title={`${completed} completed`} className="rounded-sm bg-green-400 px-1 text-[9px] font-bold leading-4 text-green-950">{completed}</span>}
                        {dayBookings.length > scheduled + completed && <span title="Cancelled or other status" className="rounded-sm bg-slate-500 px-1 text-[9px] font-bold leading-4 text-white">{dayBookings.length - scheduled - completed}</span>}
                      </div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className="min-w-0 rounded-xl border border-chalk-faint bg-panel-2 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</h3>
                  <p className="mt-1 text-xs text-chalk-muted">{selectedBookings.length} class{selectedBookings.length === 1 ? "" : "es"} · {completedCount} completed</p>
                </div>
              </div>
              {selectedBookings.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-chalk-faint p-4 text-xs text-chalk-muted">No classes on this date.</p> : (
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {selectedBookings.map((booking) => {
                    const completed = booking.status === "completed";
                    const scheduled = booking.status === "confirmed";
                    const tone = completed ? "border-green-400/30 bg-green-400/10 text-green-300" : scheduled ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-chalk-faint bg-panel text-chalk-muted";
                    return <article key={booking.id} className={`rounded-lg border p-3 ${tone}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold">{booking.subject_name || "Class"}</p>
                        <span className="shrink-0 text-[10px] font-semibold capitalize">{completed ? "Completed" : scheduled ? "Scheduled" : String(booking.status || "Other").replaceAll("_", " ")}</span>
                      </div>
                      <p className="mt-1 text-[11px] opacity-80">{timeLabel(booking.scheduled_at)}{booking.teacher_name ? ` · ${booking.teacher_name}` : ""}</p>
                    </article>;
                  })}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
