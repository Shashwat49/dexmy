export default function Contact() {
  return (
    <section
      id="contact"
      className="relative z-[3] py-24 px-6 md:px-12 bg-panel-2 border-t border-chalk-faint"
    >
      <div className="max-w-6xl mx-auto">

        {/* Section heading */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="text-sm font-semibold tracking-[2px] uppercase text-brand-gold mb-4">
            Contact Us
          </p>

          <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-tight">
            Let's talk about{" "}
            <span className="text-brand-red">learning.</span>
          </h2>

          <p className="text-chalk-muted text-base md:text-lg leading-relaxed mt-6">
            Have a question about Dexmy, our classes, or becoming a tutor?
            We'd love to hear from you.
          </p>
        </div>

        {/* Main contact area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left side */}
          <div className="bg-panel border border-chalk-faint rounded-2xl p-8 md:p-10">

            <p className="text-brand-gold text-sm font-semibold uppercase tracking-[1.5px] mb-5">
              Get in touch
            </p>

            <h3 className="font-display text-3xl md:text-4xl leading-tight mb-6">
              We're here to help.
            </h3>

            <p className="text-chalk-muted leading-relaxed mb-8">
              Whether you're a student looking for academic support, a parent
              exploring learning options, a tutor interested in joining Dexmy,
              or looking to work with us, feel free to reach out.
            </p>

            <div className="space-y-6">

              {/* Email */}
              <a
                href="mailto:dexmyedu@gmail.com"
                className="flex items-center gap-4 group"
              >
                <div className="w-11 h-11 shrink-0 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-colors">
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-chalk-faint mb-1">
                    General enquiries
                  </p>

                  <p className="text-chalk group-hover:text-brand-gold transition-colors">
                    dexmyedu@gmail.com
                  </p>
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href="https://wa.me/918929839177"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-4 group"
              >
                <div className="w-11 h-11 shrink-0 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center group-hover:bg-brand-red group-hover:text-white transition-colors">
                  <svg
                    width="21"
                    height="21"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  >
                    <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
                    <path d="M8.5 9.5c.3 1.4 1.7 3.1 3.2 3.8.7.3 1.2.4 1.6-.1l.6-.8" />
                  </svg>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-chalk-faint mb-1">
                    WhatsApp
                  </p>

                  <p className="text-chalk group-hover:text-brand-gold transition-colors">
                    Chat with us
                  </p>
                </div>
              </a>

            </div>

            {/* Small note */}
            <div className="mt-10 pt-6 border-t border-chalk-faint">
              <p className="text-sm text-chalk-muted leading-relaxed">
                For general questions, student and parent enquiries, tutor
                applications, partnerships, and other requests, you can reach
                us through the same email address.
              </p>
            </div>

          </div>

          {/* Right side - Contact form */}
          <div className="bg-panel border border-chalk-faint rounded-2xl p-8 md:p-10">

            <p className="text-brand-gold text-sm font-semibold uppercase tracking-[1.5px] mb-5">
              Send a message
            </p>

            <h3 className="font-display text-2xl md:text-3xl mb-7">
              How can we help?
            </h3>

            <form className="space-y-5">

              {/* Name */}
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-sm font-medium text-chalk mb-2"
                >
                  Full name
                </label>

                <input
                  id="contact-name"
                  type="text"
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-sm font-medium text-chalk mb-2"
                >
                  Email address
                </label>

                <input
                  id="contact-email"
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors"
                />
              </div>

              {/* Enquiry type */}
              <div>
                <label
                  htmlFor="contact-type"
                  className="block text-sm font-medium text-chalk mb-2"
                >
                  I am a
                </label>

                <select
                  id="contact-type"
                  defaultValue=""
                  className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk outline-none focus:border-brand-red transition-colors"
                >
                  <option value="" disabled>
                    Select an option
                  </option>

                  <option value="student">
                    Student
                  </option>

                  <option value="parent">
                    Parent
                  </option>

                  <option value="tutor">
                    Tutor
                  </option>

                  <option value="school">
                    School / Institution
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium text-chalk mb-2"
                >
                  Message
                </label>

                <textarea
                  id="contact-message"
                  rows="5"
                  placeholder="Tell us how we can help..."
                  className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-lg bg-brand-red text-white font-semibold hover:opacity-90 transition-opacity"
              >
                Send message
              </button>

            </form>

          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-chalk-muted text-sm">
            Prefer a quick conversation?
          </p>

          <a
            href="https://wa.me/918929839177"
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-brand-gold hover:underline font-medium"
          >
            Chat with us on WhatsApp →
          </a>
        </div>

      </div>
    </section>
  );
}