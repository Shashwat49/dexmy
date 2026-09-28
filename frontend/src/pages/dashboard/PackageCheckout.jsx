import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getPackages } from "../../api/packages";
import { createPackageCheckout, verifyRazorpayPackagePayment } from "../../api/packagePayments";
import { getLinkedStudents } from "../../api/parents";
import { useAuth } from "../../context/AuthContext";

const loadScript = (src, id) => new Promise((resolve) => {
  if (id && document.getElementById(id)) return resolve(true);
  const script = document.createElement("script");
  if (id) script.id = id;
  script.src = src;
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

export default function PackageCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const stripeMountRef = useRef(null);
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);

  const [pkg, setPkg] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);

  const currency = (params.get("currency") || "INR").toUpperCase();
  const id = params.get("package");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const packages = await getPackages();
        if (!cancelled) setPkg(packages.find((x) => String(x.id) === id && String(x.currency).toUpperCase() === currency) || null);
        if (user?.role === "parent") {
          const linked = await getLinkedStudents();
          if (!cancelled) {
            setChildren(linked || []);
            if (linked?.length === 1) setSelectedStudentId(String(linked[0].id));
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load checkout details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, currency, user?.role]);

  useEffect(() => () => {
    if (elementsRef.current) {
      try { elementsRef.current.getElement("payment")?.destroy(); } catch {}
    }
  }, []);

  const resolveStudentId = () => {
    if (user?.role === "student") return user.id;
    if (user?.role === "parent") return selectedStudentId || null;
    return null;
  };

  const beginRazorpay = async (studentId) => {
    const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js", "razorpay-checkout-sdk");
    if (!loaded) throw new Error("Razorpay SDK failed to load. Please check your connection.");

    const checkoutData = await createPackageCheckout({
      package_plan_id: pkg.id,
      provider: "razorpay",
      idempotency_key: crypto.randomUUID(),
      student_id: studentId,
    });

    const options = {
      key: checkoutData.razorpay_key_id,
      amount: checkoutData.razorpay_amount,
      currency: checkoutData.currency,
      name: "Dexmy",
      description: `Payment for ${pkg.name}`,
      order_id: checkoutData.razorpay_order_id,
      handler: async (response) => {
        try {
          const result = await verifyRazorpayPackagePayment({
            payment_id: checkoutData.payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (result.status === "confirmed" || result.status === "already_confirmed") setSuccess(true);
          else setError("Payment verification failed on the server.");
        } catch (err) {
          setError(err?.response?.data?.detail || "Payment verification failed.");
        } finally {
          setProcessing(false);
        }
      },
      prefill: {
        name: user.full_name || "",
        email: user.email || "",
        contact: user.phone || "",
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.on("payment.failed", (response) => {
      setError(response?.error?.description || "Payment failed.");
      setProcessing(false);
    });
    paymentObject.on("modal.closed", () => setProcessing(false));
    paymentObject.open();
  };

  const beginStripe = async (studentId) => {
    const loaded = await loadScript("https://js.stripe.com/v3/", "stripe-js-sdk");
    if (!loaded) throw new Error("Stripe SDK failed to load. Please check your connection.");
    if (!window.Stripe) throw new Error("Stripe SDK is unavailable.");

    const checkoutData = await createPackageCheckout({
      package_plan_id: pkg.id,
      provider: "stripe",
      idempotency_key: crypto.randomUUID(),
      student_id: studentId,
    });

    if (!checkoutData.stripe_client_secret || !checkoutData.stripe_publishable_key) {
      throw new Error("Stripe checkout could not be initialized.");
    }

    const stripe = window.Stripe(checkoutData.stripe_publishable_key);
    const elements = stripe.elements({
      clientSecret: checkoutData.stripe_client_secret,
      appearance: { theme: "night" },
    });
    const paymentElement = elements.create("payment");
    if (!stripeMountRef.current) throw new Error("Stripe payment form could not be mounted.");
    stripeMountRef.current.innerHTML = "";
    paymentElement.mount(stripeMountRef.current);

    stripeRef.current = stripe;
    elementsRef.current = elements;
    setStripeReady(true);
    setProcessing(false);
  };

  const confirmStripe = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setProcessing(true);
    setError("");
    const { error: stripeError, paymentIntent } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message || "Stripe payment failed.");
      setProcessing(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      setSuccess(true);
    } else if (paymentIntent?.status === "processing") {
      setError("Payment submitted. Stripe is still confirming the payment; your package will be activated after confirmation.");
    } else {
      setError("Stripe payment is not yet confirmed. Please check your payment status.");
    }
    setProcessing(false);
  };

  const handlePayment = async () => {
    if (!user) {
      navigate(`/login?next=/checkout/package?package=${pkg.id}&currency=${currency}`);
      return;
    }
    const studentId = resolveStudentId();
    if (!studentId) {
      setError("Select a child before continuing.");
      return;
    }

    setProcessing(true);
    setError("");
    try {
      if (currency === "USD") await beginStripe(studentId);
      else await beginRazorpay(studentId);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Failed to initiate checkout.");
      setProcessing(false);
    }
  };

  if (loading) return <Page><p className="text-chalk-muted">Loading checkout…</p></Page>;
  if (!pkg) return <Page><h1 className="text-2xl font-semibold">Package not found</h1><Link className="mt-5 inline-block text-brand-red" to="/packages">Back to packages</Link></Page>;

  if (success) {
    const recipient = user?.role === "parent" ? children.find((c) => String(c.id) === String(selectedStudentId))?.full_name : user?.full_name;
    return (
      <Page>
        <div className="max-w-xl mx-auto text-center mt-20">
          <div className="mx-auto w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-3xl font-semibold">Payment Successful!</h1>
          <p className="mt-4 text-chalk-muted">The {pkg.class_count}-class package has been activated for {recipient || "the student"}.</p>
          <Link to="/dashboard" className="mt-8 inline-block rounded-xl bg-panel border border-chalk-faint px-6 py-3 font-semibold">Go to Dashboard</Link>
        </div>
      </Page>
    );
  }

  const total = Number(pkg.price);
  const isParent = user?.role === "parent";
  const isStripe = currency === "USD";

  return (
    <Page>
      <div className="max-w-xl mx-auto">
        <Link to="/packages" className="text-sm text-chalk-muted">← Packages</Link>
        <h1 className="mt-4 text-3xl font-semibold">Checkout</h1>
        {error && <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">{error}</div>}

        {isParent && (
          <div className="mt-6 rounded-2xl border border-chalk-faint bg-panel p-5">
            <label className="block text-sm font-semibold">Purchase package for</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="mt-3 w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-3 text-sm text-chalk"
              disabled={processing || stripeReady}
            >
              <option value="">Select a linked child</option>
              {children.map((child) => <option key={child.id} value={child.id}>{child.full_name} — {child.email}</option>)}
            </select>
            {children.length === 0 && <p className="mt-2 text-sm text-chalk-muted">No linked children found. Link a child from your parent dashboard first.</p>}
          </div>
        )}

        <div className="mt-7 rounded-2xl border border-chalk-faint bg-panel p-6">
          <div className="flex justify-between gap-5">
            <div><h2 className="font-semibold">{pkg.name}</h2><p className="mt-1 text-sm text-chalk-muted">{pkg.class_count} classes</p></div>
            <div className="text-right"><p className="text-xl font-semibold">{currency === "INR" ? "₹" : "$"}{total.toFixed(2)}</p></div>
          </div>
          <div className="my-6 border-t border-chalk-faint" />
          <div className="flex justify-between"><span className="text-chalk-muted">Package total</span><strong>{currency === "INR" ? "₹" : "$"}{total.toFixed(2)}</strong></div>

          {isStripe && stripeReady ? (
            <>
              <div ref={stripeMountRef} className="mt-6 rounded-xl border border-chalk-faint bg-panel-2 p-4" />
              <button onClick={confirmStripe} disabled={processing} className="mt-5 w-full rounded-xl bg-brand-red px-4 py-3 font-semibold disabled:opacity-50">
                {processing ? "Processing..." : "Pay securely with Stripe"}
              </button>
            </>
          ) : (
            <button onClick={handlePayment} disabled={processing || (isParent && !selectedStudentId)} className="mt-6 w-full rounded-xl bg-brand-red px-4 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              {processing ? "Processing..." : user ? (isStripe ? "Continue to secure payment" : "Continue to payment") : "Login to continue"}
            </button>
          )}
        </div>
      </div>
    </Page>
  );
}

function Page({ children }) {
  return <div className="min-h-screen bg-void text-chalk px-6 py-10">{children}</div>;
}
