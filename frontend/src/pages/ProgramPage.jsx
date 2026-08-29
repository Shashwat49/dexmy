import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const programs = {
  sat: {
    name: "SAT Tutoring",
    title: "SAT Tutoring | 1-on-1 SAT Prep Online | Dexmy",
    description: "1-on-1 live SAT tutoring with dedicated teachers. Build math, reading and writing skills, learn test strategy, and prepare with a study plan built around your goals.",
    intro: "Prepare for the SAT with focused 1-on-1 instruction instead of a crowded classroom. Dexmy tutors can work through difficult concepts, identify gaps, and adjust lessons to your pace.",
    points: ["Personalized SAT Math, Reading and Writing support", "Live lessons with direct teacher interaction", "Targeted practice for weak areas and test strategy", "Flexible scheduling around school and other commitments"],
  },
  psat: {
    name: "PSAT Tutoring",
    title: "PSAT Tutoring | 1-on-1 Online PSAT Prep | Dexmy",
    description: "Personalized 1-on-1 PSAT tutoring online for students who want stronger math, reading and writing skills and a structured preparation plan.",
    intro: "Build a strong PSAT foundation with lessons that focus on the skills you actually need to improve. Work directly with a tutor, ask questions in real time, and practice with guidance.",
    points: ["Math, Reading and Writing skill development", "Personalized practice and feedback", "Concept-focused lessons for difficult topics", "Study support that adapts as you progress"],
  },
  ap: {
    name: "AP Tutoring",
    title: "AP Tutoring Online | 1-on-1 AP Exam Preparation | Dexmy",
    description: "1-on-1 online AP tutoring for students who want focused support with AP course concepts, problem solving, exam preparation and practice.",
    intro: "AP courses move quickly and often require both deep understanding and exam-specific practice. Dexmy provides individual tutoring so students can spend more time on the concepts and question types that challenge them.",
    points: ["Course-specific AP concept support", "Step-by-step help with challenging questions", "Exam-focused practice and review", "Individual pacing based on current understanding"],
  },
  tmua: {
    name: "TMUA Tutoring",
    title: "TMUA Tutoring Online | 1-on-1 TMUA Preparation | Dexmy",
    description: "Focused 1-on-1 TMUA tutoring online for students developing mathematical reasoning, problem-solving and exam technique for the Test of Mathematics for University Admission.",
    intro: "TMUA preparation is about mathematical thinking as much as routine calculation. Work through unfamiliar problems with a tutor who can explain the reasoning behind each step and help you develop a disciplined approach.",
    points: ["Mathematical reasoning and problem solving", "Guided practice with challenging questions", "Error analysis and strategy development", "Structured preparation around your target timeline"],
  },
  igcse: {
    name: "IGCSE Tutoring",
    title: "IGCSE Tutoring Online | 1-on-1 IGCSE Classes | Dexmy",
    description: "1-on-1 IGCSE tutoring online for students who want personalized support across their IGCSE subjects, concepts, coursework and exam preparation.",
    intro: "IGCSE students can use Dexmy for focused help with difficult concepts and exam preparation. Lessons are designed around the student's current level, syllabus and goals.",
    points: ["Personalized IGCSE subject support", "Concept clarification and guided problem solving", "Exam and revision preparation", "Flexible live online lessons"],
  },
  "ib-myp": {
    name: "IB MYP Tutoring",
    title: "IB MYP Tutoring Online | 1-on-1 IB MYP Support | Dexmy",
    description: "Personalized 1-on-1 IB MYP tutoring online with live teacher support for concepts, assignments, problem solving and assessment preparation.",
    intro: "IB MYP learning rewards understanding, application and clear communication. Dexmy gives students individual teacher attention to unpack difficult concepts and build confidence in applying them.",
    points: ["Individual support for IB MYP subjects", "Conceptual understanding and application", "Assignment and assessment preparation", "Lessons adapted to the student's pace"],
  },
  gcse: {
    name: "GCSE Tutoring",
    title: "GCSE Tutoring Online | 1-on-1 GCSE Classes | Dexmy",
    description: "1-on-1 GCSE tutoring online for personalized concept support, practice, revision and exam preparation across major GCSE subjects.",
    intro: "Build confidence for GCSE exams with live individual tutoring. Dexmy lessons give students space to ask questions, revisit difficult topics and practice until the method becomes clear.",
    points: ["Personalized GCSE subject tutoring", "Targeted revision for difficult topics", "Guided exam practice and problem solving", "Flexible online learning with dedicated attention"],
  },
  cbse: {
    name: "CBSE Tutoring",
    title: "CBSE Tutoring Online | 1-on-1 CBSE Classes | Dexmy",
    description: "1-on-1 online CBSE tutoring for students who want personalized help with concepts, schoolwork, practice and exam preparation.",
    intro: "Strengthen CBSE fundamentals with individual teacher support. Dexmy helps students slow down when a concept is difficult, practice it carefully, and move ahead when they are ready.",
    points: ["Personalized CBSE subject support", "Concept building and doubt solving", "School and exam preparation", "Live 1-on-1 lessons with flexible scheduling"],
  },
  icse: {
    name: "ICSE Tutoring",
    title: "ICSE Tutoring Online | 1-on-1 ICSE Classes | Dexmy",
    description: "Personalized 1-on-1 ICSE tutoring online for concept clarity, practice, school support and exam preparation across major subjects.",
    intro: "Get focused ICSE support from a dedicated tutor. Lessons can be used to strengthen fundamentals, solve difficult problems, revise important topics and prepare for examinations.",
    points: ["Individual ICSE subject tutoring", "Doubt solving and concept clarification", "Revision and exam preparation", "Live lessons built around the student's needs"],
  },
};

export default function ProgramPage({ slug }) {
  const program = programs[slug];
  if (!program) return null;

  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO title={program.title} description={program.description} path={`/${slug}`} />
      <header className="border-b border-chalk-faint bg-void/95 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="font-display text-2xl tracking-tight">Dexmy</Link>
          <Link to="/" className="text-sm text-chalk-muted hover:text-chalk">Back to home</Link>
        </div>
      </header>

      <main>
        <section className="border-b border-chalk-faint px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-4xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[2px] text-brand-gold">Dexmy · 1-on-1 online tutoring</p>
            <h1 className="font-display text-5xl leading-tight tracking-tight md:text-7xl">{program.name}</h1>
            <p className="mt-7 max-w-3xl text-lg leading-relaxed text-chalk-muted md:text-xl">{program.intro}</p>
            <Link to="/login" className="mt-9 inline-flex rounded-lg bg-brand-red px-7 py-3.5 font-semibold text-white hover:bg-brand-red-dark transition-colors">Book a Free Slot</Link>
          </div>
        </section>

        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl tracking-tight md:text-5xl">How Dexmy can help</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {program.points.map((point) => (
                <article key={point} className="rounded-2xl border border-chalk-faint bg-panel-2 p-7">
                  <h3 className="text-lg font-semibold leading-snug">{point}</h3>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-chalk-faint px-6 py-16 md:px-12">
          <div className="mx-auto max-w-6xl rounded-2xl border border-chalk-faint bg-panel p-8 md:p-12">
            <h2 className="font-display text-3xl tracking-tight md:text-4xl">Learn with attention, not a crowd.</h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-chalk-muted">Every Dexmy lesson is built around the student. Ask questions, work through problems live, and spend more time on the topics that need attention.</p>
            <Link to="/" className="mt-7 inline-block text-sm font-semibold text-brand-gold hover:underline">Explore Dexmy</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
