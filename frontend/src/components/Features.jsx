const FEATURES = [
  {
    title: "Live shared whiteboard",
    description:
      "Pen, highlighter, undo, redo — your tutor annotates in real time, and you keep the notes after class.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 14h4" />
      </svg>
    ),
  },
  {
    title: "One tutor, one student",
    description:
      "No breakout rooms, no thirty other hands raised. Just you and your teacher, every single class.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
      </svg>
    ),
  },
  {
    title: "Book around your day",
    description: "See a tutor's real open slots and book instantly — no back and forth over email.",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z" />
        <path d="M3 7.5v5c0 2 4 3.5 9 3.5s9-1.5 9-3.5v-5" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section className="relative z-[3] py-24 px-6 md:px-12 bg-panel border-t border-chalk-faint">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl tracking-tight">Built for one student at a time</h2>
          <p className="text-chalk-muted mt-3">Every class is a real classroom, not a webinar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-panel-2 border border-chalk-faint rounded-xl p-8 hover:border-brand-red hover:-translate-y-1 transition-all"
            >
              <div className="w-11 h-11 rounded-[10px] bg-brand-red-soft text-brand-red flex items-center justify-center mb-5">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold mb-2.5">{f.title}</h3>
              <p className="text-chalk-muted text-[14.5px] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
