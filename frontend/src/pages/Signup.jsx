import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
];

export default function Signup() {
  const { signup, loading } = useAuth();
  const [role, setRole] = useState("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await signup({ role, full_name: fullName, email, phone, password });
      setSuccessMessage(res.message);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't create your account — please try again.");
    }
  }

  if (successMessage) {
    return (
      <AuthLayout title="Check your email">
        <p className="text-sm text-chalk-muted">{successMessage}</p>
        <Link to="/login" className="block text-center text-brand-gold text-sm font-medium mt-6 hover:underline">
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">I am a...</label>
          <div className="flex gap-2 bg-panel-2 p-1 rounded-lg">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${
                  role === r.value ? "bg-brand-red text-chalk" : "text-chalk-muted hover:text-chalk"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            {role === "parent" ? "Your name" : role === "student" ? "Your name" : "Your name"}
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={role === "parent" ? "e.g. Sunita Mehta" : "e.g. Aarav Mehta"}
            className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"
          />
          {role === "parent" && (
            <p className="text-xs text-chalk-muted mt-1.5">
              You'll link your child's account separately from your dashboard.
            </p>
          )}
        </div>

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
          <label className="block text-sm font-medium mb-1.5">Phone (optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={8}
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-chalk-muted mt-6">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-gold font-medium hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
