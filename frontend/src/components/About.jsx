export default function About() {
  return (
    <section
      id="about"
      className="relative z-[3] py-24 px-6 md:px-12 bg-panel border-t border-chalk-faint"
    >
      <div className="max-w-6xl mx-auto">

        {/* Section heading */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-sm font-semibold tracking-[2px] uppercase text-brand-gold mb-4">
            About Dexmy
          </p>

          <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-tight">
            Education should feel{" "}
            <span className="text-brand-red">personal.</span>
          </h2>

          <p className="text-chalk-muted text-base md:text-lg leading-relaxed mt-6">
            Dexmy is a one-on-one learning platform built around a simple idea:
            every student learns differently. We connect students with dedicated
            tutors for focused, live classes designed around their goals, pace,
            and learning style.
          </p>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

          {/* Left card */}
          <div className="bg-panel-2 border border-chalk-faint rounded-2xl p-8 md:p-10 relative overflow-hidden">
            
            {/* Decorative element */}
            <div className="absolute -right-16 -top-16 w-40 h-40 rounded-full bg-brand-red-soft opacity-40 pointer-events-none" />

            <p className="text-brand-gold text-sm font-semibold uppercase tracking-[1.5px] mb-5">
              Why Dexmy?
            </p>

            <h3 className="font-display text-3xl md:text-4xl leading-tight mb-6">
              No crowded classrooms.
              <br />
              No one-size-fits-all teaching.
            </h3>

            <p className="text-chalk-muted leading-relaxed mb-5">
              In a traditional classroom, it can be difficult for a teacher to
              give every student the attention they need. Dexmy changes that.
            </p>

            <p className="text-chalk-muted leading-relaxed">
              Every session is built around one student and one tutor, making it
              easier to ask questions, work through difficult concepts, and
              learn at a comfortable pace.
            </p>
          </div>

          {/* Right cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Personalised */}
            <div className="bg-panel-2 border border-chalk-faint rounded-xl p-7 hover:border-brand-red hover:-translate-y-1 transition-all duration-200">
              <div className="w-11 h-11 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center mb-5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
                  <path d="M19 8v4" />
                  <path d="M17 10h4" />
                </svg>
              </div>

              <h4 className="text-lg font-bold mb-2">
                Personalised Learning
              </h4>

              <p className="text-chalk-muted text-sm leading-relaxed">
                Lessons can adapt to the student's level, goals, strengths,
                and areas that need more attention.
              </p>
            </div>

            {/* Expert tutors */}
            <div className="bg-panel-2 border border-chalk-faint rounded-xl p-7 hover:border-brand-red hover:-translate-y-1 transition-all duration-200">
              <div className="w-11 h-11 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center mb-5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M3 10l9-5 9 5-9 5-9-5z" />
                  <path d="M7 12.5v4.5c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5" />
                  <path d="M21 10v6" />
                </svg>
              </div>

              <h4 className="text-lg font-bold mb-2">
                Dedicated Tutors
              </h4>

              <p className="text-chalk-muted text-sm leading-relaxed">
                Students learn directly with tutors who can explain concepts
                clearly and provide focused individual attention.
              </p>
            </div>

            {/* Flexible */}
            <div className="bg-panel-2 border border-chalk-faint rounded-xl p-7 hover:border-brand-red hover:-translate-y-1 transition-all duration-200">
              <div className="w-11 h-11 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center mb-5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>

              <h4 className="text-lg font-bold mb-2">
                Flexible Learning
              </h4>

              <p className="text-chalk-muted text-sm leading-relaxed">
                Book sessions around your schedule and learn from wherever
                you are.
              </p>
            </div>

            {/* Real interaction */}
            <div className="bg-panel-2 border border-chalk-faint rounded-xl p-7 hover:border-brand-red hover:-translate-y-1 transition-all duration-200">
              <div className="w-11 h-11 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center mb-5">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M4 5h16v11H8l-4 4V5z" />
                  <path d="M8 9h8" />
                  <path d="M8 12h5" />
                </svg>
              </div>

              <h4 className="text-lg font-bold mb-2">
                Real Interaction
              </h4>

              <p className="text-chalk-muted text-sm leading-relaxed">
                Ask questions, solve problems, and interact with your tutor
                throughout every live session.
              </p>
            </div>

          </div>
        </div>

        {/* Bottom statement */}
        <div className="mt-16 text-center">
          <div className="inline-flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm text-chalk-muted">
            <span>
              <strong className="text-chalk">1-on-1</strong> learning
            </span>

            <span className="hidden sm:inline text-chalk-faint">•</span>

            <span>
              <strong className="text-chalk">Live</strong> classes
            </span>

            <span className="hidden sm:inline text-chalk-faint">•</span>

            <span>
              <strong className="text-chalk">Flexible</strong> scheduling
            </span>

            <span className="hidden sm:inline text-chalk-faint">•</span>

            <span>
              <strong className="text-chalk">Multiple</strong> subjects
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}