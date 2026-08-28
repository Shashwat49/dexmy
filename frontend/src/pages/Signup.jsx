import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
];

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" }, { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" }, { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" }, { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+971", country: "United Arab Emirates", flag: "🇦🇪" }, { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+974", country: "Qatar", flag: "🇶🇦" }, { code: "+968", country: "Oman", flag: "🇴🇲" },
  { code: "+965", country: "Kuwait", flag: "🇰🇼" }, { code: "+973", country: "Bahrain", flag: "🇧🇭" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" }, { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" }, { code: "+60", country: "Malaysia", flag: "🇲🇾" },
  { code: "+62", country: "Indonesia", flag: "🇮🇩" }, { code: "+66", country: "Thailand", flag: "🇹🇭" },
  { code: "+81", country: "Japan", flag: "🇯🇵" }, { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+86", country: "China", flag: "🇨🇳" }, { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" }, { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" }, { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" }, { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" }, { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+7", country: "Russia", flag: "🇷🇺" }, { code: "+90", country: "Turkey", flag: "🇹🇷" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" }, { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+1", country: "Canada", flag: "🇨🇦" },
];

export default function Signup() {
  const { signup, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedRole = searchParams.get("role");
  const initialRole = ROLES.some((r) => r.value === requestedRole) ? requestedRole : "student";
  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault(); setError("");
    try {
      const createdUser = await signup({ role, full_name: fullName, email, phone: `${countryCode}${phone}`, password });
      navigate(createdUser.role === "teacher" ? "/dashboard/teacher/profile" : "/dashboard");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? (detail[0]?.msg || "Please check the information you entered.") : typeof detail === "string" ? detail : "Couldn't create your account — please try again.");
    }
  }

  return <AuthLayout title={role === "teacher" ? "Create your teacher account" : "Create your account"}>
    {role === "teacher" && <div className="mb-5 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-chalk-muted">After signup, you'll complete your teacher profile. Your application will then be sent to Dexmy for verification.</div>}
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium mb-1.5">I am a...</label><div className="flex gap-2 bg-panel-2 p-1 rounded-lg">{ROLES.map((r)=><button type="button" key={r.value} onClick={()=>setRole(r.value)} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${role===r.value?"bg-brand-red text-chalk":"text-chalk-muted hover:text-chalk"}`}>{r.label}</button>)}</div></div>
      <div><label className="block text-sm font-medium mb-1.5">Your name</label><input type="text" required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder={role==="parent"?"e.g. Sunita Mehta":"e.g. Aarav Mehta"} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"/></div>
      <div><label className="block text-sm font-medium mb-1.5">Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"/></div>
      <div><label className="block text-sm font-medium mb-1.5">Phone <span className="text-brand-red">*</span></label><div className="flex gap-2"><select value={countryCode} onChange={e=>setCountryCode(e.target.value)} className="w-[125px] shrink-0 bg-panel-3 border border-chalk-faint rounded-lg px-3 py-2.5 text-sm">{COUNTRY_CODES.map(c=><option key={`${c.country}-${c.code}`} value={c.code}>{c.flag} {c.code}</option>)}</select><input type="tel" required value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))} placeholder="9876543210" className="flex-1 min-w-0 bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-brand-gold"/></div></div>
      <div><label className="block text-sm font-medium mb-1.5">Password</label><div className="relative"><input type={showPassword?"text":"password"} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-panel-3 border border-chalk-faint rounded-lg px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-brand-gold"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-muted">{showPassword?"◉":"◌"}</button></div><p className="text-xs text-chalk-muted mt-1.5">Use at least 8 characters with uppercase, lowercase, and a number.</p></div>
      {error&&<p className="text-brand-red text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="w-full bg-brand-red hover:bg-brand-red-dark transition-colors rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50">{loading?"Creating account…":"Create account"}</button>
    </form>
    <p className="text-center text-sm text-chalk-muted mt-6">Already have an account? <Link to="/login" className="text-brand-gold font-medium hover:underline">Log in</Link></p>
  </AuthLayout>;
}
