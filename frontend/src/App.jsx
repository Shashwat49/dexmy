import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardRedirect from "./pages/dashboard/DashboardRedirect";
import TeacherDashboard from "./pages/dashboard/TeacherDashboard";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import ParentDashboard from "./pages/dashboard/ParentDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import AdminStudents from "./pages/dashboard/AdminStudents";
import BookClass from "./pages/dashboard/student/BookClass";
import MyNotes from "./pages/dashboard/student/MyNotes";
import MyAccount from "./pages/dashboard/MyAccount";
import TeacherProfile from "./pages/dashboard/teacher/TeacherProfile";
import TeacherCalendar from "./pages/dashboard/teacher/TeacherCalendar";
import CourseDetails from "./pages/dashboard/CourseDetails";

const ADMIN_ROLES = [
  "admin",
  "super_admin",
  "academic_manager",
  "teacher_manager",
  "finance_manager",
  "support_agent",
];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
      <Route path="/dashboard/teacher" element={<ProtectedRoute roles={["teacher"]}><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/student/book" element={<ProtectedRoute roles={["student"]}><BookClass /></ProtectedRoute>} />
      <Route path="/dashboard/student/notes" element={<ProtectedRoute roles={["student"]}><MyNotes /></ProtectedRoute>} />
      <Route path="/dashboard/student/account" element={<ProtectedRoute roles={["student"]}><MyAccount /></ProtectedRoute>} />
      <Route path="/dashboard/parent" element={<ProtectedRoute roles={["parent"]}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/parent/courses/:courseId" element={<ProtectedRoute roles={["parent"]}><CourseDetails /></ProtectedRoute>} />
      <Route path="/dashboard/admin" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/admin/students" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminStudents /></ProtectedRoute>} />
      <Route path="/dashboard/teacher/profile" element={<ProtectedRoute roles={["teacher"]}><TeacherProfile /></ProtectedRoute>} />
      <Route path="/dashboard/teacher/calendar" element={<ProtectedRoute roles={["teacher"]}><TeacherCalendar /></ProtectedRoute>} />
    </Routes>
  );
}
