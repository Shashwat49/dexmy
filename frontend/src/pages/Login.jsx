import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const DASHBOARD_BY_ROLE = {
  teacher: "/dashboard/teacher",
  student: "/dashboard/student",
  parent: "/dashboard/parent",
  admin: "/dashboard/admin",
};

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
      navigate(DASHBOARD_BY_ROLE[user.role] || "/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Couldn't log in — check your details and try again."
      );
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your Dexmy account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Email
          </label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-brand-gold"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-muted hover:text-chalk transition-colors"
            >
              {showPassword ? (
                /* Eye off */
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.5 6a11.7 11.7 0 0 1-3.1 3.8" />
                  <path d="M6.6 6.6C4.6 7.9 3.2 9.7 2.5 10c1 2 4.5 6 9.5 6 1 0 1.9-.2 2.8-.5" />
                </svg>
              ) : (
                /* Eye */
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-brand-red text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-red hover:bg-brand-red-dark transition-colors rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-center text-sm text-chalk-muted mt-6">
        New to Dexmy?{" "}
        <Link
          to="/signup"
          className="text-brand-gold font-medium hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}