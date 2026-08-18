import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getMyBookings } from "../../api/bookings";
import { getMyTeacherProfile } from "../../api/teachers";


function formatDate(dateString) {
    const date = new Date(dateString);

    return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}


function formatTime(dateString) {
    const date = new Date(dateString);

    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
}


function getEndTime(start, durationMinutes) {
    const date = new Date(start);

    date.setMinutes(
        date.getMinutes() + durationMinutes
    );

    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
}


function isSameDay(dateString, targetDate) {
    const date = new Date(dateString);

    return (
        date.getFullYear() === targetDate.getFullYear() &&
        date.getMonth() === targetDate.getMonth() &&
        date.getDate() === targetDate.getDate()
    );
}


function isUpcoming(booking) {
    const start = new Date(
        booking.scheduled_at
    );

    return (
        start > new Date() &&
        booking.status === "confirmed"
    );
}


export default function TeacherDashboard() {
    const [bookings, setBookings] = useState([]);
    const [profile, setProfile] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    useEffect(() => {
        async function loadDashboard() {
            try {
                setLoading(true);
                setError("");

                const [
                    bookingData,
                    teacherProfile,
                ] = await Promise.all([
                    getMyBookings(),
                    getMyTeacherProfile(),
                ]);

                setBookings(
                    Array.isArray(bookingData)
                        ? bookingData
                        : []
                );

                setProfile(
                    teacherProfile
                );

            } catch (err) {
                console.error(
                    "Teacher dashboard error:",
                    err
                );

                setError(
                    err.response?.data?.detail ||
                    "Unable to load your dashboard."
                );
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, []);


    const upcomingBookings = useMemo(() => {
        return bookings
            .filter(isUpcoming)
            .sort(
                (a, b) =>
                    new Date(a.scheduled_at) -
                    new Date(b.scheduled_at)
            );
    }, [bookings]);


    const todayBookings = useMemo(() => {
        const today = new Date();

        return bookings
            .filter((booking) =>
                isSameDay(
                    booking.scheduled_at,
                    today
                )
            )
            .sort(
                (a, b) =>
                    new Date(a.scheduled_at) -
                    new Date(b.scheduled_at)
            );
    }, [bookings]);


    const completedBookings = useMemo(() => {
        return bookings.filter(
            (booking) =>
                booking.status === "completed"
        );
    }, [bookings]);


    const totalClasses = bookings.length;


    if (loading) {
        return (
            <div className="min-h-screen bg-panel p-6 md:p-8">
                <div className="max-w-7xl mx-auto">

                    <div className="rounded-2xl border border-chalk-faint bg-panel p-8">
                        <p className="text-sm text-chalk-muted">
                            Loading your teacher dashboard...
                        </p>
                    </div>

                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-panel">

            <div className="mx-auto max-w-7xl p-6 md:p-8">

                {/* =====================================================
                    HEADER
                ====================================================== */}

                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>

                        <p className="text-sm text-chalk-muted">
                            Teacher Dashboard
                        </p>

                        <h1 className="mt-1 text-3xl font-semibold">
                            Welcome back
                            {profile?.full_name
                                ? `, ${profile.full_name}`
                                : ""}
                        </h1>

                        <p className="mt-2 text-sm text-chalk-muted">
                            Manage your classes, schedule,
                            and teaching profile.
                        </p>

                    </div>


                    <Link
                        to="/dashboard/teacher/profile"
                        className="inline-flex items-center justify-center rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold transition hover:bg-brand-red-dark"
                    >
                        Edit Profile
                    </Link>

                </div>


                {/* =====================================================
                    ERROR
                ====================================================== */}

                {error && (
                    <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
                        {error}
                    </div>
                )}


                {/* =====================================================
                    STATS
                ====================================================== */}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">

                    <div className="rounded-2xl border border-chalk-faint bg-panel p-5">

                        <p className="text-sm text-chalk-muted">
                            Total Classes
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {totalClasses}
                        </p>

                    </div>


                    <div className="rounded-2xl border border-chalk-faint bg-panel p-5">

                        <p className="text-sm text-chalk-muted">
                            Upcoming
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {upcomingBookings.length}
                        </p>

                    </div>


                    <div className="rounded-2xl border border-chalk-faint bg-panel p-5">

                        <p className="text-sm text-chalk-muted">
                            Today
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {todayBookings.length}
                        </p>

                    </div>


                    <div className="rounded-2xl border border-chalk-faint bg-panel p-5">

                        <p className="text-sm text-chalk-muted">
                            Completed
                        </p>

                        <p className="mt-2 text-3xl font-semibold">
                            {completedBookings.length}
                        </p>

                    </div>

                </div>


                {/* =====================================================
                    TODAY
                ====================================================== */}

                <section className="mb-8">

                    <div className="mb-4">

                        <h2 className="text-xl font-semibold">
                            Today's Classes
                        </h2>

                        <p className="mt-1 text-sm text-chalk-muted">
                            Classes scheduled for today.
                        </p>

                    </div>


                    {todayBookings.length === 0 ? (

                        <div className="rounded-2xl border border-chalk-faint bg-panel p-8">

                            <p className="text-sm text-chalk-muted">
                                You have no classes scheduled
                                for today.
                            </p>

                        </div>

                    ) : (

                        <div className="space-y-3">

                            {todayBookings.map(
                                (booking) => (

                                    <BookingCard
                                        key={booking.id}
                                        booking={booking}
                                        today
                                    />

                                )
                            )}

                        </div>

                    )}

                </section>


                {/* =====================================================
                    UPCOMING
                ====================================================== */}

                <section className="mb-8">

                    <div className="mb-4 flex items-end justify-between">

                        <div>

                            <h2 className="text-xl font-semibold">
                                Upcoming Classes
                            </h2>

                            <p className="mt-1 text-sm text-chalk-muted">
                                Your next scheduled classes.
                            </p>

                        </div>

                    </div>


                    {upcomingBookings.length === 0 ? (

                        <div className="rounded-2xl border border-chalk-faint bg-panel p-8">

                            <p className="text-sm text-chalk-muted">
                                No upcoming classes.
                            </p>

                        </div>

                    ) : (

                        <div className="space-y-3">

                            {upcomingBookings
                                .slice(0, 10)
                                .map(
                                    (booking) => (

                                        <BookingCard
                                            key={booking.id}
                                            booking={booking}
                                        />

                                    )
                                )}

                        </div>

                    )}

                </section>


                {/* =====================================================
                    QUICK ACTIONS
                ====================================================== */}

                <section>

                    <h2 className="mb-4 text-xl font-semibold">
                        Quick Actions
                    </h2>


                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                        <Link
                            to="/dashboard/teacher/profile"
                            className="rounded-2xl border border-chalk-faint bg-panel p-5 transition hover:border-brand-gold"
                        >

                            <p className="font-semibold">
                                Teacher Profile
                            </p>

                            <p className="mt-2 text-sm text-chalk-muted">
                                Update your qualifications,
                                subjects, experience, and rate.
                            </p>

                        </Link>


                        <Link
                            to="/dashboard/teacher/calendar"
                            className="rounded-2xl border border-chalk-faint bg-panel p-5 transition hover:border-brand-gold"
                        >
                            <p className="font-semibold">
                                Calendar
                            </p>

                            <p className="mt-2 text-sm text-chalk-muted">
                                View your assigned classes and teaching schedule.
                            </p>
                        </Link>


                        <div className="rounded-2xl border border-chalk-faint bg-panel p-5 opacity-70">

                            <p className="font-semibold">
                                Classroom
                            </p>

                            <p className="mt-2 text-sm text-chalk-muted">
                                Live classroom access will be
                                connected in the next phase.
                            </p>

                        </div>

                    </div>

                </section>

            </div>

        </div>
    );
}


/* ================================================================
   BOOKING CARD
================================================================ */

function BookingCard({
    booking,
    today = false,
}) {
    return (
        <div className="rounded-2xl border border-chalk-faint bg-panel p-5">

            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                {/* LEFT */}

                <div className="flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-sm font-semibold text-brand-gold">

                        {formatTime(
                            booking.scheduled_at
                        )}

                    </div>


                    <div>

                        <h3 className="font-semibold">
                            {booking.subject_name}
                        </h3>

                        <p className="mt-1 text-sm text-chalk-muted">
                            Student:{" "}
                            {booking.student_name}
                        </p>

                        <p className="mt-1 text-sm text-chalk-muted">
                            {formatDate(
                                booking.scheduled_at
                            )}
                            {" • "}
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

                </div>


                {/* RIGHT */}

                <div className="flex items-center gap-3">

                    <span
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${booking.status === "confirmed"
                                ? "bg-green-500/10 text-green-400"
                                : booking.status === "completed"
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "bg-chalk-faint text-chalk-muted"
                            }`}
                    >
                        {booking.status}
                    </span>


                    {booking.teacher_assignment_status ===
                        "assigned" && (
                            <span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
                                Assigned
                            </span>
                        )}

                </div>

            </div>

        </div>
    );
}