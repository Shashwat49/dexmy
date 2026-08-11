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
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      navigate(DASHBOARD_BY_ROLE[user.role] || "/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't log in — check your details and try again.");
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your Dexmy account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"
          />
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
        <Link to="/signup" className="text-brand-gold font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
