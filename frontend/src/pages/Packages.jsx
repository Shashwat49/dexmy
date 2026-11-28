import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getPackages } from "../api/packages";
import { getSubjects } from "../api/subjects";
import { getPackagesForSelection } from "../utils/packageSelection";


export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => new URLSearchParams(window.location.search).get("subject") || "");
  const [currency, setCurrency] = useState(() => {
    const requestedCurrency = new URLSearchParams(window.location.search).get("currency");
    return ["INR", "USD"].includes(requestedCurrency) ? requestedCurrency : "";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const searchParams = new URLSearchParams(window.location.search);
  const freeClassLimitReached = searchParams.get("reason") === "free-class-limit";
  const subjectPackageRequired = searchParams.get("reason") === "subject-package-required";

  useEffect(() => {
    let mounted = true;
    Promise.all([getSubjects(), getPackages()])
      .then(([subjectData, packageData]) => {
        if (!mounted) return;
        setSubjects(Array.isArray(subjectData) ? subjectData : []);
        setPackages(Array.isArray(packageData) ? packageData : []);
      })
      .catch(() => { if (mounted) setError("Unable to load subjects or verify current package pricing. Please refresh to try again."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const selectedSubject = subjects.find((subject) => String(subject.id) === selectedSubjectId);
  const visible = useMemo(
    () => getPackagesForSelection(packages, selectedSubjectId, currency),
    [packages, selectedSubjectId, currency],
  );

  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO title="Packages | Dexmy" description="Explore Dexmy tutoring class packages and per-class pricing." path="/packages" />
      <header className="border-b border-chalk-faint px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/" aria-label="Dexmy home" className="inline-flex shrink-0 items-center"><img src="/dexmy-logo-bg-removed.png" alt="Dexmy" className="h-9 w-auto object-contain sm:h-10" /></Link>
          <Link to="/dashboard" className="inline-flex items-center rounded-xl border border-chalk-faint bg-panel px-4 py-2.5 text-sm font-semibold text-chalk-muted transition-colors hover:border-brand-gold hover:text-chalk">Back to Dashboard</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">Explore Packages</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">Choose your learning package</h1>
          <p className="mt-4 text-chalk-muted">Start with a subject, then choose the currency you want to pay in.</p>
        </div>

        {freeClassLimitReached && <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-6 py-5 text-center"><p className="font-semibold text-brand-gold">You’ve exhausted your 2 free classes.</p><p className="mt-1 text-sm leading-6 text-chalk-muted">Choose a package below to continue booking classes.</p></div>}
        {subjectPackageRequired && <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-6 py-5 text-center"><p className="font-semibold text-brand-gold">Choose a package for this subject.</p><p className="mt-1 text-sm leading-6 text-chalk-muted">Your current active packages do not include this subject, or have no remaining credits. Select a package below to continue.</p></div>}
        {error && <div role="alert" className="mx-auto mt-8 max-w-3xl rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-center text-sm text-red-300">{error}</div>}

        <section aria-labelledby="subject-heading" className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="subject-heading" className="text-lg font-semibold"><span className="mr-2 text-brand-gold">1</span>Choose a subject or course</h2>
            {selectedSubject && <button type="button" onClick={() => { setSelectedSubjectId(""); setCurrency(""); }} className="text-sm font-semibold text-brand-gold underline underline-offset-4">Edit subject</button>}
          </div>
          {loading ? <p className="rounded-xl border border-chalk-faint bg-panel p-5 text-sm text-chalk-muted" role="status">Loading subjects and packages…</p>
            : subjects.length === 0 ? <p className="rounded-xl border border-chalk-faint bg-panel p-5 text-sm text-chalk-muted">No subjects are currently available. Please check back later.</p>
              : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{subjects.map((subject) => {
                const selected = selectedSubjectId === String(subject.id);
                return <button key={subject.id} type="button" aria-pressed={selected} onClick={() => { setSelectedSubjectId(String(subject.id)); setCurrency(""); }} className={`min-h-20 rounded-xl border p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold ${selected ? "border-brand-gold bg-brand-gold/10" : "border-chalk-faint bg-panel hover:border-chalk-muted"}`}>
                  <span className="font-semibold">{subject.name}</span>{subject.description && <span className="mt-2 block text-sm leading-5 text-chalk-muted">{subject.description}</span>}
                </button>;
              })}</div>}
        </section>

        {selectedSubject && <section aria-labelledby="currency-heading" className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="currency-heading" className="text-lg font-semibold"><span className="mr-2 text-brand-gold">2</span>Choose currency</h2>
            <button type="button" onClick={() => setCurrency("")} className="text-sm font-semibold text-brand-gold underline underline-offset-4">Edit currency</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ code: "INR", label: "INR · Indian rupee", symbol: "₹" }, { code: "USD", label: "USD · US dollar", symbol: "$" }].map((option) => <button key={option.code} type="button" aria-pressed={currency === option.code} onClick={() => setCurrency(option.code)} className={`rounded-xl border px-5 py-4 text-left font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-gold ${currency === option.code ? "border-brand-gold bg-brand-gold/10" : "border-chalk-faint bg-panel hover:border-chalk-muted"}`}><span aria-hidden="true" className="mr-3 text-brand-gold">{option.symbol}</span>{option.label}</button>)}
          </div>
        </section>}

        {selectedSubject && currency && <section aria-labelledby="plans-heading" className="mt-10">
          <div className="mb-5"><p className="text-sm text-chalk-muted">{selectedSubject.name} · {currency}</p><h2 id="plans-heading" className="mt-1 text-2xl font-semibold">Available packages</h2></div>
          {visible.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} currency={currency} subjectId={selectedSubjectId} />)}</div>
            : <p className="rounded-xl border border-chalk-faint bg-panel p-6 text-sm leading-6 text-chalk-muted">There are no active packages for {selectedSubject.name} in {currency} yet. Choose another currency or subject, or check back later.</p>}
          {visible.length > 0 && <p className="mt-8 text-center text-xs text-chalk-muted">Prices are per class. Your package total is calculated at checkout. Unassigned legacy plans remain available until administrators assign subjects.</p>}
        </section>}
      </main>
    </div>
  );
}

function PackageCard({ pkg, currency, subjectId }) {
  const price = Number(pkg.price);
  const custom = pkg.is_custom || !pkg.class_count;
  return <article className="flex flex-col rounded-2xl border border-chalk-faint bg-panel p-6">
    <div className="text-sm text-chalk-muted">{custom ? `Custom plan · ${pkg.class_count} classes` : `${pkg.class_count} live classes`}</div>
    <h3 className="mt-2 text-xl font-semibold">{pkg.name}</h3>
    <div className="mt-7"><span className="text-4xl font-semibold">{currency === "INR" ? "₹" : "$"}{price.toFixed(2).replace(/\.00$/, "")}</span><span className="ml-2 text-sm text-chalk-muted">/ class</span></div>
    <p className="mt-3 text-sm text-chalk-muted">{custom ? `Currently configured for ${pkg.class_count} classes.` : `${pkg.class_count} classes at ${currency === "INR" ? "₹" : "$"}${(price * pkg.class_count).toFixed(2).replace(/\.00$/, "")} total.`}</p>
    <Link to={`/checkout/package?package=${encodeURIComponent(pkg.id)}&currency=${currency}&subject=${encodeURIComponent(subjectId)}`} className="mt-7 inline-flex justify-center rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold">Choose package</Link>
  </article>;
}
