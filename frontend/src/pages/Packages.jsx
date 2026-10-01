import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getPackages } from "../api/packages";

const DEFAULTS = [
  { class_count: 25, name: "25 Classes Package", inr: 2000, usd: 20 },
  { class_count: 50, name: "50 Classes Package", inr: 1950, usd: 19.5 },
  { class_count: 75, name: "75 Classes Package", inr: 1900, usd: 19 },
  { class_count: 100, name: "100 Classes Package", inr: 1850, usd: 18.5 },
  { class_count: 0, name: "Customize Your Package", inr: 2000, usd: 20, is_custom: true },
];

const CACHE_KEY = "dexmy_packages_cache";

function getCachedPackages() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export default function Packages() {
  const [packages, setPackages] = useState(getCachedPackages);
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState("");
  const freeClassLimitReached =
    new URLSearchParams(window.location.search).get("reason") ===
    "free-class-limit";

  useEffect(() => {
    let mounted = true;

    // Refresh pricing in the background. The page already has cached/default
    // data, so the API request never blocks the first paint.
    getPackages()
      .then((data) => {
        if (!mounted || !Array.isArray(data)) return;
        setPackages(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch {
          // Ignore storage failures; the page still works normally.
        }
      })
      .catch(() => {
        if (mounted && !packages.length) {
          setError("Unable to refresh packages right now. Showing default pricing.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const visible = useMemo(() => {
    const active = packages.filter((p) => p.is_active && p.currency === currency);
    if (active.length) return active;
    return DEFAULTS.map((p) => ({
      ...p,
      currency,
      price: currency === "INR" ? p.inr : p.usd,
    }));
  }, [packages, currency]);

  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO title="Packages | Dexmy" description="Explore Dexmy tutoring class packages and per-class pricing." path="/packages" />
      <header className="border-b border-chalk-faint px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/" aria-label="Dexmy home" className="inline-flex items-center shrink-0">
            <img src="/dexmy-logo-bg-removed.png" alt="Dexmy" className="h-9 sm:h-10 w-auto object-contain" />
          </Link>
          <Link to="/" className="inline-flex items-center rounded-xl border border-chalk-faint bg-panel px-4 py-2.5 text-sm font-semibold text-chalk-muted hover:text-chalk hover:border-brand-gold transition-colors">
            Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">Explore Packages</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold">Choose your learning package</h1>
          <p className="mt-4 text-chalk-muted">Simple per-class pricing. Pick the package that fits your learning goals.</p>
          <div className="mt-7 inline-flex rounded-xl border border-chalk-faint bg-panel p-1">
            <button onClick={() => setCurrency("INR")} className={`px-5 py-2 rounded-lg text-sm font-semibold ${currency === "INR" ? "bg-brand-red text-white" : "text-chalk-muted"}`}>INR ₹</button>
            <button onClick={() => setCurrency("USD")} className={`px-5 py-2 rounded-lg text-sm font-semibold ${currency === "USD" ? "bg-brand-red text-white" : "text-chalk-muted"}`}>USD $</button>
          </div>
        </div>

        {freeClassLimitReached && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-gold/40 bg-brand-gold/10 px-6 py-5 text-center">
            <p className="text-base font-semibold text-brand-gold">
              You’ve exhausted your 2 free classes.
            </p>
            <p className="mt-1 text-sm leading-6 text-chalk-muted">
              You’ve used all 2 free classes available with your Dexmy account. Please choose a package below to continue booking classes.
            </p>
          </div>
        )}

        {error && <p className="mt-8 text-center text-sm text-chalk-muted">{error}</p>}

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => <PackageCard key={`${p.name}-${p.currency}`} pkg={p} currency={currency} />)}
        </div>

        <p className="mt-10 text-center text-xs text-chalk-muted">The price shown is per class. Your selected package total is calculated at checkout.</p>
      </main>
    </div>
  );
}

function PackageCard({ pkg, currency }) {
  const price = Number(pkg.price ?? (currency === "INR" ? pkg.inr : pkg.usd));
  const custom = pkg.is_custom || !pkg.class_count;

  return (
    <article className="rounded-2xl border border-chalk-faint bg-panel p-6 flex flex-col">
      <div className="text-sm text-chalk-muted">{custom ? "Flexible" : `${pkg.class_count} live classes`}</div>
      <h2 className="mt-2 text-xl font-semibold">{pkg.name}</h2>
      <div className="mt-7">
        <span className="text-4xl font-semibold">{currency === "INR" ? "₹" : "$"}{price.toFixed(2).replace(/\.00$/, "")}</span>
        <span className="ml-2 text-sm text-chalk-muted">/ class</span>
      </div>
      <p className="mt-3 text-sm text-chalk-muted">{custom ? "Build a package around your required number of classes." : `${pkg.class_count} classes at ${currency === "INR" ? "₹" : "$"}${(price * pkg.class_count).toFixed(2).replace(/\.00$/, "")} total.`}</p>
      <Link to={`/checkout/package?package=${pkg.id || "custom"}&currency=${currency}`} className="mt-7 inline-flex justify-center rounded-xl bg-brand-red px-4 py-3 text-sm font-semibold">Choose package</Link>
    </article>
  );
}
