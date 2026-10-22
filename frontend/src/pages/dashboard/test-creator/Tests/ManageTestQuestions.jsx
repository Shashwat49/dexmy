import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import { ArrowLeftIcon, PlusIcon, CheckIcon } from "../components/Icons";

const inputClass = "w-full rounded-xl border border-chalk-faint bg-panel-2 px-3 py-2.5 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none";
const blankQuestion = () => ({ id: "", questionText: "", options: ["", "", "", ""], correctAnswer: 0, marks: "1", negativeMarks: "0", difficulty: "Medium", subject: "" });

function normalizeQuestion(q) {
  return {
    id: String(q.id || q._id || ""),
    questionText: q.questionText || q.question_text || q.question || "",
    options: Array.isArray(q.options) ? q.options.map(o => typeof o === "string" ? o : o.text || o.optionText || "") : ["", "", "", ""],
    correctAnswer: Number(q.correctAnswer ?? q.correct_answer ?? 0),
    marks: String(q.marks ?? 1),
    negativeMarks: String(q.negativeMarks ?? q.negative_marks ?? 0),
    difficulty: q.difficulty || "Medium",
    subject: q.subject || ""
  };
}

function ManageTestQuestions() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      let response = await fetchWithAuth(`/api/tests/${testId}`);
      if (!response.ok) response = await fetchWithAuth(`/api/test-creation/${testId}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load this test.");
      setTest(data.test);
      setQuestions((data.test.questions || []).map(normalizeQuestion));
    } catch (e) {
      setError(e.message || "Could not load questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [testId]);

  const patchQuestion = (index, patch) => setQuestions(old => old.map((q, i) => i === index ? { ...q, ...patch } : q));
  const patchOption = (qi, oi, value) => patchQuestion(qi, { options: questions[qi].options.map((o, i) => i === oi ? value : o) });

  const saveQuestion = async (q, index) => {
    if (!q.questionText.trim() || q.options.length < 2 || q.options.some(o => !o.trim())) {
      setError(`Complete the question text and every option for question ${index + 1}.`);
      return;
    }
    if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
      setError(`Choose a valid correct answer for question ${index + 1}.`);
      return;
    }
    setSaving(q.id || `new-${index}`);
    setError("");
    setNotice("");
    try {
      const payload = {
        questionText: q.questionText.trim(),
        question: q.questionText.trim(),
        options: q.options.map(o => o.trim()),
        correctAnswer: Number(q.correctAnswer),
        marks: Number(q.marks) || 1,
        negativeMarks: Number(q.negativeMarks) || 0,
        subject: q.subject || test?.subject || "",
        difficulty: q.difficulty
      };
      let response;
      let data;
      if (q.id) {
        response = await fetchWithAuth(`/api/questions/${q.id}`, { method: "PUT", body: JSON.stringify(payload) });
        data = await response.json().catch(() => ({}));
      } else {
        response = await fetchWithAuth("/api/questions", { method: "POST", body: JSON.stringify(payload) });
        data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "Could not create question.");
        const questionId = String(data.question?.id || data.question?._id || "");
        if (!questionId) throw new Error("The server did not return a question ID.");
        let attach = await fetchWithAuth(`/api/tests/${testId}/questions`, { method: "POST", body: JSON.stringify({ questionId }) });
        if (!attach.ok) attach = await fetchWithAuth(`/api/test-creation/${testId}/questions`, { method: "POST", body: JSON.stringify({ questionId }) });
        const attachData = await attach.json().catch(() => ({}));
        if (!attach.ok || !attachData.success) throw new Error(attachData.message || "Question saved but could not be attached to this test.");
        setNotice(`Question ${index + 1} created and attached to this test.`);
        await load();
        return;
      }
      if (!response.ok || !data.success) throw new Error(data.message || "Failed to update question.");
      setNotice(`Question ${index + 1} saved.`);
    } catch (e) {
      setError(e.message || "Failed to save question.");
    } finally {
      setSaving("");
    }
  };

  const addQuestion = () => {
    setQuestions(old => [...old, blankQuestion()]);
    setError("");
    setNotice("Fill in the new question and choose Save Question to add it to this test.");
  };

  return <TeacherLayout><div className="flex-1 min-w-0 bg-void text-chalk">
    <header className="border-b border-chalk-faint px-4 sm:px-8 py-5"><div className="max-w-5xl mx-auto">
      <button onClick={() => navigate("/test-creator/tests")} className="mb-3 inline-flex items-center gap-2 text-xs text-chalk-muted hover:text-chalk"><ArrowLeftIcon size={15}/> Back to My Tests</button>
      <p className="text-xs uppercase tracking-wider text-chalk-muted">Assessment Management</p><h1 className="mt-1 text-2xl sm:text-3xl font-semibold">Manage Questions</h1>
      <p className="mt-1 text-sm text-chalk-muted">{test?.title || "View and edit questions attached to this test."}</p>
    </div></header>
    <main className="max-w-5xl mx-auto w-full p-4 sm:p-8 space-y-4">
      {error && <div role="alert" className="rounded-xl border border-brand-red/40 bg-brand-red/10 p-3 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-success/30 bg-success-soft p-3 text-sm text-success">{notice}</div>}
      {loading ? <div className="rounded-xl border border-chalk-faint bg-panel p-10 text-center text-chalk-muted">Loading test questions…</div> : <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chalk-faint bg-panel p-4"><div><p className="font-semibold">{questions.length} questions</p><p className="text-xs text-chalk-muted mt-1">Only questions attached to this test are shown.</p></div><button type="button" onClick={addQuestion} disabled={Boolean(saving)} className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><PlusIcon size={15}/> Add Question</button></div>
        {!questions.length && <div className="rounded-xl border border-chalk-faint bg-panel p-10 text-center text-sm text-chalk-muted">No questions have been added to this test yet.</div>}
        {questions.map((q,qi)=><article key={q.id || `new-${qi}`} className="rounded-2xl border border-chalk-faint bg-panel p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Question {qi+1}</h2><span className="text-xs text-chalk-muted">{q.id ? "Saved question" : "New question — not saved yet"}</span></div>
          <label className="block space-y-1.5"><span className="text-xs font-semibold text-chalk-muted">Question text</span><textarea rows={3} className={inputClass} value={q.questionText} onChange={e=>patchQuestion(qi,{questionText:e.target.value})} placeholder="Write the question…"/></label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{q.options.map((o,oi)=><div key={oi} className="flex items-center gap-2"><button type="button" title="Mark correct answer" onClick={()=>patchQuestion(qi,{correctAnswer:oi})} className={`h-9 w-9 shrink-0 rounded-lg border text-xs font-bold ${q.correctAnswer===oi?"border-brand-gold bg-brand-gold text-[#2C1E04]":"border-chalk-faint text-chalk-muted"}`}>{String.fromCharCode(65+oi)}</button><input className={inputClass} value={o} onChange={e=>patchOption(qi,oi,e.target.value)} placeholder={`Option ${String.fromCharCode(65+oi)}`}/></div>)}</div>
          <div className="flex flex-wrap items-end gap-3"><label className="space-y-1.5"><span className="block text-xs text-chalk-muted">Marks</span><input type="number" min="0" className={`${inputClass} w-28`} value={q.marks} onChange={e=>patchQuestion(qi,{marks:e.target.value})}/></label><label className="space-y-1.5"><span className="block text-xs text-chalk-muted">Negative marks</span><input type="number" min="0" className={`${inputClass} w-32`} value={q.negativeMarks} onChange={e=>patchQuestion(qi,{negativeMarks:e.target.value})}/></label><label className="space-y-1.5"><span className="block text-xs text-chalk-muted">Difficulty</span><select className={inputClass} value={q.difficulty} onChange={e=>patchQuestion(qi,{difficulty:e.target.value})}>{["Easy","Medium","Hard"].map(v=><option key={v}>{v}</option>)}</select></label><button type="button" onClick={()=>saveQuestion(q,qi)} disabled={Boolean(saving)} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving===(q.id || `new-${qi}`)?"Saving…":<><CheckIcon size={15}/> Save Question</>}</button></div>
        </article>)}
      </>}
    </main>
  </div></TeacherLayout>;
}
export default ManageTestQuestions;
