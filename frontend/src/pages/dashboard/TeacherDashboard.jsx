import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getMyBookings } from "../../api/bookings";
import { getMyTeacherProfile } from "../../api/teachers";

const TEACHER_NAV = [
  { label: "Teaching", items: [
    { path: "/dashboard/teacher", label: "Dashboard" },
    { path: "/dashboard/teacher/calendar", label: "Calendar" },
  ]},
  { label: "Profile", items: [
    { path: "/dashboard/teacher/profile", label: "Teacher Profile" },
  ]},
];

function formatDate(dateString){return new Date(dateString).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
function formatTime(dateString){return new Date(dateString).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
function getEndTime(start,durationMinutes){const d=new Date(start);d.setMinutes(d.getMinutes()+durationMinutes);return formatTime(d)}
function isSameDay(dateString,targetDate){const d=new Date(dateString);return d.getFullYear()===targetDate.getFullYear()&&d.getMonth()===targetDate.getMonth()&&d.getDate()===targetDate.getDate()}
function isUpcoming(b){return new Date(b.scheduled_at)>new Date()&&b.status==="confirmed"}

export default function TeacherDashboard(){
 const[bookings,setBookings]=useState([]),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let cancelled=false;async function load(){setLoading(true);setError("");const results=await Promise.allSettled([getMyBookings(),getMyTeacherProfile()]);if(cancelled)return;const bookingResult=results[0],profileResult=results[1];if(bookingResult.status==="fulfilled")setBookings(Array.isArray(bookingResult.value)?bookingResult.value:[]);else setError(bookingResult.reason?.response?.data?.detail||"Unable to load your classes. Please try again later.");if(profileResult.status==="fulfilled")setProfile(profileResult.value);else if(!error)setError(profileResult.reason?.response?.data?.detail||"Unable to load your teacher profile.");setLoading(false)}load();return()=>{cancelled=true}},[]);
 const upcomingBookings=useMemo(()=>bookings.filter(isUpcoming).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)),[bookings]);
 const todayBookings=useMemo(()=>{const today=new Date();return bookings.filter(b=>isSameDay(b.scheduled_at,today)).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))},[bookings]);
 const completedBookings=useMemo(()=>bookings.filter(b=>b.status==="completed"),[bookings]);
 if(loading)return <DashboardLayout navItems={TEACHER_NAV}><div className="flex min-h-full items-center justify-center p-8"><p className="text-sm text-chalk-muted">Loading your teacher dashboard…</p></div></DashboardLayout>;
 return <DashboardLayout navItems={TEACHER_NAV}><div className="border-b border-chalk-faint px-8 py-5.5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm text-chalk-muted">Teacher Dashboard</p><h1 className="mt-1 text-3xl font-semibold">Welcome back{profile?.full_name?`, ${profile.full_name}`:""}</h1><p className="mt-2 text-sm text-chalk-muted">Manage your classes, schedule, and teaching profile.</p></div><Link to="/dashboard/teacher/profile" className="inline-flex items-center justify-center rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold">Edit Profile</Link></div></div><div className="flex-1 overflow-auto px-8 py-7">{error&&<div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}<div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Total Classes" value={bookings.length}/><Stat label="Upcoming" value={upcomingBookings.length}/><Stat label="Today" value={todayBookings.length}/><Stat label="Completed" value={completedBookings.length}/></div><section className="mb-8"><h2 className="text-xl font-semibold">Today's Classes</h2><p className="mt-1 text-sm text-chalk-muted">Classes scheduled for today.</p><div className="mt-4">{todayBookings.length?<div className="space-y-3">{todayBookings.map(b=><BookingCard key={b.id} booking={b}/>)}</div>:<Empty text="You have no classes scheduled for today."/>}</div></section><section><h2 className="text-xl font-semibold">Upcoming Classes</h2><p className="mt-1 text-sm text-chalk-muted">Your next scheduled classes.</p><div className="mt-4">{upcomingBookings.length?<div className="space-y-3">{upcomingBookings.slice(0,10).map(b=><BookingCard key={b.id} booking={b}/>)}</div>:<Empty text="No upcoming classes."/>}</div></section></div></DashboardLayout>
}
function Stat({label,value}){return <div className="rounded-2xl border border-chalk-faint bg-panel p-5"><p className="text-sm text-chalk-muted">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>}
function Empty({text}){return <div className="rounded-2xl border border-chalk-faint bg-panel p-8"><p className="text-sm text-chalk-muted">{text}</p></div>}
function BookingCard({booking}){return <div className="rounded-2xl border border-chalk-faint bg-panel p-5"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-sm font-semibold text-brand-gold">{formatTime(booking.scheduled_at)}</div><div><h3 className="font-semibold">{booking.subject_name}</h3><p className="mt-1 text-sm text-chalk-muted">Student: {booking.student_name}</p><p className="mt-1 text-sm text-chalk-muted">{formatDate(booking.scheduled_at)} • {formatTime(booking.scheduled_at)} – {getEndTime(booking.scheduled_at,booking.duration_minutes)}</p></div></div><div className="flex items-center gap-3"><span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">{booking.status}</span>{booking.teacher_assignment_status==="assigned"&&<span className="rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">Assigned</span>}</div></div></div>}
