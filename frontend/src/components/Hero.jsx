import HeroScene from "./HeroScene";

export default function Hero() {
  return (
    <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden">
      {/* soft red vignette behind everything */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(228,39,28,0.09), transparent 70%)",
        }}
      />

      <HeroScene />

      <p className="relative z-[3] text-sm font-semibold tracking-[2px] uppercase text-brand-gold mb-5">
        1-on-1 live classes, any subject
      </p>

      <h1 className="relative z-[3] font-display leading-[1.02] tracking-tight max-w-3xl text-[clamp(42px,7vw,84px)]">
        Learn faster with a teacher
        <br />
        who's{" "}
        <span className="relative inline-block">
          actually watching
          <svg
            className="chalk-underline absolute left-[-4px] right-[-4px] -bottom-1.5 w-[calc(100%+8px)] h-[18px]"
            viewBox="0 0 300 18"
            preserveAspectRatio="none"
          >
            <path d="M4 12 Q 80 4, 150 10 T 296 8" />
          </svg>
        </span>{" "}
        you learn
      </h1>

      <p className="relative z-[3] text-lg text-chalk-muted max-w-xl mx-auto mt-7 mb-10 leading-relaxed">
        Dexmy pairs every student with a dedicated tutor for real one-on-one classes — live
        whiteboard, live doubts, zero crowd.
      </p>

      <div className="relative z-[3] flex gap-4 flex-wrap justify-center">
        <a
          href="#book-demo"
          className="btn-demo-pulse bg-brand-gold text-[#2C1E04] text-base font-bold px-8 py-4 rounded-lg hover:bg-[#FFC94D] transition-colors"
        >
          Book a free demo
        </a>
        <a
          href="#how-it-works"
          className="border border-chalk-muted hover:border-chalk text-chalk text-base px-7 py-4 rounded-lg transition-colors"
        >
          See how it works
        </a>
      </div>
    </section>
  );
}
