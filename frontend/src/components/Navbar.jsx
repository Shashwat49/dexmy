import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "911234567890"; // TODO: replace with the real business number

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 bg-void/85 backdrop-blur-md border-b border-chalk-faint">
      <Link to="/" className="font-display text-2xl text-brand-red -skew-x-6 inline-block">
        Dexmy
      </Link>

      <ul className="hidden md:flex gap-10 list-none">
        {["Home", "About us", "Live sessions", "Contact"].map((label) => (
          <li key={label}>
            <a
              href="#"
              className="text-chalk-muted text-sm font-medium hover:text-chalk transition-colors relative group"
            >
              {label}
              <span className="absolute left-0 -bottom-1.5 w-0 h-0.5 bg-brand-gold transition-all duration-200 group-hover:w-full" />
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:flex items-center gap-2 bg-panel-3 border border-chalk-faint hover:border-[#25D366] hover:text-[#25D366] transition-colors text-sm font-semibold px-4 py-2.5 rounded-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 004.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 012.41 5.82c0 4.55-3.7 8.25-8.24 8.25a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25M8.53 6.85c-.16 0-.43.06-.66.31s-.87.86-.87 2.08.9 2.4 1.02 2.57c.12.16 1.75 2.8 4.35 3.83 2.15.85 2.59.68 3.06.64.47-.04 1.5-.61 1.72-1.2s.22-1.09.15-1.2c-.07-.1-.24-.16-.5-.28s-1.5-.74-1.74-.82c-.23-.08-.4-.13-.58.13s-.68.82-.83 1c-.15.16-.31.18-.57.06-.27-.13-1.12-.41-2.14-1.32-.79-.7-1.32-1.57-1.48-1.83-.15-.26-.02-.41.12-.53.12-.12.27-.31.4-.47.14-.15.18-.26.27-.44.09-.18.05-.33-.02-.46-.07-.13-.58-1.45-.82-1.98-.2-.47-.42-.44-.58-.45-.15-.01-.32-.01-.5-.01" />
          </svg>
          <span className="hidden lg:inline">WhatsApp</span>
        </a>
        <a
          href="#"
          className="hidden sm:inline-block border border-chalk-muted hover:border-brand-gold hover:text-brand-gold transition-colors text-sm font-semibold px-4 py-2.5 rounded-md"
        >
          Become a tutor
        </a>
        <Link
          to="/login"
          className="bg-brand-red hover:bg-brand-red-dark transition-colors text-sm font-semibold px-4 py-2.5 rounded-md"
        >
          Login / Signup
        </Link>
      </div>
    </nav>
  );
}
