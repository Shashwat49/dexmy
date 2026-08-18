const boards = [
  "CBSE",
  "ICSE",
  "IGCSE",
  "IB MYP",
  "GCSE",
  "MPPSC",
  "DEMA"
];

const tests = [
  "SAT",
  "PSAT",
  "AP",
  "TMUA",
  "USCC",
  "JEE",
  "NEET"
];

function TrackCard({ label, index }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-chalk-faint bg-panel-2 p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-gold hover:bg-panel-3">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-red-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <span className="relative z-[1] mb-5 block text-xs font-semibold tracking-[2px] text-brand-gold">
        {String(index + 1).padStart(2, "0")}
      </span>

      <h3 className="relative z-[1] font-display text-2xl sm:text-3xl tracking-tight text-chalk">
        {label}
      </h3>

      <div className="relative z-[1] mt-5 h-px w-10 bg-brand-red transition-all duration-200 group-hover:w-16" />
    </div>
  );
}

function TrackGrid({ eyebrow, title, items }) {
  return (
    <section className="py-14 sm:py-16">
      <div className="mb-8 sm:mb-10">
        <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-[2px] text-brand-gold">
          {eyebrow}
        </p>

        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight">
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5">
        {items.map((item, index) => (
          <TrackCard
            key={item}
            label={item}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

export default function AcademicTracks() {
  return (
    <section className="relative z-[3] border-t border-chalk-faint bg-void px-4 sm:px-6 md:px-12">
      <div className="mx-auto max-w-6xl">

        <TrackGrid
          eyebrow="Education boards"
          title="Built for the curriculum you follow."
          items={boards}
        />

        <div className="border-t border-chalk-faint" />

        <TrackGrid
          eyebrow="Tests & exams"
          title="Prepare for the tests that matter."
          items={tests}
        />

      </div>
    </section>
  );
}