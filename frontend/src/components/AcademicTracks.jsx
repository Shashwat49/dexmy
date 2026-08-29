import { Link } from "react-router-dom";

const boards = [
  ["CBSE", "/cbse-tutoring"],
  ["ICSE", "/icse-tutoring"],
  ["IGCSE", "/igcse-tutoring"],
  ["IB MYP", "/ib-myp-tutoring"],
  ["GCSE", "/gcse-tutoring"],
];

const tests = [
  ["SAT", "/sat-tutoring"],
  ["PSAT", "/psat-tutoring"],
  ["AP", "/ap-tutoring"],
  ["TMUA", "/tmua-tutoring"],
];

function TrackCard({ label, href, index }) {
  return (
    <Link to={href} className="group relative overflow-hidden rounded-2xl border border-chalk-faint bg-panel-2 p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:border-brand-gold hover:bg-panel-3 focus:outline-none focus:ring-2 focus:ring-brand-gold">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-red-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="relative z-[1] mb-5 block text-xs font-semibold tracking-[2px] text-brand-gold">{String(index + 1).padStart(2, "0")}</span>
      <h3 className="relative z-[1] font-display text-2xl tracking-tight text-chalk sm:text-3xl">{label} Tutoring</h3>
      <p className="relative z-[1] mt-3 text-sm leading-relaxed text-chalk-muted">Explore 1-on-1 online {label} tutoring at Dexmy.</p>
      <div className="relative z-[1] mt-5 h-px w-10 bg-brand-red transition-all duration-200 group-hover:w-16" />
    </Link>
  );
}

function TrackGrid({ eyebrow, title, items }) {
  return (
    <section className="py-14 sm:py-16">
      <div className="mb-8 sm:mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-brand-gold sm:text-sm">{eyebrow}</p>
        <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-5">
        {items.map(([label, href], index) => <TrackCard key={label} label={label} href={href} index={index} />)}
      </div>
    </section>
  );
}

export default function AcademicTracks() {
  return (
    <section className="relative z-[3] border-t border-chalk-faint bg-void px-4 sm:px-6 md:px-12">
      <div className="mx-auto max-w-6xl">
        <TrackGrid eyebrow="Education boards" title="Built for the curriculum you follow." items={boards} />
        <div className="border-t border-chalk-faint" />
        <TrackGrid eyebrow="Tests & exams" title="Prepare for the tests that matter." items={tests} />
      </div>
    </section>
  );
}
