import DashboardLayout from "./dashboard/DashboardLayout";

const TEACHER_NAV = [
  { label: "Teaching", items: [
    { path: "/dashboard/teacher", label: "Dashboard", icon: "dashboard" },
    { path: "/dashboard/teacher/calendar", label: "Calendar", icon: "calendar" },
    { path: "/dashboard/teacher/class-records", label: "Class Records", icon: "records" },
  ]},
  { label: "Profile", items: [
    { path: "/dashboard/teacher/profile", label: "Teacher Profile", icon: "profile" },
  ]},
];

export default function TeacherDashboardLayout({ children }) {
  return <DashboardLayout navItems={TEACHER_NAV}>{children}</DashboardLayout>;
}
