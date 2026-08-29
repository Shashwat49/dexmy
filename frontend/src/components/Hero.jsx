import HeroScene from "./HeroScene";
import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="relative min-h-[78vh] sm:min-h-[82vh] md:min-h-[88vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-16 sm:pt-20 pb-12 sm:pb-16 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(228,39,28,0.09), transparent 70%)",
        }}
      />

      <HeroScene />

      <p className="relative z-[3] text-sm font-semibold tracking-[2px] uppercase text-brand-gold mb-5">
        1-on-1 live online tutoring
      </p>

      <h1 className="relative z-[3] font-display leading-[1.02] tracking-tight max-w-4xl text-[clamp(38px,10vw,84px)]">
        Personalized tutoring with a teacher who's{" "}
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

      <p className="relative z-[3] text-base sm:text-lg text-chalk-muted max-w-2xl mx-auto mt-6 sm:mt-7 mb-8 sm:mb-10 leading-relaxed">
        Dexmy connects students with dedicated tutors for live 1-on-1 classes in SAT, PSAT, AP,
        TMUA, CBSE, ICSE, IGCSE, IB MYP, GCSE and more — with personalized lessons, live doubts,
        and zero crowded classrooms.
      </p>

      <div className="relative z-[3] flex gap-4 flex-wrap justify-center">
        <Link
          to="/login"
          className="btn-demo-pulse bg-brand-gold text-[#2C1E04] text-base font-bold px-8 py-4 rounded-lg hover:bg-[#FFC94D] transition-colors"
        >
          Book a Free Slot
        </Link>
      </div>
    </section>
  );
}
