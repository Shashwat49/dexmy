import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  roles,
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-void text-chalk flex items-center justify-center">
        <div className="text-sm text-chalk-muted">
          Loading Dexmy...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    roles &&
    roles.length > 0 &&
    !roles.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}