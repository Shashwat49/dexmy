import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { getMyTeacherProfile } from "../api/teachers";

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

function teacherProfileComplete(profile) {
  return Boolean(
    profile?.bio?.trim() &&
      profile?.qualifications?.trim() &&
      profile?.years_experience !== null &&
      profile?.years_experience !== undefined &&
      profile?.hourly_rate !== null &&
      profile?.hourly_rate !== undefined &&
      Array.isArray(profile?.subject_ids) &&
      profile.subject_ids.length > 0
  );
}

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);

      if (user.role === "teacher") {
        try {
          const profile = await getMyTeacherProfile();
          navigate(teacherProfileComplete(profile) ? "/dashboard/teacher" : "/dashboard/teacher/profile");
        } catch (profileError) {
          console.error("Teacher profile check failed:", profileError);
          navigate("/dashboard/teacher/profile");
        }
        return;
      }

      navigate(DASHBOARD_BY_ROLE[user.role] || "/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log in — check your details and try again.");
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your Dexmy account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1.5">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold" /></div>
        <div><label className="block text-sm font-medium mb-1.5">Password</label><div className="relative"><input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-brand-gold" /><button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-muted hover:text-chalk transition-colors">{showPassword ? "◉" : "◌"}</button></div></div>
        {error && <p className="text-brand-red text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full bg-brand-red hover:bg-brand-red-dark transition-colors rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">{loading ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="text-center text-sm text-chalk-muted mt-6">New to Dexmy? <Link to="/signup" className="text-brand-gold font-medium hover:underline">Create an account</Link></p>
    </AuthLayout>
  );
}
