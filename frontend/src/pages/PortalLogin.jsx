import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const PORTALS = {
  admin: {
    title: "Admin sign in",
    subtitle: "Sign in to the Dexmy administration portal",
    allowedRoles: [
      "admin",
      "super_admin",
      "academic_manager",
      "teacher_manager",
      "finance_manager",
      "support_agent",
    ],
    dashboard: "/dashboard/admin",
  },
  testCreator: {
    title: "Test Creator sign in",
    subtitle: "Sign in to the Dexmy test creation portal",
    allowedRoles: ["test_creator", "admin", "super_admin"],
    dashboard: "/test-creator",
  },
};

export default function PortalLogin({ portal }) {
  const config = PORTALS[portal];
  const { login, logout, loading } = useAuth();
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

      if (!config.allowedRoles.includes(user.role)) {
        logout();
        setError("This account is not authorized to use this portal.");
        return;
      }

      navigate(config.dashboard);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't sign in — check your details and try again.");
    }
  }

  return (
    <AuthLayout title={config.title} subtitle={config.subtitle}>
      <div className="mb-5 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-chalk-muted">
        This portal is restricted to authorized Dexmy staff.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="portal-email" className="block text-sm font-medium mb-1.5">Email</label>
          <input id="portal-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold" />
        </div>

        <div>
          <label htmlFor="portal-password" className="block text-sm font-medium mb-1.5">Password</label>
          <div className="relative">
            <input id="portal-password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-brand-gold" />
            <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-muted hover:text-chalk transition-colors">{showPassword ? "◉" : "◌"}</button>
          </div>
        </div>

        {error && <p className="text-brand-red text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="w-full bg-brand-red hover:bg-brand-red-dark transition-colors rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-chalk-muted mt-6">
        <Link to="/login" className="text-brand-gold font-medium hover:underline">Back to user login</Link>
      </p>
    </AuthLayout>
  );
}
