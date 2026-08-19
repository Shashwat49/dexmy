export default function Footer() {
  return (
    <footer className="relative z-[3] bg-panel border-t border-chalk-faint">
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-14">

        {/* Main footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <a
              href="/"
              className="inline-flex items-center gap-3 mb-5"
            >
              <img
                src="/dexmy-logo-bg-removed.png"
                alt="Dexmy"
                className="w-10 h-10 object-contain"
              />
            </a>

            <p className="text-chalk-muted max-w-md leading-relaxed text-sm">
              Personalised one-on-one learning designed around every
              student's goals, pace, and learning style.
            </p>

            {/* Social media */}
            <div className="flex items-center gap-3 mt-7">

              {/* Facebook */}
              <a
                href="https://www.facebook.com/profile.php?id=61593221725586"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 rounded-lg border border-chalk-faint flex items-center justify-center text-chalk-muted hover:text-chalk hover:border-brand-red hover:bg-brand-red-soft transition-all duration-200"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13.5 22v-8h2.75l.4-3h-3.15V9.08c0-.87.24-1.46 1.5-1.46h1.75V4.94c-.3-.04-1.32-.13-2.5-.13-2.47 0-4.16 1.51-4.16 4.29V11H7.3v3h2.79v8h3.41Z" />
                </svg>
              </a>

              {/* Instagram */}
              <a
                href="https://www.instagram.com/dexmy_edu"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-lg border border-chalk-faint flex items-center justify-center text-chalk-muted hover:text-chalk hover:border-brand-red hover:bg-brand-red-soft transition-all duration-200"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle
                    cx="17.5"
                    cy="6.5"
                    r="1"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/dexmyedu/"
                target="_blank"
                rel="noreferrer"
                aria-label="LinkedIn"
                className="w-10 h-10 rounded-lg border border-chalk-faint flex items-center justify-center text-chalk-muted hover:text-chalk hover:border-brand-red hover:bg-brand-red-soft transition-all duration-200"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M5.2 3.5A2.2 2.2 0 1 1 5.2 7.9a2.2 2.2 0 0 1 0-4.4ZM3.3 9.4h3.8V21H3.3V9.4Zm6.2 0h3.6V11h.05c.5-.95 1.72-1.95 3.54-1.95 3.78 0 4.48 2.49 4.48 5.73V21h-3.75v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21H9.5V9.4Z" />
                </svg>
              </a>

            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-chalk mb-5">
              Company
            </h3>

            <ul className="space-y-3">
              <li>
                <a
                  href="#about"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  About us
                </a>
              </li>

              <li>
                <a
                  href="#contact"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  Contact us
                </a>
              </li>

              <li>
                <a
                  href="/signup?role=teacher"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  Become a tutor
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-chalk mb-5">
              Support
            </h3>

            <ul className="space-y-3">
              <li>
                <a
                  href="#contact"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  Help & enquiries
                </a>
              </li>

              <li>
                <a
                  href="mailto:dexmyedu@gmail.com"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  Email us
                </a>
              </li>

              <li>
                <a
                  href="https://wa.me/918929839177"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-chalk-muted hover:text-chalk transition-colors"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Divider */}
        <div className="border-t border-chalk-faint mt-12 pt-6">

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">

            <p className="text-xs text-chalk-faint text-center md:text-left">
              © {new Date().getFullYear()} Dexmy. All rights reserved.
            </p>

            <div className="flex items-center gap-5">
              <a
                href="/privacy"
                className="text-xs text-chalk-faint hover:text-chalk transition-colors"
              >
                Privacy Policy
              </a>

              <a
                href="/terms"
                className="text-xs text-chalk-faint hover:text-chalk transition-colors"
              >
                Terms of Service
              </a>
            </div>

          </div>

        </div>

      </div>
    </footer>
  );
}