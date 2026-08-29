import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPackages } from "../../api/packages";

export default function PackageCheckout() {
  const [params] = useSearchParams(); const [pkg,setPkg]=useState(null); const [loading,setLoading]=useState(true); const currency=params.get("currency")||"INR"; const id=params.get("package");
  useEffect(()=>{getPackages().then(xs=>setPkg(xs.find(x=>String(x.id)===id&&x.is_active&&x.currency===currency)||null)).finally(()=>setLoading(false));},[id,currency]);
  if(loading)return <Page><p className="text-chalk-muted">Loading checkout…</p></Page>;
  if(!pkg)return <Page><h1 className="text-2xl font-semibold">Package not found</h1><Link className="mt-5 inline-block text-brand-red" to="/packages">Back to packages</Link></Page>;
  const total=Number(pkg.price)*pkg.class_count;
  return <Page><div className="max-w-xl mx-auto"><Link to="/packages" className="text-sm text-chalk-muted">← Packages</Link><h1 className="mt-4 text-3xl font-semibold">Checkout</h1><div className="mt-7 rounded-2xl border border-chalk-faint bg-panel p-6"><div className="flex justify-between gap-5"><div><h2 className="font-semibold">{pkg.name}</h2><p className="mt-1 text-sm text-chalk-muted">{pkg.class_count} classes</p></div><div className="text-right"><p className="text-sm text-chalk-muted">{currency} / class</p><p className="text-xl font-semibold">{currency==='INR'?'₹':'$'}{Number(pkg.price).toFixed(2)}</p></div></div><div className="my-6 border-t border-chalk-faint"/><div className="flex justify-between"><span className="text-chalk-muted">Package total</span><strong>{currency==='INR'?'₹':'$'}{total.toFixed(2)}</strong></div><Link to={`/login?next=/checkout/package?package=${pkg.id}&currency=${currency}`} className="mt-6 block text-center rounded-xl bg-brand-red px-4 py-3 font-semibold">Continue to payment</Link></div></div></Page>;
}
function Page({children}){return <div className="min-h-screen bg-void text-chalk px-6 py-10">{children}</div>}
