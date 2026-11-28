import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import api from "../../api/client";
import { packageAdminPayload, selectedSubjectIds } from "./packageAdmin";

const blank = { name: "", description: "", class_count: 25, price: "", currency: "INR", is_custom: false, is_active: true, subject_ids: [] };
const inputClass = "rounded-lg border border-chalk-faint bg-panel px-3 py-2.5 text-sm";

export default function AdminPackages() {
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [packagesResponse, subjectsResponse] = await Promise.all([
        api.get("/admin/packages", { params: { include_inactive: true } }),
        api.get("/subjects"),
      ]);
      setItems(packagesResponse.data || []);
      setSubjects(subjectsResponse.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to load packages and subjects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function save(event) {
    event.preventDefault();
    if (Number(form.class_count) < 25) {
      setError("A package must contain at least 25 classes.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = packageAdminPayload(form);
      if (editing) await api.patch(`/admin/packages/${editing}`, payload);
      else await api.post("/admin/packages", payload);
      setForm(blank);
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to save package.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(id) {
    if (!window.confirm("Disable this package? Existing student packages are not changed.")) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/admin/packages/${id}/disable`);
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || "Unable to disable package.");
    } finally {
      setBusy(false);
    }
  }

  function edit(packagePlan) {
    setEditing(packagePlan.id);
    setForm({
      name: packagePlan.name,
      description: packagePlan.description || "",
      class_count: packagePlan.class_count,
      price: String(packagePlan.price),
      currency: packagePlan.currency,
      is_custom: packagePlan.is_custom,
      is_active: packagePlan.is_active,
      subject_ids: selectedSubjectIds(packagePlan.subjects),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return <DashboardLayout>
    <div className="border-b border-chalk-faint px-8 py-5.5">
      <h1 className="font-display text-2xl">Packages &amp; pricing</h1>
      <p className="mt-1 text-sm text-chalk-muted">Create and maintain class packages. Minimum package size is 25 classes.</p>
    </div>
    <div className="flex-1 overflow-auto px-8 py-7">
      {error && <div role="alert" className="mb-5 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-4 text-sm text-brand-red">{error}</div>}
      <form onSubmit={save} className="mb-8 rounded-xl border border-chalk-faint bg-panel-2 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl">{editing ? "Edit package" : "Create package"}</h2>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }} className="text-sm text-chalk-muted">Cancel</button>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input required aria-label="Package name" value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="Package name" className={inputClass} />
          <input aria-label="Description" value={form.description} onChange={(e) => change("description", e.target.value)} placeholder="Description" className={inputClass} />
          <input required min="25" type="number" aria-label="Classes" value={form.class_count} onChange={(e) => change("class_count", e.target.value)} placeholder="Classes" className={inputClass} />
          <input required min="0" step="0.01" type="number" aria-label="Price" value={form.price} onChange={(e) => change("price", e.target.value)} placeholder="Price" className={inputClass} />
          <select aria-label="Currency" value={form.currency} onChange={(e) => change("currency", e.target.value)} className={inputClass}><option>INR</option><option>USD</option></select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_custom} onChange={(e) => change("is_custom", e.target.checked)} /> Custom package</label>
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span>Subjects (optional; leave unselected for unrestricted existing packages)</span>
            <select aria-label="Subjects" multiple value={form.subject_ids.map(String)} onChange={(e) => change("subject_ids", [...e.target.selectedOptions].map((option) => Number(option.value)))} className={`${inputClass} min-h-28`}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <span className="text-xs text-chalk-muted">Use Ctrl or Command to select multiple subjects.</span>
          </label>
        </div>
        <button disabled={busy} className="mt-5 rounded-lg bg-brand-red px-5 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Create package"}</button>
      </form>
      {loading ? <p className="text-sm text-chalk-muted">Loading packages…</p> : <div className="overflow-x-auto rounded-xl border border-chalk-faint bg-panel-2">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-chalk-faint text-chalk-muted"><tr><th className="px-5 py-3">Package</th><th className="px-5 py-3">Classes</th><th className="px-5 py-3">Price</th><th className="px-5 py-3">Subjects</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Actions</th></tr></thead>
          <tbody>{items.map((packagePlan) => <tr key={packagePlan.id} className="border-b border-chalk-faint last:border-0">
            <td className="px-5 py-4"><div className="font-medium">{packagePlan.name}</div><div className="text-xs text-chalk-muted">{packagePlan.description || "—"}</div></td>
            <td className="px-5 py-4">{packagePlan.class_count}</td>
            <td className="px-5 py-4">{packagePlan.currency} {Number(packagePlan.price).toLocaleString()}</td>
            <td className="px-5 py-4">{packagePlan.subjects?.length ? packagePlan.subjects.map((subject) => subject.name).join(", ") : "All subjects / unassigned"}</td>
            <td className="px-5 py-4">{packagePlan.is_active ? "Active" : "Disabled"}</td>
            <td className="px-5 py-4"><div className="flex gap-3"><button onClick={() => edit(packagePlan)} className="text-brand-red">Edit</button>{packagePlan.is_active && <button disabled={busy} onClick={() => disable(packagePlan.id)} className="text-chalk-muted">Disable</button>}</div></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </DashboardLayout>;
}
