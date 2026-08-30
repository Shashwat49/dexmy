import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import ProgramPage from "./pages/ProgramPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardRedirect from "./pages/dashboard/DashboardRedirect";
import TeacherProfileGuard from "./components/TeacherProfileGuard";
import TeacherDashboard from "./pages/dashboard/TeacherDashboard";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import ParentDashboard from "./pages/dashboard/ParentDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import AdminStudents from "./pages/dashboard/AdminStudents";
import AdminTeachers from "./pages/dashboard/admin/AdminTeachers";
import AdminPackages from "./pages/dashboard/AdminPackages";
import AdminPayments from "./pages/dashboard/AdminPayments";
import AdminPayouts from "./pages/dashboard/AdminPayouts";
import AdminFinance from "./pages/dashboard/AdminFinance";
import AdminAuditLogs from "./pages/dashboard/AdminAuditLogs";
import AdminUsers from "./pages/dashboard/AdminUsers";
import AdminStudentPackages from "./pages/dashboard/AdminStudentPackages";
import AdminSupport from "./pages/dashboard/AdminSupport";
import AdminBookings from "./pages/dashboard/AdminBookings";
import BookClass from "./pages/dashboard/student/BookClass";
import MyNotes from "./pages/dashboard/student/MyNotes";
import MyAccount from "./pages/dashboard/MyAccount";
import TeacherProfile from "./pages/dashboard/teacher/TeacherProfile";
import TeacherProfileView from "./pages/dashboard/teacher/TeacherProfileView";
import TeacherCalendar from "./pages/dashboard/teacher/TeacherCalendar";
import CourseDetails from "./pages/dashboard/CourseDetails";
import TeacherDashboardLayout from "./components/TeacherDashboardLayout";
import ClassroomLiveAnnotation from "./components/ClassroomLiveAnnotation.jsx";
import ClassroomScreenShareFix from "./components/ClassroomScreenShareFix";
import Packages from "./pages/Packages";
import PackageCheckout from "./pages/dashboard/PackageCheckout";

const ADMIN_ROLES = ["admin", "super_admin", "academic_manager", "teacher_manager", "finance_manager", "support_agent"];
const Classroom = () => <><ClassroomLiveAnnotation /><ClassroomScreenShareFix /></>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/packages" element={<Packages />} />
      <Route path="/checkout/package" element={<PackageCheckout />} />
      <Route path="/sat-tutoring" element={<ProgramPage slug="sat" />} />
      <Route path="/psat-tutoring" element={<ProgramPage slug="psat" />} />
      <Route path="/ap-tutoring" element={<ProgramPage slug="ap" />} />
      <Route path="/tmua-tutoring" element={<ProgramPage slug="tmua" />} />
      <Route path="/igcse-tutoring" element={<ProgramPage slug="igcse" />} />
      <Route path="/ib-myp-tutoring" element={<ProgramPage slug="ib-myp" />} />
      <Route path="/gcse-tutoring" element={<ProgramPage slug="gcse" />} />
      <Route path="/cbse-tutoring" element={<ProgramPage slug="cbse" />} />
      <Route path="/icse-tutoring" element={<ProgramPage slug="icse" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
      <Route path="/classroom/:sessionId" element={<ProtectedRoute roles={["teacher", "student"]}><Classroom /></ProtectedRoute>} />
      <Route path="/classroom" element={<ProtectedRoute roles={["teacher", "student"]}><Classroom /></ProtectedRoute>} />
      <Route path="/dashboard/teacher" element={<ProtectedRoute roles={["teacher"]}><TeacherProfileGuard><TeacherDashboard /></TeacherProfileGuard></ProtectedRoute>} />
      <Route path="/dashboard/student" element={<ProtectedRoute roles={["student"]}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/student/book" element={<ProtectedRoute roles={["student"]}><BookClass /></ProtectedRoute>} />
      <Route path="/dashboard/student/notes" element={<ProtectedRoute roles={["student"]}><MyNotes /></ProtectedRoute>} />
      <Route path="/dashboard/student/account" element={<ProtectedRoute roles={["student"]}><MyAccount /></ProtectedRoute>} />
      <Route path="/dashboard/parent" element={<ProtectedRoute roles={["parent"]}><ParentDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/parent/courses/:courseId" element={<ProtectedRoute roles={["parent"]}><CourseDetails /></ProtectedRoute>} />
      <Route path="/dashboard/admin" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/dashboard/admin/students" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminStudents /></ProtectedRoute>} />
      <Route path="/dashboard/admin/teachers" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminTeachers /></ProtectedRoute>} />
      <Route path="/dashboard/admin/bookings" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminBookings /></ProtectedRoute>} />
      <Route path="/dashboard/admin/packages" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPackages /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payments" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPayments /></ProtectedRoute>} />
      <Route path="/dashboard/admin/payouts" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPayouts /></ProtectedRoute>} />
      <Route path="/dashboard/admin/finance" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminFinance /></ProtectedRoute>} />
      <Route path="/dashboard/admin/audit-logs" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminAuditLogs /></ProtectedRoute>} />
      <Route path="/dashboard/admin/users" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminUsers /></ProtectedRoute>} />
      <Route path="/dashboard/admin/student-packages" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminStudentPackages /></ProtectedRoute>} />
      <Route path="/dashboard/admin/support" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminSupport /></ProtectedRoute>} />
      <Route path="/dashboard/teacher/profile" element={<ProtectedRoute roles={["teacher"]}><TeacherProfileView /></ProtectedRoute>} />
      <Route path="/dashboard/teacher/profile/edit" element={<ProtectedRoute roles={["teacher"]}><TeacherDashboardLayout><TeacherProfile /></TeacherDashboardLayout></ProtectedRoute>} />
      <Route path="/dashboard/teacher/calendar" element={<ProtectedRoute roles={["teacher"]}><TeacherDashboardLayout><TeacherCalendar /></TeacherDashboardLayout></ProtectedRoute>} />
    </Routes>
  );
}
