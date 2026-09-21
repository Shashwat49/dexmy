import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPackages } from "../../api/packages";
import { createPackageCheckout, verifyRazorpayPackagePayment } from "../../api/packagePayments";
import { useAuth } from "../../context/AuthContext";

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PackageCheckout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const currency = params.get("currency") || "INR";
  const id = params.get("package");

  useEffect(() => {
    getPackages()
      .then((xs) => setPkg(xs.find((x) => String(x.id) === id && x.is_active && x.currency === currency) || null))
      .catch(() => setError("Failed to load package details."))
      .finally(() => setLoading(false));
  }, [id, currency]);

  const handlePayment = async () => {
    if (!user) {
      navigate(`/login?next=/checkout/package?package=${pkg.id}&currency=${currency}`);
      return;
    }

    setProcessing(true);
    setError(null);

    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      setError("Razorpay SDK failed to load. Are you online?");
      setProcessing(false);
      return;
    }

    try {
      const idempotencyKey = crypto.randomUUID();
      const checkoutData = await createPackageCheckout({
        package_plan_id: pkg.id,
        provider: "razorpay",
        idempotency_key: idempotencyKey,
        student_id: user.role === "student" ? user.id : undefined, // If parent, logic might need selection, assuming student for now or backend handles it.
      });

      if (checkoutData.status === "paid") {
          setSuccess(true);
          setProcessing(false);
          return;
      }

      const options = {
        key: checkoutData.razorpay_key_id,
        amount: checkoutData.razorpay_amount,
        currency: checkoutData.currency,
        name: "Dexmy",
        description: `Payment for ${pkg.name}`,
        order_id: checkoutData.razorpay_order_id,
        handler: async (response) => {
          try {
            setProcessing(true);
            const verifyResult = await verifyRazorpayPackagePayment({
              payment_id: checkoutData.payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            
            if (verifyResult.status === "confirmed" || verifyResult.status === "already_confirmed") {
              setSuccess(true);
            } else {
              setError("Payment verification failed on the server.");
            }
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
        theme: {
          color: "#E53E3E", // brand-red equivalent
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on("payment.failed", (response) => {
        setError(response.error.description || "Payment failed.");
        setProcessing(false);
      });
      paymentObject.open();
    } catch (err) {
      if (err?.response?.status === 409) {
          setError(err.response.data.detail || "Payment already processed.");
      } else {
          setError(err?.response?.data?.detail || "Failed to initiate checkout.");
      }
      setProcessing(false);
    }
  };

  if (loading) return <Page><p className="text-chalk-muted">Loading checkout…</p></Page>;
  if (!pkg) return <Page><h1 className="text-2xl font-semibold">Package not found</h1><Link className="mt-5 inline-block text-brand-red" to="/packages">Back to packages</Link></Page>;
  
  if (success) {
    return (
      <Page>
        <div className="max-w-xl mx-auto text-center mt-20">
          <div className="mx-auto w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold">Payment Successful!</h1>
          <p className="mt-4 text-chalk-muted">Your package has been activated. {pkg.class_count} classes have been credited to your account.</p>
          <Link to="/dashboard" className="mt-8 inline-block rounded-xl bg-panel border border-chalk-faint px-6 py-3 font-semibold">Go to Dashboard</Link>
        </div>
      </Page>
    );
  }

  const total = Number(pkg.price);

  return (
    <Page>
      <div className="max-w-xl mx-auto">
        <Link to="/packages" className="text-sm text-chalk-muted">← Packages</Link>
        <h1 className="mt-4 text-3xl font-semibold">Checkout</h1>
        
        {error && (
          <div className="mt-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 text-sm">
            {error}
          </div>
        )}
        
        <div className="mt-7 rounded-2xl border border-chalk-faint bg-panel p-6">
          <div className="flex justify-between gap-5">
            <div>
              <h2 className="font-semibold">{pkg.name}</h2>
              <p className="mt-1 text-sm text-chalk-muted">{pkg.class_count} classes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">{currency === 'INR' ? '₹' : '$'}{total.toFixed(2)}</p>
            </div>
          </div>
          <div className="my-6 border-t border-chalk-faint"/>
          <div className="flex justify-between">
            <span className="text-chalk-muted">Package total</span>
            <strong>{currency === 'INR' ? '₹' : '$'}{total.toFixed(2)}</strong>
          </div>
          
          <button 
            onClick={handlePayment} 
            disabled={processing}
            className="mt-6 w-full block text-center rounded-xl bg-brand-red px-4 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? "Processing..." : user ? "Continue to payment" : "Login to continue"}
          </button>
        </div>
      </div>
    </Page>
  );
}

function Page({children}) {
  return <div className="min-h-screen bg-void text-chalk px-6 py-10">{children}</div>;
}
