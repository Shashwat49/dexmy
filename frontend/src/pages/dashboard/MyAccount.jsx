import { useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { getMyStudentProfile, updateMyStudentProfile } from "../../api/students";
import { CalendarIcon, GearIcon } from "../../components/dashboard/icons";

const NAV = [
  { label: "Learn", items: [
    { path: "/dashboard/student", label: "My classes", icon: <CalendarIcon /> },
    { path: "/dashboard/student/book", label: "Book a class", icon: <CalendarIcon /> },
    { path: "/dashboard/student/notes", label: "My notes", icon: <CalendarIcon /> },
  ] },
  { label: "Account", items: [{ path: "/dashboard/student/account", label: "My account", icon: <GearIcon /> }] },
];

const TABS = ["Personal Details", "Educational Details", "Parent Details"];
const INPUT = "w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-3 text-sm text-chalk outline-none transition focus:border-brand-gold disabled:cursor-default disabled:opacity-90";

const initialForm = {
  full_name: "", email: "", phone: "", date_of_birth: "", gender: "", address: "", city: "", country: "",
  grade_level: "", school_name: "", board: "", academic_year: "", subjects: "", student_id_number: "",
  parent_name: "", parent_email: "", parent_phone: "", parent_relationship: "", parent_occupation: "",
};

const normalize = (profile) => ({
  ...initialForm,
  ...profile,
  date_of_birth: profile?.date_of_birth || "",
  email: profile?.email || "",
  full_name: profile?.full_name || "",
  phone: profile?.phone || "",
});

export default function MyAccount() {
  const [profile, setProfile] = useState(initialForm);
  const [draft, setDraft] = useState(initialForm);
  const [tab, setTab] = useState(TABS[0]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getMyStudentProfile()
      .then((data) => { const next = normalize(data); setProfile(next); setDraft(next); })
      .catch((e) => setError(e.response?.data?.detail || "Unable to load your account details."))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = () => { setDraft(profile); setEditing(true); setError(""); setSuccess(""); };
  const cancelEdit = () => { setDraft(profile); setEditing(false); setError(""); };
  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = { ...draft };
      delete payload.email;
      const data = await updateMyStudentProfile(payload);
      const next = normalize(data);
      setProfile(next); setDraft(next); setEditing(false); setSuccess("Your account details have been saved.");
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to save your account details.");
    } finally { setSaving(false); }
  };

  return <DashboardLayout navItems={NAV}>
    <div className="border-b border-chalk-faint px-8 py-5.5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-chalk-muted">Account</p><h1 className="mt-1 text-2xl font-semibold">My account</h1><p className="mt-1 text-sm text-chalk-muted">Keep your student information up to date.</p></div>{editing ? <div className="flex gap-2"><button onClick={cancelEdit} disabled={saving} className="rounded-xl border border-chalk-faint px-4 py-2.5 text-sm font-semibold text-chalk-muted hover:text-chalk">Cancel</button><button onClick={save} disabled={saving} className="rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button></div> : <button onClick={startEdit} className="rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold">Edit details</button>}</div></div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}
      {success && <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">{success}</div>}
      {loading ? <div className="py-16 text-center text-sm text-chalk-muted">Loading your account…</div> : <>
        <section className="rounded-2xl border border-chalk-faint bg-panel p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-red/15 text-xl font-semibold text-brand-gold">{(profile.full_name || "S").trim().charAt(0).toUpperCase()}</div><div className="min-w-0"><h2 className="text-xl font-semibold">{profile.full_name || "Student"}</h2><div className="mt-1 flex flex-col gap-1 text-sm text-chalk-muted sm:flex-row sm:gap-4"><span>{profile.email || "No email"}</span><span>{profile.phone || "No mobile number added"}</span></div></div></div></section>
        <section className="mt-7 rounded-2xl border border-chalk-faint bg-panel overflow-hidden"><div className="overflow-x-auto border-b border-chalk-faint"><div className="flex min-w-max px-2">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`px-5 py-4 text-sm font-semibold transition ${tab === item ? "border-b-2 border-brand-gold text-chalk" : "text-chalk-muted hover:text-chalk"}`}>{item}</button>)}</div></div><div className="p-6">{tab === "Personal Details" && <Personal profile={editing ? draft : profile} editing={editing} setField={setField} />}{tab === "Educational Details" && <Education profile={editing ? draft : profile} editing={editing} setField={setField} />}{tab === "Parent Details" && <Parent profile={editing ? draft : profile} editing={editing} setField={setField} />}</div></section>
      </>}
    </div>
  </DashboardLayout>;
}

function Personal({ profile, editing, setField }) { return <div><SectionIntro title="Personal Details" text="Basic information about you."/><div className="grid gap-5 md:grid-cols-2"> <Field label="Full name" value={profile.full_name} editing={editing} onChange={(v) => setField("full_name", v)} /><Field label="Email address" value={profile.email} editing={false} /><Field label="Mobile number" value={profile.phone} editing={editing} onChange={(v) => setField("phone", v)} /><Field label="Date of birth" value={profile.date_of_birth} editing={editing} type="date" onChange={(v) => setField("date_of_birth", v)} /><Field label="Gender" value={profile.gender} editing={editing} onChange={(v) => setField("gender", v)} /><Field label="Address" value={profile.address} editing={editing} onChange={(v) => setField("address", v)} /><Field label="City" value={profile.city} editing={editing} onChange={(v) => setField("city", v)} /><Field label="Country" value={profile.country} editing={editing} onChange={(v) => setField("country", v)} /></div></div>; }
function Education({ profile, editing, setField }) { return <div><SectionIntro title="Educational Details" text="Your current academic information."/><div className="grid gap-5 md:grid-cols-2"><Field label="Grade / year" value={profile.grade_level} editing={editing} onChange={(v) => setField("grade_level", v)} /><Field label="School / institution" value={profile.school_name} editing={editing} onChange={(v) => setField("school_name", v)} /><Field label="Board / curriculum" value={profile.board} editing={editing} onChange={(v) => setField("board", v)} /><Field label="Academic year" value={profile.academic_year} editing={editing} onChange={(v) => setField("academic_year", v)} /><Field label="Subjects" value={profile.subjects} editing={editing} onChange={(v) => setField("subjects", v)} /><Field label="Student ID / admission number" value={profile.student_id_number} editing={editing} onChange={(v) => setField("student_id_number", v)} /></div></div>; }
function Parent({ profile, editing, setField }) { return <div><SectionIntro title="Parent Details" text="Contact information for your parent or guardian."/><div className="grid gap-5 md:grid-cols-2"><Field label="Parent / guardian name" value={profile.parent_name} editing={editing} onChange={(v) => setField("parent_name", v)} /><Field label="Relationship" value={profile.parent_relationship} editing={editing} onChange={(v) => setField("parent_relationship", v)} /><Field label="Parent email" value={profile.parent_email} editing={editing} onChange={(v) => setField("parent_email", v)} /><Field label="Parent mobile number" value={profile.parent_phone} editing={editing} onChange={(v) => setField("parent_phone", v)} /><Field label="Occupation" value={profile.parent_occupation} editing={editing} onChange={(v) => setField("parent_occupation", v)} /></div></div>; }
function SectionIntro({ title, text }) { return <div className="mb-6"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-chalk-muted">{text}</p></div>; }
function Field({ label, value, editing, onChange, type = "text" }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-chalk-muted">{label}</span>{editing ? <input type={type} value={value || ""} onChange={(e) => onChange?.(e.target.value)} className={INPUT} /> : <div className="min-h-[46px] rounded-xl border border-transparent bg-panel-2/60 px-3.5 py-3 text-sm text-chalk">{value || <span className="text-chalk-muted">Not provided</span>}</div>}</label>; }
