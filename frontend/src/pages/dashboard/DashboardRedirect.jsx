import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const DASHBOARD_BY_ROLE = {
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
  parent: "/dashboard/parent",
  admin: "/dashboard/admin",
  super_admin: "/dashboard/admin",
  academic_manager: "/dashboard/admin",
  teacher_manager: "/dashboard/admin",
  finance_manager: "/dashboard/admin",
  support_agent: "/dashboard/admin",
};

export default function DashboardRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={DASHBOARD_BY_ROLE[user.role] || "/login"} replace />;
}
