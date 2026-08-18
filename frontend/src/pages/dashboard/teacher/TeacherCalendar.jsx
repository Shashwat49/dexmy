import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getMyBookings } from "../../../api/bookings";

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function endOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  );
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

function getEndTime(
  scheduledAt,
  durationMinutes
) {
  const date = new Date(scheduledAt);

  date.setMinutes(
    date.getMinutes() + durationMinutes
  );

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

  const firstDay = first.getDay();
  const daysInMonth = last.getDate();

  const days = [];

  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const date = new Date(first);

    date.setDate(
      first.getDate() - i - 1
    );

    days.push({
      date,
      currentMonth: false,
    });
  }

  // Current month
  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    days.push({
      date: new Date(
        monthDate.getFullYear(),
        monthDate.getMonth(),
        day
      ),
      currentMonth: true,
    });
  }

  // Next month's leading days
  let nextDay = 1;

  while (days.length < 42) {
    days.push({
      date: new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        nextDay
      ),
      currentMonth: false,
    });

    nextDay++;
  }

  return days;
}

export default function TeacherCalendar() {
  const [currentMonth, setCurrentMonth] =
    useState(new Date());

  const [bookings, setBookings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState(new Date());

  useEffect(() => {
    async function loadBookings() {
      try {
        setLoading(true);
        setError("");

        const data = await getMyBookings();

        setBookings(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (err) {
        console.error(
          "Teacher calendar error:",
          err
        );

        setError(
          err.response?.data?.detail ||
            "Unable to load your calendar."
        );
      } finally {
        setLoading(false);
      }
    }

    loadBookings();
  }, []);

  const calendarDays = useMemo(
    () =>
      getCalendarDays(
        currentMonth
      ),
    [currentMonth]
  );

  const selectedDayBookings =
    useMemo(() => {
      return bookings
        .filter((booking) =>
          sameDay(
            new Date(
              booking.scheduled_at
            ),
            selectedDate
          )
        )
        .sort(
          (a, b) =>
            new Date(
              a.scheduled_at
            ) -
            new Date(
              b.scheduled_at
            )
        );
    }, [
      bookings,
      selectedDate,
    ]);

  function previousMonth() {
    setCurrentMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }

  function nextMonth() {
    setCurrentMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }

  function goToToday() {
    const today = new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setSelectedDate(today);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-panel p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-chalk-muted">
            Loading calendar...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-panel">
      <div className="mx-auto max-w-7xl p-6 md:p-8">

        {/* HEADER */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>
            <Link
              to="/dashboard/teacher"
              className="text-sm text-chalk-muted hover:text-chalk"
            >
              ← Teacher Dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-semibold">
              Calendar
            </h1>

            <p className="mt-2 text-sm text-chalk-muted">
              View your assigned classes
              and teaching schedule.
            </p>
          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
            {error}
          </div>
        )}

        {/* CALENDAR */}

        <div className="overflow-hidden rounded-2xl border border-chalk-faint bg-panel">

          {/* CALENDAR HEADER */}

          <div className="flex flex-col gap-4 border-b border-chalk-faint p-5 md:flex-row md:items-center md:justify-between">

            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={previousMonth}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-chalk-faint hover:border-chalk-muted"
              >
                ←
              </button>

              <h2 className="min-w-[180px] text-center text-lg font-semibold">
                {formatMonth(
                  currentMonth
                )}
              </h2>

              <button
                type="button"
                onClick={nextMonth}
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

          {/* WEEKDAYS */}

          <div className="grid grid-cols-7 border-b border-chalk-faint">

            {WEEKDAYS.map(
              (day) => (
                <div
                  key={day}
                  className="border-r border-chalk-faint px-2 py-3 text-center text-xs font-medium text-chalk-muted last:border-r-0"
                >
                  {day}
                </div>
              )
            )}

          </div>

          {/* CALENDAR GRID */}

          <div className="grid grid-cols-7">

            {calendarDays.map(
              ({
                date,
                currentMonth:
                  isCurrentMonth,
              }) => {

                const dayBookings =
                  bookings.filter(
                    (booking) =>
                      sameDay(
                        new Date(
                          booking.scheduled_at
                        ),
                        date
                      )
                  );

                const selected =
                  sameDay(
                    date,
                    selectedDate
                  );

                const today =
                  sameDay(
                    date,
                    new Date()
                  );

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() =>
                      setSelectedDate(
                        date
                      )
                    }
                    className={`min-h-[110px] border-r border-b border-chalk-faint p-2 text-left transition ${
                      selected
                        ? "bg-brand-gold/10"
                        : "hover:bg-panel-3"
                    }`}
                  >

                    {/* DATE */}

                    <div className="flex items-center justify-between">

                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                          today
                            ? "bg-brand-red text-white"
                            : isCurrentMonth
                            ? "text-chalk"
                            : "text-chalk-muted/40"
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {dayBookings.length >
                        0 && (
                        <span className="text-[10px] text-brand-gold">
                          {dayBookings.length}
                        </span>
                      )}

                    </div>

                    {/* BOOKINGS */}

                    <div className="mt-2 space-y-1">

                      {dayBookings
                        .slice(0, 3)
                        .map(
                          (booking) => (
                            <div
                              key={
                                booking.id
                              }
                              className="truncate rounded-md bg-brand-gold/10 px-2 py-1 text-[10px] text-brand-gold"
                            >
                              {formatTime(
                                booking.scheduled_at
                              )}{" "}
                              ·{" "}
                              {
                                booking.subject_name
                              }
                            </div>
                          )
                        )}

                      {dayBookings.length >
                        3 && (
                        <div className="px-2 text-[10px] text-chalk-muted">
                          +
                          {dayBookings.length -
                            3}{" "}
                          more
                        </div>
                      )}

                    </div>

                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* SELECTED DAY */}

        <section className="mt-8">

          <div className="mb-4">

            <h2 className="text-xl font-semibold">
              {selectedDate.toLocaleDateString(
                "en-US",
                {
                  weekday:
                    "long",
                  month:
                    "long",
                  day:
                    "numeric",
                  year:
                    "numeric",
                }
              )}
            </h2>

            <p className="mt-1 text-sm text-chalk-muted">
              Your classes for this day.
            </p>

          </div>

          {selectedDayBookings.length ===
          0 ? (

            <div className="rounded-2xl border border-chalk-faint bg-panel p-8">
              <p className="text-sm text-chalk-muted">
                No classes scheduled
                for this day.
              </p>
            </div>

          ) : (

            <div className="space-y-3">

              {selectedDayBookings.map(
                (booking) => (

                  <div
                    key={booking.id}
                    className="rounded-2xl border border-chalk-faint bg-panel p-5"
                  >

                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                      <div>

                        <h3 className="font-semibold">
                          {
                            booking.subject_name
                          }
                        </h3>

                        <p className="mt-1 text-sm text-chalk-muted">
                          Student:{" "}
                          {
                            booking.student_name
                          }
                        </p>

                        <p className="mt-1 text-sm text-chalk-muted">
                          {formatTime(
                            booking.scheduled_at
                          )}
                          {" – "}
                          {getEndTime(
                            booking.scheduled_at,
                            booking.duration_minutes
                          )}
                        </p>

                      </div>

                      <div className="flex items-center gap-3">

                        <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs text-green-400">
                          {
                            booking.status
                          }
                        </span>

                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-brand-red px-4 py-2 text-sm font-semibold opacity-50"
                        >
                          Classroom
                        </button>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

      </div>
    </div>
  );
}