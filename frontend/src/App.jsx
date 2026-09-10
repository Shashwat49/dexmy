import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import ProgramPage from "./pages/ProgramPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardRedirect from "./pages/dashboard/DashboardRedirect";
import TeacherProfileGuard from "./components/TeacherProfileGuard";
import TeacherDashboard from "./pages/dashboard/TeacherDashboard";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import ParentDashboard from "./pages/dashboard/ParentDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import TeacherDashboardLayout from "./components/TeacherDashboardLayout";

// Keep heavy/rarely-used dashboard pages out of the initial JavaScript bundle.
// This is especially important for Classroom, which pulls in LiveKit/Three.js.
const AdminStudents = lazy(() => import("./pages/dashboard/AdminStudents"));
const AdminTeachers = lazy(() => import("./pages/dashboard/admin/AdminTeachers"));
const AdminPackages = lazy(() => import("./pages/dashboard/AdminPackages"));
const AdminPayments = lazy(() => import("./pages/dashboard/AdminPayments"));
const AdminPayouts = lazy(() => import("./pages/dashboard/AdminPayouts"));
const AdminFinance = lazy(() => import("./pages/dashboard/AdminFinance"));
const AdminAuditLogs = lazy(() => import("./pages/dashboard/AdminAuditLogs"));
const AdminUsers = lazy(() => import("./pages/dashboard/AdminUsers"));
const AdminStudentPackages = lazy(() => import("./pages/dashboard/AdminStudentPackages"));
const AdminSupport = lazy(() => import("./pages/dashboard/AdminSupport"));
const AdminBookings = lazy(() => import("./pages/dashboard/AdminBookings"));
const AdminMeetClassRecords = lazy(() => import("./pages/dashboard/AdminMeetClassRecords"));
const BookClass = lazy(() => import("./pages/dashboard/student/BookClass"));
const MyNotes = lazy(() => import("./pages/dashboard/student/MyNotes"));
const MyAccount = lazy(() => import("./pages/dashboard/MyAccount"));
const TeacherProfile = lazy(() => import("./pages/dashboard/teacher/TeacherProfile"));
const TeacherProfileView = lazy(() => import("./pages/dashboard/teacher/TeacherProfileView"));
const TeacherCalendar = lazy(() => import("./pages/dashboard/teacher/TeacherCalendar"));
const TeacherClassRecords = lazy(() => import("./pages/dashboard/teacher/TeacherClassRecords"));
const CourseDetails = lazy(() => import("./pages/dashboard/CourseDetails"));
const Packages = lazy(() => import("./pages/Packages"));
const PackageCheckout = lazy(() => import("./pages/dashboard/PackageCheckout"));
const Classroom = lazy(() => import("./pages/Classroom"));

const ADMIN_ROLES = ["admin", "super_admin", "academic_manager", "teacher_manager", "finance_manager", "support_agent"];

function PageLoading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-sm text-chalk-muted" role="status" aria-live="polite">
        <span className="h-4 w-4 rounded-full border-2 border-chalk-faint border-t-brand-red animate-spin" />
        Loading…
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
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
        <Route path="/dashboard/teacher/class-records" element={<ProtectedRoute roles={["teacher"]}><TeacherClassRecords /></ProtectedRoute>} />
        <Route path="/dashboard/teacher/profile" element={<ProtectedRoute roles={["teacher"]}><TeacherProfileView /></ProtectedRoute>} />
        <Route path="/dashboard/teacher/profile/edit" element={<ProtectedRoute roles={["teacher"]}><TeacherDashboardLayout><TeacherProfile /></TeacherDashboardLayout></ProtectedRoute>} />
        <Route path="/dashboard/teacher/calendar" element={<ProtectedRoute roles={["teacher"]}><TeacherDashboardLayout><TeacherCalendar /></TeacherDashboardLayout></ProtectedRoute>} />
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
        <Route path="/dashboard/admin/meet-class-records" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminMeetClassRecords /></ProtectedRoute>} />
        <Route path="/dashboard/admin/packages" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPackages /></ProtectedRoute>} />
        <Route path="/dashboard/admin/payments" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPayments /></ProtectedRoute>} />
        <Route path="/dashboard/admin/payouts" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminPayouts /></ProtectedRoute>} />
        <Route path="/dashboard/admin/finance" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminFinance /></ProtectedRoute>} />
        <Route path="/dashboard/admin/audit-logs" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminAuditLogs /></ProtectedRoute>} />
        <Route path="/dashboard/admin/users" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminUsers /></ProtectedRoute>} />
        <Route path="/dashboard/admin/student-packages" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminStudentPackages /></ProtectedRoute>} />
        <Route path="/dashboard/admin/support" element={<ProtectedRoute roles={ADMIN_ROLES}><AdminSupport /></ProtectedRoute>} />
      </Routes>
    </Suspense>
  );
}
