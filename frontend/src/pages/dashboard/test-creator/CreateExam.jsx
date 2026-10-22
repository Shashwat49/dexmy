import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "./components/TeacherLayout";
import { fetchWithAuth } from "./src/api";
import { ArrowLeftIcon, PlusIcon, CloseIcon, CheckIcon } from "./components/Icons";

const steps = ["Test Metadata", "Sections & Questions", "Global Settings", "Instructions", "Review & Save"];
const inputClass = "w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none";
const initialQuestion = () => ({ questionText: "", options: ["", "", "", ""], correctAnswer: 0, marks: "1", negativeMarks: "0", difficulty: "Medium" });
const initialSection = () => ({ name: "Section 1", type: "Mandatory", subject: "", time: "60", breakMinutes: "0", expectedTime: "120", questions: [initialQuestion()] });
const initialSettings = { shuffleQuestions: false, shuffleOptions: false, showTimer: true, allowCalculator: false, allowPeriodicTable: false, allowSectionNavigation: true, enableNavigation: true, autoSave: true, warningBeforeSubmit: true, formulaSheet: "None" };

function Field({ label, children }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold text-chalk-muted">{label}</span>{children}</label>;
}
function CreateExam() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [metadata, setMetadata] = useState({ title: "", program: "Test Prep", track: "SAT", level: "Intermediate", purpose: "Diagnostic", grades: ["Grade 10"], subject: "SAT", curriculum: "SAT", duration: "180", maxScore: "1600", difficulty: "Medium", testType: "Mock", examType: "SAT", description: "", isPaid: false, price: "" });
  const [sections, setSections] = useState([initialSection()]);
  const [settings, setSettings] = useState(initialSettings);
  const [instructions, setInstructions] = useState({ general: "Read all instructions carefully before starting. Use rough paper for calculations. Do not use unfair means.", sections: [""] });

  const updateMetadata = (key, value) => setMetadata(old => ({ ...old, [key]: value }));
  const updateSection = (index, patch) => setSections(old => old.map((s, i) => i === index ? { ...s, ...patch } : s));
  const updateQuestion = (si, qi, patch) => setSections(old => old.map((s, i) => i !== si ? s : ({ ...s, questions: s.questions.map((q, j) => j === qi ? { ...q, ...patch } : q) })));
  const updateOption = (si, qi, oi, value) => updateQuestion(si, qi, { options: sections[si].questions[qi].options.map((v, i) => i === oi ? value : v) });
  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);
  const totalMarks = sections.reduce((n, s) => n + s.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0), 0);
  const validateStep = () => {
    if (step === 0) {
      if (!metadata.title.trim()) return "Enter a test title.";
      if (!metadata.subject.trim()) return "Enter a subject.";
      if (Number(metadata.duration) < 1) return "Duration must be at least one minute.";
      if (metadata.isPaid && Number(metadata.price) <= 0) return "Enter a valid price for this paid test.";
    }
    if (step === 1) {
      if (!sections.length) return "Add at least one section.";
      for (let si = 0; si < sections.length; si++) {
        const section = sections[si];
        if (!section.name.trim()) return `Enter a name for section ${si + 1}.`;
        if (!section.questions.length) return `Add at least one question to ${section.name}.`;
        for (let qi = 0; qi < section.questions.length; qi++) {
          const q = section.questions[qi];
          if (!q.questionText.trim()) return `Enter question ${qi + 1} in ${section.name}.`;
          if (q.options.length < 2 || q.options.some(o => !o.trim())) return `Complete every option for question ${qi + 1} in ${section.name}.`;
          if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) return `Choose the correct answer for question ${qi + 1}.`;
        }
      }
    }
    return "";
  };
  const move = (next) => {
    const issue = validateStep();
    if (issue) { setError(issue); return; }
    setError(""); setNotice(""); setStep(next);
  };
  const save = async (publish) => {
    const issue = validateStep();
    if (issue) { setError(issue); setStep(step === 0 ? 0 : 1); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const description = JSON.stringify({
        summary: metadata.description,
        metadata: { program: metadata.program, track: metadata.track, level: metadata.level, purpose: metadata.purpose, grades: metadata.grades, curriculum: metadata.curriculum, maxScore: Number(metadata.maxScore) || 0, difficulty: metadata.difficulty, testType: metadata.testType, examType: metadata.examType },
        sections: sections.map(({ name, type, subject, time, breakMinutes, expectedTime }) => ({ name, type, subject, time, breakMinutes, expectedTime })),
        settings,
        instructions,
        saveVersion: 1
      });
      let response = await fetchWithAuth("/api/tests", { method: "POST", body: JSON.stringify({
        title: metadata.title.trim(), description, subject: metadata.subject.trim(), duration: Number(metadata.duration),
        marksPerQuestion: 1, negativeMarks: 0, isPaid: Boolean(metadata.isPaid), is_paid: Boolean(metadata.isPaid), price: metadata.isPaid ? Number(metadata.price) : 0
      }) });
      if (!response.ok) response = await fetchWithAuth("/api/test-creation", { method: "POST", body: JSON.stringify({
        title: metadata.title.trim(), description, subject: metadata.subject.trim(), duration: Number(metadata.duration),
        marksPerQuestion: 1, negativeMarks: 0, isPaid: Boolean(metadata.isPaid), is_paid: Boolean(metadata.isPaid), price: metadata.isPaid ? Number(metadata.price) : 0
      }) });
      const testData = await response.json().catch(() => ({}));
      if (!response.ok || !testData.success) throw new Error(testData.message || "Could not create the test.");
      const testId = String(testData.test?.id || testData.test?._id || "");
      if (!testId) throw new Error("The test was created but the server did not return its ID.");

      for (const section of sections) {
        for (const q of section.questions) {
          const qRes = await fetchWithAuth("/api/questions", { method: "POST", body: JSON.stringify({
            questionText: q.questionText.trim(), subject: section.subject.trim() || metadata.subject.trim(),
            options: q.options.map(o => o.trim()), correctAnswer: Number(q.correctAnswer),
            marks: Number(q.marks) || 1, negativeMarks: Number(q.negativeMarks) || 0, difficulty: q.difficulty
          }) });
          const qData = await qRes.json().catch(() => ({}));
          if (!qRes.ok || !qData.success) throw new Error(qData.message || "A question could not be saved.");
          const questionId = String(qData.question?.id || qData.question?._id || "");
          if (!questionId) throw new Error("A saved question did not return an ID.");
          const attachRes = await fetchWithAuth(`/api/tests/${testId}/questions`, { method: "POST", body: JSON.stringify({ questionId }) });
          const attachData = await attachRes.json().catch(() => ({}));
          if (!attachRes.ok || !attachData.success) throw new Error(attachData.message || "A question could not be attached to this test.");
        }
      }
      if (publish) {
        const pubRes = await fetchWithAuth(`/api/tests/${testId}/publish`, { method: "PATCH" });
        const pubData = await pubRes.json().catch(() => ({}));
        if (!pubRes.ok || !pubData.success) throw new Error(pubData.message || "Test saved, but publishing failed. You can publish it from My Tests.");
      }
      setNotice(publish ? "Test created and published successfully." : "Test saved as a draft successfully.");
      navigate("/test-creator/tests", { state: { notice: publish ? "Test created and published successfully." : "Test saved as a draft successfully." } });
    } catch (e) {
      setError(e.message || "Unable to save test.");
    } finally { setSaving(false); }
  };

  return <TeacherLayout>
    <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
      <header className="border-b border-chalk-faint px-4 sm:px-8 py-5">
        <div className="max-w-6xl mx-auto w-full">
          <button onClick={() => navigate("/test-creator/tests")} className="mb-3 inline-flex items-center gap-2 text-xs text-chalk-muted hover:text-chalk"><ArrowLeftIcon size={15}/> Back to Tests</button>
          <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">Assessment Management · Dexmy</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl text-chalk">Create a Test</h1>
          <p className="mt-1 text-sm text-chalk-muted">Build one complete assessment—every question belongs to its test.</p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-2">
            {steps.map((label, i) => <button key={label} type="button" onClick={() => i <= step ? setStep(i) : move(i)} className={`rounded-xl border px-3 py-3 text-left transition ${step === i ? "border-brand-red bg-brand-red-soft" : i < step ? "border-brand-gold/40 bg-panel" : "border-chalk-faint bg-panel/60"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === i ? "bg-brand-red text-white" : "bg-panel-2 text-chalk-muted"}`}>{i < step ? "✓" : i + 1}</span>
              <span className="mt-2 block text-xs font-semibold text-chalk">{label}</span>
            </button>)}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-5">
          {error && <div role="alert" className="rounded-xl border border-brand-red/40 bg-brand-red/10 px-4 py-3 text-sm text-chalk">{error}</div>}
          <section className="rounded-2xl border border-chalk-faint bg-panel p-4 sm:p-6">
            {step === 0 && <>
              <h2 className="text-lg font-semibold">Test Metadata</h2><p className="mt-1 mb-5 text-sm text-chalk-muted">Set up the identity, audience and scoring for this assessment.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Test title *"><input className={inputClass} value={metadata.title} onChange={e=>updateMetadata("title",e.target.value)} placeholder="e.g. SAT Mathematics Practice Test"/></Field>
                <Field label="Program"><select className={inputClass} value={metadata.program} onChange={e=>updateMetadata("program",e.target.value)}>{["Test Prep","School Curriculum","Competitive Exams","Other"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Track"><select className={inputClass} value={metadata.track} onChange={e=>updateMetadata("track",e.target.value)}>{["SAT","PSAT","AP","TMUA","IB","IGCSE","GCSE","CBSE","ICSE","Other"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Level"><select className={inputClass} value={metadata.level} onChange={e=>updateMetadata("level",e.target.value)}>{["Beginner","Intermediate","Advanced"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Purpose"><select className={inputClass} value={metadata.purpose} onChange={e=>updateMetadata("purpose",e.target.value)}>{["Diagnostic","Practice","Mock Exam","Assessment"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Subject *"><input className={inputClass} value={metadata.subject} onChange={e=>updateMetadata("subject",e.target.value)} placeholder="e.g. SAT Mathematics"/></Field>
                <Field label="Curriculum"><input className={inputClass} value={metadata.curriculum} onChange={e=>updateMetadata("curriculum",e.target.value)}/></Field>
                <Field label="Duration (minutes) *"><input type="number" min="1" className={inputClass} value={metadata.duration} onChange={e=>updateMetadata("duration",e.target.value)}/></Field>
                <Field label="Maximum score"><input type="number" min="0" className={inputClass} value={metadata.maxScore} onChange={e=>updateMetadata("maxScore",e.target.value)}/></Field>
                <Field label="Difficulty"><select className={inputClass} value={metadata.difficulty} onChange={e=>updateMetadata("difficulty",e.target.value)}>{["Easy","Medium","Hard","Mixed"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Test type"><select className={inputClass} value={metadata.testType} onChange={e=>updateMetadata("testType",e.target.value)}>{["Mock","Practice","Diagnostic","Sectional"].map(v=><option key={v}>{v}</option>)}</select></Field>
                <Field label="Exam type"><input className={inputClass} value={metadata.examType} onChange={e=>updateMetadata("examType",e.target.value)}/></Field>
                <Field label="Description"><textarea rows={3} className={inputClass} value={metadata.description} onChange={e=>updateMetadata("description",e.target.value)} placeholder="Describe the purpose of this test."/></Field>
                <Field label="Grades (comma-separated)"><input className={inputClass} value={metadata.grades.join(", ")} onChange={e=>updateMetadata("grades",e.target.value.split(",").map(v=>v.trim()).filter(Boolean))} placeholder="Grade 10, Grade 11"/></Field>
                <div className="md:col-span-2 rounded-xl border border-chalk-faint bg-panel-2/50 p-4 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={metadata.isPaid} onChange={e=>updateMetadata("isPaid",e.target.checked)} className="accent-brand-red"/> Paid test</label>
                  {metadata.isPaid && <Field label="Price"><input type="number" min="1" className={inputClass} value={metadata.price} onChange={e=>updateMetadata("price",e.target.value)} placeholder="Price"/></Field>}
                </div>
              </div>
            </>}

            {step === 1 && <>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5"><div><h2 className="text-lg font-semibold">Sections &amp; Questions</h2><p className="mt-1 text-sm text-chalk-muted">Questions are created inside this test, never selected from a shared repository.</p></div><button type="button" onClick={()=>setSections(old=>[...old,{...initialSection(),name:`Section ${old.length+1}`,questions:[initialQuestion()]}])} className="inline-flex items-center gap-2 rounded-xl border border-brand-gold/50 px-3 py-2 text-sm font-semibold text-brand-gold"><PlusIcon size={15}/> Add section</button></div>
              <div className="space-y-5">
                {sections.map((section, si)=><article key={si} className="overflow-hidden rounded-xl border border-chalk-faint">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-panel-2/60 p-4">
                    <Field label="Section name"><input className={inputClass} value={section.name} onChange={e=>updateSection(si,{name:e.target.value})}/></Field>
                    <Field label="Section type"><select className={inputClass} value={section.type} onChange={e=>updateSection(si,{type:e.target.value})}><option>Mandatory</option><option>Optional</option></select></Field>
                    <Field label="Section subject"><select className={inputClass} value={section.subject} onChange={e=>updateSection(si,{subject:e.target.value})}><option value="">Use test subject</option>{["Reading & Writing","Math","Science","English","Mathematics","General Awareness","Other"].map(v=><option key={v}>{v}</option>)}</select></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="Allocated time (min)"><input type="number" min="1" className={inputClass} value={section.time} onChange={e=>updateSection(si,{time:e.target.value})}/></Field><Field label="Break before next (min)"><input type="number" min="0" className={inputClass} value={section.breakMinutes} onChange={e=>updateSection(si,{breakMinutes:e.target.value})}/></Field></div>
                    <Field label="Expected time per question (seconds)"><input type="number" min="1" className={inputClass} value={section.expectedTime} onChange={e=>updateSection(si,{expectedTime:e.target.value})}/></Field>
                    {sections.length>1 && <div className="flex items-end"><button type="button" onClick={()=>setSections(old=>old.filter((_,i)=>i!==si))} className="rounded-xl border border-brand-red/40 px-3 py-2 text-xs text-brand-red">Remove section</button></div>}
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Questions — {section.name}</h3><button type="button" onClick={()=>updateSection(si,{questions:[...section.questions,initialQuestion()]})} className="inline-flex items-center gap-1 rounded-lg border border-brand-gold/40 px-3 py-2 text-xs font-semibold text-brand-gold"><PlusIcon size={14}/> Add question</button></div>
                    {section.questions.map((q,qi)=><div key={qi} className="rounded-xl border border-chalk-faint bg-void/40 p-4 space-y-3">
                      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Question {qi+1}</h4>{section.questions.length>1&&<button type="button" onClick={()=>updateSection(si,{questions:section.questions.filter((_,i)=>i!==qi)})} aria-label="Remove question" className="text-chalk-muted hover:text-brand-red"><CloseIcon size={16}/></button>}</div>
                      <Field label="Question text *"><textarea rows={3} className={inputClass} value={q.questionText} onChange={e=>updateQuestion(si,qi,{questionText:e.target.value})} placeholder="Write the question…"/></Field>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{q.options.map((option,oi)=><div key={oi} className="flex gap-2 items-center"><button type="button" onClick={()=>updateQuestion(si,qi,{correctAnswer:oi})} title="Set correct answer" className={`h-9 w-9 shrink-0 rounded-lg border text-xs font-bold ${q.correctAnswer===oi?"border-brand-gold bg-brand-gold text-[#2C1E04]":"border-chalk-faint text-chalk-muted"}`}>{String.fromCharCode(65+oi)}</button><input className={inputClass} value={option} onChange={e=>updateOption(si,qi,oi,e.target.value)} placeholder={`Option ${String.fromCharCode(65+oi)}`}/>{q.options.length>2&&<button type="button" onClick={()=>updateQuestion(si,qi,{options:q.options.filter((_,i)=>i!==oi),correctAnswer:q.correctAnswer===oi?0:q.correctAnswer>oi?q.correctAnswer-1:q.correctAnswer})} className="text-chalk-muted hover:text-brand-red"><CloseIcon size={14}/></button>}</div>)}</div>
                      <div className="flex flex-wrap gap-2"><button type="button" disabled={q.options.length>=5} onClick={()=>updateQuestion(si,qi,{options:[...q.options,""]})} className="rounded-lg border border-chalk-faint px-3 py-2 text-xs text-chalk-muted disabled:opacity-40">+ Add option</button><div className="w-28"><Field label="Marks"><input type="number" min="0" className={inputClass} value={q.marks} onChange={e=>updateQuestion(si,qi,{marks:e.target.value})}/></Field></div><div className="w-32"><Field label="Negative marks"><input type="number" min="0" className={inputClass} value={q.negativeMarks} onChange={e=>updateQuestion(si,qi,{negativeMarks:e.target.value})}/></Field></div><div className="w-36"><Field label="Difficulty"><select className={inputClass} value={q.difficulty} onChange={e=>updateQuestion(si,qi,{difficulty:e.target.value})}>{["Easy","Medium","Hard"].map(v=><option key={v}>{v}</option>)}</select></Field></div></div>
                    </div>)}
                  </div>
                </article>)}
              </div>
            </>}

            {step === 2 && <>
              <h2 className="text-lg font-semibold">Global Settings</h2><p className="mt-1 mb-5 text-sm text-chalk-muted">Choose how students navigate and complete the assessment.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries({shuffleQuestions:"Shuffle questions",shuffleOptions:"Shuffle options",showTimer:"Show timer",allowCalculator:"Allow calculator",allowPeriodicTable:"Allow periodic table",allowSectionNavigation:"Allow section navigation",enableNavigation:"Enable question navigation",autoSave:"Auto-save responses",warningBeforeSubmit:"Warn before submission"}).map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-chalk-faint bg-panel-2/40 p-4 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4 accent-brand-red" checked={settings[key]} onChange={e=>setSettings(old=>({...old,[key]:e.target.checked}))}/></label>)}
              </div>
              <div className="mt-4 max-w-sm"><Field label="Formula sheet"><select className={inputClass} value={settings.formulaSheet} onChange={e=>setSettings(old=>({...old,formulaSheet:e.target.value}))}>{["None","Mathematics","Physics","Chemistry","Periodic Table"].map(v=><option key={v}>{v}</option>)}</select></Field></div>
            </>}

            {step === 3 && <>
              <h2 className="text-lg font-semibold">Instructions</h2><p className="mt-1 mb-5 text-sm text-chalk-muted">Add instructions shown to students before they start.</p>
              <Field label="General instructions"><textarea rows={5} className={inputClass} value={instructions.general} onChange={e=>setInstructions(old=>({...old,general:e.target.value}))}/></Field>
              <div className="mt-5 space-y-4">{sections.map((section,i)=><Field key={i} label={`${section.name} instructions`}><textarea rows={3} className={inputClass} value={instructions.sections[i]||""} onChange={e=>setInstructions(old=>({...old,sections:sections.map((_,j)=>j===i?e.target.value:old.sections[j]||"")}))} placeholder={`Enter instructions for ${section.name}…`}/></Field>)}</div>
            </>}

            {step === 4 && <>
              <h2 className="text-lg font-semibold">Review &amp; Save</h2><p className="mt-1 mb-5 text-sm text-chalk-muted">Check the assessment summary before saving or publishing.</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["Questions",totalQuestions],["Sections",sections.length],["Duration",`${metadata.duration} min`],["Question marks",totalMarks]].map(([label,value])=><div key={label} className="rounded-xl border border-chalk-faint bg-panel-2/50 p-4"><p className="text-xs text-chalk-muted">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
              <dl className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">{[["Title",metadata.title],["Program",metadata.program],["Track",metadata.track],["Grade",metadata.grades.join(", ")],["Subject",metadata.subject],["Curriculum",metadata.curriculum],["Difficulty",metadata.difficulty],["Test type",metadata.testType],["Exam type",metadata.examType],["Access",metadata.isPaid?`Paid · ${metadata.price}`:"Free"]].map(([k,v])=><div key={k} className="rounded-xl border border-chalk-faint p-3"><dt className="text-xs text-chalk-muted">{k}</dt><dd className="mt-1 text-sm font-medium">{v||"—"}</dd></div>)}</dl>
              <div className="mt-5 space-y-3">{sections.map((s,i)=><div key={i} className="rounded-xl border border-chalk-faint p-4"><p className="font-semibold">{i+1}. {s.name} <span className="text-xs font-normal text-chalk-muted">· {s.type} · {s.questions.length} questions</span></p><ol className="mt-2 list-decimal pl-5 text-sm text-chalk-muted space-y-1">{s.questions.map((q,j)=><li key={j}>{q.questionText||"Untitled question"} <span className="text-xs">({q.marks} marks)</span></li>)}</ol></div>)}</div>
              <p className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/5 p-3 text-xs text-chalk-muted">Question content is saved and linked to this test. Metadata and test-taking settings are stored with the test configuration.</p>
            </>}
          </section>
          <footer className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" disabled={step===0||saving} onClick={()=>{setError("");setStep(s=>s-1)}} className="rounded-xl border border-chalk-faint px-4 py-2.5 text-sm font-semibold text-chalk-muted disabled:opacity-40">Previous</button>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={()=>navigate("/test-creator/tests")} className="rounded-xl border border-chalk-faint px-4 py-2.5 text-sm font-semibold text-chalk-muted">Cancel</button>
              {step < steps.length-1 ? <button type="button" onClick={()=>move(step+1)} className="rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-white">Next <span aria-hidden="true">→</span></button> : <><button type="button" disabled={saving} onClick={()=>save(false)} className="rounded-xl border border-brand-gold/50 px-4 py-2.5 text-sm font-semibold text-brand-gold disabled:opacity-50">{saving?"Saving…":"Save as Draft"}</button><button type="button" disabled={saving} onClick={()=>save(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Saving…":<><CheckIcon size={15}/> Create &amp; Publish</>}</button></>}
            </div>
          </footer>
        </div>
      </main>
    </div>
  </TeacherLayout>;
}
export default CreateExam;
