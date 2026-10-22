import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import { ArrowLeftIcon, CheckIcon } from "../components/Icons";

const inputClass = "w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-gold focus:outline-none";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function PdfTestImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [marksPerQuestion, setMarksPerQuestion] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");
  const [questions, setQuestions] = useState([]);
  const [notes, setNotes] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [partialTestId, setPartialTestId] = useState("");

  const updateQuestion = (index, changes) => {
    setQuestions((current) => current.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...changes } : question
    ));
  };

  const handleExtract = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setNotes([]);
    setQuestions([]);
    if (!file) {
      setError("Choose a PDF question paper first.");
      return;
    }
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("The PDF must be 15 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("pdf", file);
    try {
      setExtracting(true);
      const response = await fetchWithAuth("/api/tests/import-pdf", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not extract questions from this PDF.");
      }
      const extracted = (data.questions || []).map((question) => ({
        ...question,
        questionText: question.questionText || "",
        options: Array.isArray(question.options) ? question.options : ["", ""],
        correctAnswer: Number.isInteger(question.correctAnswer) ? question.correctAnswer : null,
        verified: false,
        answerSource: question.answerSource || "needs_manual",
      }));
      setQuestions(extracted);
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setMessage(`Extracted ${extracted.length} draft question(s). Review every question and answer before saving.`);
      if (!title.trim()) setTitle(file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));
    } catch (err) {
      setError(err.message || "PDF extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const allQuestionsVerified = questions.length > 0 && questions.every((question) =>
    question.questionText.trim() &&
    question.options.length >= 2 &&
    question.options.every((option) => String(option).trim()) &&
    Number.isInteger(question.correctAnswer) &&
    question.correctAnswer >= 0 &&
    question.correctAnswer < question.options.length &&
    question.verified
  );

  const handleSave = async () => {
    setError("");
    setMessage("");
    if (!title.trim() || !subject.trim() || !Number.isFinite(Number(duration)) || Number(duration) < 1) {
      setError("Enter a test title, subject, and valid duration.");
      return;
    }
    if (isPaid && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
      setError("Enter a valid price for this paid test.");
      return;
    }
    if (!allQuestionsVerified) {
      setError("Review every question, select its correct answer, and confirm that you verified it before saving.");
      return;
    }

    let createdTestId = "";
    try {
      setSaving(true);
      const testResponse = await fetchWithAuth("/api/tests", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim(),
          duration: Number(duration),
          marksPerQuestion: Number(marksPerQuestion) || 1,
          negativeMarks: Number(negativeMarks) || 0,
          isPaid,
          is_paid: isPaid,
          price: isPaid ? Number(price) : 0,
        }),
      });
      const testData = await testResponse.json().catch(() => ({}));
      if (!testResponse.ok || !testData.success) {
        throw new Error(testData.message || "Could not create the test.");
      }
      createdTestId = String(testData.test?.id || testData.test?._id || "");
      if (!createdTestId) throw new Error("The test was created, but the server did not return its ID.");
      setPartialTestId(createdTestId);

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        const questionResponse = await fetchWithAuth("/api/questions", {
          method: "POST",
          body: JSON.stringify({
            questionText: question.questionText.trim(),
            questionImage: "",
            options: question.options.map((option) => String(option).trim()),
            correctAnswer: Number(question.correctAnswer),
            marks: Number(question.marks) || Number(marksPerQuestion) || 1,
            negativeMarks: Number(question.negativeMarks) || Number(negativeMarks) || 0,
            subject: question.subject?.trim() || subject.trim(),
            difficulty: question.difficulty || "Medium",
          }),
        });
        const questionData = await questionResponse.json().catch(() => ({}));
        if (!questionResponse.ok || !questionData.success) {
          throw new Error(`Test draft created, but question ${index + 1} could not be saved: ${questionData.message || "unknown error"}`);
        }
        const questionId = questionData.question?.id || questionData.question?._id;
        if (!questionId) throw new Error(`Question ${index + 1} was saved without an ID. Test draft: ${createdTestId}`);

        const attachResponse = await fetchWithAuth(`/api/tests/${createdTestId}/questions`, {
          method: "POST",
          body: JSON.stringify({ questionId }),
        });
        const attachData = await attachResponse.json().catch(() => ({}));
        if (!attachResponse.ok || !attachData.success) {
          throw new Error(`Question ${index + 1} was saved but could not be attached to the test. Test draft: ${createdTestId}`);
        }
      }

      setMessage("Test and reviewed questions saved successfully. Your test remains a draft until you publish it.");
      navigate(`/test-creator/tests/${createdTestId}/preview`);
    } catch (err) {
      setError(err.message || "Could not save the imported test.");
      if (createdTestId) {
        setMessage(`A test draft was created (ID: ${createdTestId}). You can open it to continue if a later save step failed.`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="flex-1 min-w-0 bg-void text-chalk">
        <header className="border-b border-chalk-faint px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/test-creator/tests" className="w-10 h-10 rounded-xl bg-panel-2 border border-chalk-faint flex items-center justify-center">
              <ArrowLeftIcon size={16} />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">Assessment Management</p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl">Create Test from PDF</h1>
              <p className="mt-1 text-sm text-chalk-muted">Import a paper, review AI-extracted questions, then save a draft.</p>
            </div>
          </div>
          <Link to="/test-creator/tests/create" className={`${buttonClass} border border-chalk-faint bg-panel-2 text-chalk`}>Use manual creation instead</Link>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
          {error && <div role="alert" className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}
          {message && <div role="status" className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">{message}</div>}

          <form onSubmit={handleExtract} className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg">1. Upload question paper</h2>
              <p className="mt-1 text-sm text-chalk-muted">PDF only, up to 15 MB. Extraction can read text and page images. Non-MCQ and numeric-entry questions are flagged in notes for manual handling.</p>
            </div>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">Question paper PDF</span>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-chalk file:mr-4 file:rounded-lg file:border-0 file:bg-panel-2 file:px-4 file:py-2 file:text-chalk" />
              {file && <span className="mt-2 block text-xs text-chalk-muted">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>}
            </label>
            <button type="submit" disabled={extracting || !file} className={`${buttonClass} bg-brand-gold text-void hover:opacity-90`}>
              {extracting ? "Extracting questions…" : "Extract questions with AI"}
            </button>
          </form>

          {questions.length > 0 && (
            <>
              <section className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-lg">2. Configure test</h2>
                  <p className="mt-1 text-sm text-chalk-muted">The test will be saved as a draft. Review all answers before saving.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-xs font-semibold text-chalk-muted">Test title *
                    <input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-2`} maxLength={160} />
                  </label>
                  <label className="text-xs font-semibold text-chalk-muted">Subject *
                    <input required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. SAT Mathematics" className={`${inputClass} mt-2`} maxLength={120} />
                  </label>
                  <label className="text-xs font-semibold text-chalk-muted">Duration (minutes) *
                    <input required type="number" min="1" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-xs font-semibold text-chalk-muted">Default marks per question
                    <input type="number" min="0" step="0.25" value={marksPerQuestion} onChange={(event) => setMarksPerQuestion(event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-xs font-semibold text-chalk-muted">Default negative marks
                    <input type="number" min="0" step="0.25" value={negativeMarks} onChange={(event) => setNegativeMarks(event.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="text-xs font-semibold text-chalk-muted">Description
                    <input value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-2`} maxLength={1000} />
                  </label>
                </div>
                <label className="flex items-center gap-3 text-sm text-chalk">
                  <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} />
                  Paid test
                </label>
                {isPaid && (
                  <label className="block text-xs font-semibold text-chalk-muted">Price (INR) *
                    <input required type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} className={`${inputClass} mt-2 sm:max-w-xs`} />
                  </label>
                )}
              </section>

              {notes.length > 0 && (
                <section className="rounded-2xl border border-brand-gold/30 bg-brand-gold-soft/20 p-5">
                  <h3 className="font-semibold">Extraction notes</h3>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-chalk-muted">
                    {notes.map((note, index) => <li key={index}>{note}</li>)}
                  </ul>
                </section>
              )}

              <section className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-lg">3. Review questions ({questions.length})</h2>
                    <p className="mt-1 text-sm text-chalk-muted">Edit extracted content, choose the correct option, and check the verification box for every question.</p>
                  </div>
                  <span className="text-xs text-chalk-muted">{questions.filter((question) => question.verified).length} / {questions.length} verified</span>
                </div>

                {questions.map((question, index) => (
                  <article key={question.id || index} className="rounded-2xl border border-chalk-faint bg-panel p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold">Question {index + 1}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${question.answerSource === "provided" ? "bg-success-soft text-success" : question.answerSource === "ai_suggested" ? "bg-brand-gold-soft text-brand-gold" : "bg-panel-2 text-chalk-muted"}`}>
                        {question.answerSource === "provided" ? "Answer key detected" : question.answerSource === "ai_suggested" ? "AI-suggested answer" : "Answer required"}
                      </span>
                    </div>
                    <label className="block text-xs font-semibold text-chalk-muted">Question text
                      <textarea value={question.questionText} onChange={(event) => updateQuestion(index, { questionText: event.target.value, verified: false })} rows={3} className={`${inputClass} mt-2 resize-y`} />
                    </label>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">Options · select the correct answer</p>
                      {question.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-3">
                          <input aria-label={`Mark option ${optionIndex + 1} as correct for question ${index + 1}`} type="radio" name={`correct-${index}`} checked={question.correctAnswer === optionIndex} onChange={() => updateQuestion(index, { correctAnswer: optionIndex, verified: false })} />
                          <input aria-label={`Option ${optionIndex + 1}`} value={option} onChange={(event) => updateQuestion(index, { options: question.options.map((value, i) => i === optionIndex ? event.target.value : value), verified: false })} className={inputClass} />
                        </div>
                      ))}
                    </div>
                    {question.explanation && <p className="text-sm text-chalk-muted"><strong>Explanation to check:</strong> {question.explanation}</p>}
                    <label className="flex items-start gap-2.5 text-sm text-chalk">
                      <input type="checkbox" checked={question.verified} onChange={(event) => updateQuestion(index, { verified: event.target.checked })} className="mt-0.5" />
                      <span>I reviewed this question and verified the correct answer.</span>
                    </label>
                  </article>
                ))}
              </section>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleSave} disabled={saving || !allQuestionsVerified} className={`${buttonClass} bg-brand-red text-white hover:opacity-90`}>
                  {saving ? "Saving test and questions…" : <><CheckIcon size={15} /> Save reviewed test as draft</>}
                </button>
                <Link to="/test-creator/tests" className={`${buttonClass} border border-chalk-faint bg-panel-2 text-chalk`}>Cancel</Link>
              </div>
              {partialTestId && <p className="text-xs text-chalk-muted">Draft ID: {partialTestId}</p>}
            </>
          )}
        </main>
      </div>
    </TeacherLayout>
  );
}

export default PdfTestImport;
