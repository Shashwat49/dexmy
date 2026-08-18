import { useState } from "react";
import { Link } from "react-router-dom";

const WHATSAPP_NUMBER = "918929839177";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-void/90 backdrop-blur-md border-b border-chalk-faint">

      {/* =========================================================
          MAIN NAVBAR
      ========================================================= */}
      <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-5">

        {/* =======================================================
            LOGO
        ======================================================= */}
        <Link
          to="/"
          onClick={closeMenu}
          className="shrink-0"
        >
          <img
            src="/dexmy-logo-bg-removed.png"
            alt="Dexmy"
            className="h-9 sm:h-10 md:h-11 w-auto"
          />
        </Link>


        {/* =======================================================
            DESKTOP NAVIGATION
            Visible only on laptop/desktop
            lg = 1024px+
        ======================================================= */}
        <ul className="hidden lg:flex items-center gap-7 xl:gap-10 list-none">

          <li>
            <a
              href="#"
              className="relative group text-chalk-muted text-sm font-medium hover:text-chalk transition-colors"
            >
              Home

              <span className="absolute left-0 -bottom-1.5 w-0 h-0.5 bg-brand-gold transition-all duration-200 group-hover:w-full" />
            </a>
          </li>

          <li>
            <a
              href="#about"
              className="relative group text-chalk-muted text-sm font-medium hover:text-chalk transition-colors"
            >
              About Us

              <span className="absolute left-0 -bottom-1.5 w-0 h-0.5 bg-brand-gold transition-all duration-200 group-hover:w-full" />
            </a>
          </li>

          <li>
            <a
              href="#contact"
              className="relative group text-chalk-muted text-sm font-medium hover:text-chalk transition-colors"
            >
              Contact Us

              <span className="absolute left-0 -bottom-1.5 w-0 h-0.5 bg-brand-gold transition-all duration-200 group-hover:w-full" />
            </a>
          </li>

        </ul>


        {/* =======================================================
            DESKTOP + TABLET ACTIONS
            Visible from 640px+
        ======================================================= */}
        <div className="hidden sm:flex items-center gap-2 md:gap-3">

          {/* =====================================================
              WHATSAPP
              Tablet + Laptop + Desktop
              Full icon + text
          ===================================================== */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="flex items-center gap-2 shrink-0 bg-panel-3 border border-chalk-faint hover:border-[#25D366] hover:text-[#25D366] transition-colors text-sm font-semibold px-3 md:px-4 py-2.5 rounded-md"
          >

            {/* WhatsApp Icon */}
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 004.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 012.41 5.82c0 4.55-3.7 8.25-8.24 8.25a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25M8.53 6.85c-.16 0-.43.06-.66.31s-.87.86-.87 2.08.9 2.4 1.02 2.57c.12.16 1.75 2.8 4.35 3.83 2.15.85 2.59.68 3.06.64.47-.04 1.5-.61 1.72-1.2s.22-1.09.15-1.2c-.07-.1-.24-.16-.5-.28s-1.5-.74-1.74-.82c-.23-.08-.4-.13-.58.13s-.68.82-.83 1c-.15.16-.31.18-.57.06-.27-.13-1.12-.41-2.14-1.32-.79-.7-1.32-1.57-1.48-1.83-.15-.26-.02-.41.12-.53.12-.12.27-.31.4-.47.14-.15.18-.26.27-.44.09-.18.05-.33-.02-.46-.07-.13-.58-1.45-.82-1.98-.2-.47-.42-.44-.58-.45-.15-.01-.32-.01-.5-.01" />
            </svg>

            <span>
              WhatsApp
            </span>

          </a>


          {/* =====================================================
              BECOME A TUTOR
              Laptop/Desktop only
          ===================================================== */}
          <a
            href="#"
            className="hidden lg:inline-flex items-center justify-center border border-chalk-muted hover:border-brand-gold hover:text-brand-gold transition-colors text-sm font-semibold px-4 py-2.5 rounded-md whitespace-nowrap"
          >
            Become a tutor
          </a>


          {/* =====================================================
              LOGIN / SIGNUP
              Tablet + Desktop
          ===================================================== */}
          <Link
            to="/login"
            className="bg-brand-red hover:bg-brand-red-dark transition-colors text-xs md:text-sm font-semibold px-3 md:px-4 py-2.5 rounded-md whitespace-nowrap"
          >
            <span className="hidden md:inline">
              Login / Signup
            </span>

            <span className="md:hidden">
              Login
            </span>
          </Link>


          {/* =====================================================
              TABLET HAMBURGER
              Tablet only
              Mobile has its own version below
          ===================================================== */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-md border border-chalk-faint bg-panel-3 text-chalk hover:border-brand-gold transition-colors"
          >

            {menuOpen ? (
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            )}

          </button>

        </div>


        {/* =======================================================
            MOBILE ACTIONS
            Below 640px
        ======================================================= */}
        <div className="flex sm:hidden items-center gap-2">

          {/* =====================================================
              MOBILE WHATSAPP ICON ONLY
          ===================================================== */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-chalk-faint bg-panel-3 text-[#25D366] hover:border-[#25D366] transition-colors"
          >

            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 004.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 012.41 5.82c0 4.55-3.7 8.25-8.24 8.25a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25M8.53 6.85c-.16 0-.43.06-.66.31s-.87.86-.87 2.08.9 2.4 1.02 2.57c.12.16 1.75 2.8 4.35 3.83 2.15.85 2.59.68 3.06.64.47-.04 1.5-.61 1.72-1.2s.22-1.09.15-1.2c-.07-.1-.24-.16-.5-.28s-1.5-.74-1.74-.82c-.23-.08-.4-.13-.58.13s-.68.82-.83 1c-.15.16-.31.18-.57.06-.27-.13-1.12-.41-2.14-1.32-.79-.7-1.32-1.57-1.48-1.83-.15-.26-.02-.41.12-.53.12-.12.27-.31.4-.47.14-.15.18-.26.27-.44.09-.18.05-.33-.02-.46-.07-.13-.58-1.45-.82-1.98-.2-.47-.42-.44-.58-.45-.15-.01-.32-.01-.5-.01" />
            </svg>

          </a>


          {/* =====================================================
              MOBILE LOGIN
          ===================================================== */}
          <Link
            to="/login"
            className="bg-brand-red hover:bg-brand-red-dark transition-colors text-xs font-semibold px-3 py-2.5 rounded-md"
          >
            Login
          </Link>


          {/* =====================================================
              MOBILE HAMBURGER
          ===================================================== */}
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-chalk-faint bg-panel-3 text-chalk hover:border-brand-gold transition-colors"
          >

            {menuOpen ? (
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            ) : (
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            )}

          </button>

        </div>

      </div>


      {/* =========================================================
          MOBILE + TABLET DROPDOWN MENU
          ========================================================= */}
      {menuOpen && (
        <div className="lg:hidden border-t border-chalk-faint bg-panel shadow-lg">

          <div className="px-4 sm:px-6 py-4">

            <div className="flex flex-col gap-1">

              {/* Home */}
              <a
                href="#"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-sm font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors"
              >
                Home
              </a>


              {/* About */}
              <a
                href="#about"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-sm font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors"
              >
                About Us
              </a>


              {/* Contact */}
              <a
                href="#contact"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-sm font-medium text-chalk-muted hover:bg-panel-2 hover:text-chalk transition-colors"
              >
                Contact Us
              </a>


              {/* Divider */}
              <div className="my-2 border-t border-chalk-faint" />


              {/* WhatsApp */}
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-[#25D366] hover:bg-panel-2 transition-colors"
              >

                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 004.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.92 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2m0 1.67c2.2 0 4.26.86 5.82 2.42a8.2 8.2 0 012.41 5.82c0 4.55-3.7 8.25-8.24 8.25a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 01-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25M8.53 6.85c-.16 0-.43.06-.66.31s-.87.86-.87 2.08.9 2.4 1.02 2.57c.12-.13 1.75 2.8 4.35 3.83 2.15.85 2.59.68 3.06.64.47-.04 1.5-.61 1.72-1.2s.22-1.09.15-1.2c-.07-.1-.24-.16-.5-.28s-1.5-.74-1.74-.82c-.23-.08-.4-.13-.58.13s-.68.82-.83 1c-.15.16-.31.18-.57.06-.27-.13-1.12-.41-2.14-1.32-.79-.7-1.32-1.57-1.48-1.83-.15-.26-.02-.41.12-.53.12-.12.27-.31.4-.47.14-.15.18-.26.27-.44.09-.18.05-.33-.02-.46-.07-.13-.58-1.45-.82-1.98-.2-.47-.42-.44-.58-.45-.15-.01-.32-.01-.5-.01" />
                </svg>

                <span>
                  WhatsApp
                </span>

              </a>


              {/* Become a tutor */}
              <a
                href="#"
                onClick={closeMenu}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-brand-gold hover:bg-panel-2 transition-colors"
              >
                Become a tutor
              </a>

            </div>

          </div>

        </div>
      )}

    </nav>
  );
}