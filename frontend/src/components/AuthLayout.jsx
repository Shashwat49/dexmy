import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-void px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="font-display text-3xl text-brand-red -skew-x-6 inline-block">
            Dexmy
          </span>
        </Link>
        <div className="bg-panel border border-chalk-faint rounded-2xl p-8">
          <h1 className="font-display text-2xl mb-1">{title}</h1>
          {subtitle && <p className="text-chalk-muted text-sm mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
