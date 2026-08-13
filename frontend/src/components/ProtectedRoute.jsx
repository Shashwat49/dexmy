import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Wrap a route element with this to require login, and optionally restrict
// it to specific roles. Usage:
//   <ProtectedRoute roles={["teacher"]}><TeacherDashboard /></ProtectedRoute>
export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
