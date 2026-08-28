import DashboardLayout from "./dashboard/DashboardLayout";

const TEACHER_NAV = [
  { label: "Teaching", items: [
    { path: "/dashboard/teacher", label: "Dashboard" },
    { path: "/dashboard/teacher/calendar", label: "Calendar" },
  ]},
  { label: "Profile", items: [
    { path: "/dashboard/teacher/profile", label: "Teacher Profile" },
  ]},
];

export default function TeacherDashboardLayout({ children }) {
  return <DashboardLayout navItems={TEACHER_NAV}>{children}</DashboardLayout>;
}
