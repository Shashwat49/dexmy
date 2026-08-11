import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const DASHBOARD_BY_ROLE = {
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
  parent: "/dashboard/parent",
  admin: "/dashboard/admin",
};

// Landing spot for /dashboard — sends the user to their actual role
// dashboard so nothing needs to hardcode which one to show.
export default function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={DASHBOARD_BY_ROLE[user.role] || "/login"} replace />;
}
