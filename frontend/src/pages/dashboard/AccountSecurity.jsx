import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { requestPasswordRecovery, resetPassword, confirmEmailChange, requestEmailChange, changePhoneNumber } from "../../api/accountSecurity";

const INPUT = "mt-1.5 w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-3 text-sm text-chalk outline-none focus:border-brand-gold";
const BUTTON = "rounded-xl bg-brand-red px-5 py-3 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

export default function AccountSecurity() {
  const { user } = useAuth();
  const roleNav = user?.role === "teacher"
    ? [
        { label: "Teaching", items: [{ path: "/dashboard/teacher", label: "Dashboard", icon: "dashboard" }, { path: "/dashboard/teacher/calendar", label: "Calendar", icon: "calendar" }, { path: "/dashboard/teacher/class-records", label: "Class Records", icon: "records" }] },
        { label: "Profile", items: [{ path: "/dashboard/teacher/profile", label: "Teacher Profile", icon: "profile" }] },
      ]
    : user?.role === "parent"
      ? [{ label: "Parent", items: [{ path: "/dashboard/parent", label: "My children", icon: "profile" }] }]
      : [];
  const [email, setEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [phoneMessage, setPhoneMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  async function submitEmail(e) {
    e.preventDefault();
    setEmailBusy(true); setEmailMessage(""); setEmailError("");
    try {
      const result = await requestEmailChange(email.trim(), emailPassword);
      setEmailMessage(result.message);
      setEmail(""); setEmailPassword("");
    } catch (error) {
      setEmailError(error.response?.data?.detail || "Unable to request an email change right now.");
    } finally { setEmailBusy(false); }
  }

  async function submitPhone(e) {
    e.preventDefault();
    setPhoneBusy(true); setPhoneMessage(""); setPhoneError("");
    try {
      const result = await changePhoneNumber(newPhone.trim(), phonePassword);
      setPhoneMessage(result.message);
      setNewPhone(""); setPhonePassword("");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setPhoneError(error.response?.data?.detail || "Unable to update your phone number right now.");
    } finally { setPhoneBusy(false); }
  }

  return <DashboardLayout navItems={roleNav}>
    <div className="border-b border-chalk-faint px-5 py-6 sm:px-8">
      <p className="text-sm text-chalk-muted">Account</p>
      <h1 className="mt-1 text-2xl font-semibold">Account security</h1>
      <p className="mt-1 text-sm text-chalk-muted">Manage your sign-in email and contact number.</p>
    </div>
    <div className="flex-1 overflow-auto px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto grid max-w-4xl gap-6">
        <section className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Email address</h2>
            <span className="text-sm text-chalk-muted">Current: {user?.email || "Not available"}</span>
          </div>
          <p className="mt-2 text-sm text-chalk-muted">We’ll send a confirmation link to your new address. Your current email stays active until you confirm.</p>
          <form onSubmit={submitEmail} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">New email address<input className={INPUT} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
            <label className="text-sm font-medium">Current password<input className={INPUT} type="password" required autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} /></label>
            <div className="sm:col-span-2 flex flex-col items-start gap-3">
              {emailError && <p role="alert" className="text-sm text-brand-red">{emailError}</p>}
              {emailMessage && <p role="status" className="text-sm text-green-400">{emailMessage}</p>}
              <button className={BUTTON} type="submit" disabled={emailBusy}>{emailBusy ? "Sending confirmation…" : "Send confirmation link"}</button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Phone number</h2>
            <span className="text-sm text-chalk-muted">Current: {user?.phone || "Not added"}</span>
          </div>
          <p className="mt-2 text-sm text-chalk-muted">Enter the full number with country code (for example, +91…). For verification without paid SMS, Dexmy asks for your current password before saving.</p>
          <form onSubmit={submitPhone} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">New phone number<input className={INPUT} type="tel" inputMode="tel" minLength={7} maxLength={20} required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91 98765 43210" /></label>
            <label className="text-sm font-medium">Current password<input className={INPUT} type="password" required autoComplete="current-password" value={phonePassword} onChange={(e) => setPhonePassword(e.target.value)} /></label>
            <div className="sm:col-span-2 flex flex-col items-start gap-3">
              {phoneError && <p role="alert" className="text-sm text-brand-red">{phoneError}</p>}
              {phoneMessage && <p role="status" className="text-sm text-green-400">{phoneMessage}</p>}
              <button className={BUTTON} type="submit" disabled={phoneBusy}>{phoneBusy ? "Updating…" : "Update phone number"}</button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-chalk-faint bg-panel-2 p-5 sm:p-6">
          <h2 className="font-semibold">Forgot your password?</h2>
          <p className="mt-1 text-sm text-chalk-muted">You can request a secure password-reset link even when you’re signed out.</p>
          <Link to="/forgot-password" className="mt-4 inline-flex text-sm font-semibold text-brand-gold hover:underline">Go to password recovery →</Link>
        </section>
      </div>
    </div>
  </DashboardLayout>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage(""); setError("");
    try {
      const result = await requestPasswordRecovery(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to process this request right now. Please try again.");
    } finally { setBusy(false); }
  }
  return <AuthShell title="Recover your password" subtitle="We’ll email a secure reset link if an eligible account exists.">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Account email<input className={INPUT} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {message && <p role="status" className="text-sm text-green-400">{message}</p>}
      {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
      <button className={BUTTON + " w-full"} type="submit" disabled={busy}>{busy ? "Requesting…" : "Send reset link"}</button>
    </form>
    <p className="mt-5 text-center text-sm text-chalk-muted"><Link className="text-brand-gold hover:underline" to="/login">Back to login</Link></p>
  </AuthShell>;
}

export function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage(""); setError("");
    if (password !== confirm) { setBusy(false); setError("The passwords do not match."); return; }
    try {
      const result = await resetPassword(token, password);
      window.dispatchEvent(new Event("dexmy:auth-expired"));
      setMessage(result.message);
    } catch (err) {
      setError(err.response?.data?.detail || "This reset link is invalid or expired. Request a new one.");
    } finally { setBusy(false); }
  }
  return <AuthShell title="Set a new password" subtitle="Choose a strong password for your Dexmy account.">
    {!token ? <p role="alert" className="text-sm text-brand-red">Reset token is missing. Please request a new link.</p> : <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">New password<input className={INPUT} type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <p className="text-xs text-chalk-muted">Use at least 8 characters, including uppercase and lowercase letters and a number.</p>
      <label className="block text-sm font-medium">Confirm new password<input className={INPUT} type="password" minLength={8} maxLength={128} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
      {message && <p role="status" className="text-sm text-green-400">{message} <Link to="/login" className="font-semibold text-brand-gold hover:underline">Log in</Link></p>}
      {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
      {!message && <button className={BUTTON + " w-full"} type="submit" disabled={busy}>{busy ? "Updating password…" : "Reset password"}</button>}
    </form>}
    <p className="mt-5 text-center text-sm text-chalk-muted"><Link className="text-brand-gold hover:underline" to="/forgot-password">Request a new link</Link></p>
  </AuthShell>;
}

export function ConfirmEmailChange() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [state, setState] = useState({ busy: false, attempted: false, message: "", error: "" });
  async function confirm() {
    if (!token) {
      setState({ busy: false, attempted: true, message: "", error: "Confirmation token is missing." });
      return;
    }
    setState({ busy: true, attempted: true, message: "", error: "" });
    try {
      const result = await confirmEmailChange(token);
      window.dispatchEvent(new Event("dexmy:auth-expired"));
      setState({ busy: false, attempted: true, message: result.message, error: "" });
    } catch (err) {
      setState({ busy: false, attempted: true, message: "", error: err.response?.data?.detail || "This confirmation link is invalid or expired." });
    }
  }
  return <AuthShell title="Confirm email address" subtitle="Confirm that you control the new email address for your Dexmy account.">
    {!state.attempted ? <button className={BUTTON + " w-full"} type="button" onClick={confirm} disabled={!token}>Confirm email address</button> : state.busy ? <p className="text-sm text-chalk-muted">Verifying your link…</p> : state.error ? <p role="alert" className="text-sm text-brand-red">{state.error}</p> : <p role="status" className="text-sm text-green-400">{state.message}</p>}
    <p className="mt-5 text-sm text-chalk-muted"><Link to="/login" className="text-brand-gold hover:underline">Go to login</Link></p>
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }) {
  return <div className="min-h-screen bg-void text-chalk flex items-center justify-center px-4 py-10"><div className="w-full max-w-md rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-8"><Link to="/" className="text-sm font-bold tracking-wide text-brand-gold">DEXMY</Link><h1 className="mt-5 text-2xl font-semibold">{title}</h1><p className="mt-2 mb-6 text-sm text-chalk-muted">{subtitle}</p>{children}</div></div>;
}
