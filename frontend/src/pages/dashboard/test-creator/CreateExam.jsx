import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "./components/TeacherLayout";
import { fetchWithAuth } from "./src/api";
import { ArrowLeftIcon, PlusIcon, CloseIcon, CheckIcon } from "./components/Icons";

const emptyQuestion = () => ({
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  marks: "1",
  negativeMarks: "0",
  difficulty: "Medium",
});

const fieldClass = "w-full rounded-xl border border-chalk-faint bg-panel-2 px-3.5 py-2.5 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";

function CreateExam() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    duration: "60",
    marksPerQuestion: "1",
    negativeMarks: "0",
    isPaid: false,
    price: "",
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updateQuestion = (index, patch) => {
    setQuestions((current) => current.map((question, i) => i === index ? { ...question, ...patch } : question));
  };

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((question, i) => i === questionIndex
      ? { ...question, options: question.options.map((option, j) => j === optionIndex ? value : option) }
      : question));
  };

  const addOption = (questionIndex) => {
    setQuestions((current) => current.map((question, i) =>
      i === questionIndex && question.options.length < 5
        ? { ...question, options: [...question.options, ""] }
        : question
    ));
  };

  const removeOption = (questionIndex, optionIndex) => {
    setQuestions((current) => current.map((question, i) => {
      if (i !== questionIndex || question.options.length <= 2) return question;
      const options = question.options.filter((_, j) => j !== optionIndex);
      let correctAnswer = question.correctAnswer;
      if (correctAnswer === optionIndex) correctAnswer = 0;
      else if (correctAnswer > optionIndex) correctAnswer -= 1;
      return { ...question, options, correctAnswer };
    }));
  };

  const validate = () => {
    if (!formData.title.trim() || !formData.subject.trim()) return "Enter a test title and subject.";
    if (!Number.isFinite(Number(formData.duration)) || Number(formData.duration) < 1) return "Duration must be at least 1 minute.";
    if (formData.isPaid && (!Number.isFinite(Number(formData.price)) || Number(formData.price) <= 0)) return "Enter a valid price for this paid test.";
    if (!questions.length) return "Add at least one question.";
    for (let i = 0; i < questions.length; i += 1) {
      const question = questions[i];
      if (!question.questionText.trim()) return `Enter the text for question ${i + 1}.`;
      if (question.options.length < 2 || question.options.some((option) => !option.trim())) return `Fill every option for question ${i + 1}.`;
      if (!Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer >= question.options.length) return `Choose the correct answer for question ${i + 1}.`;
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    let createdTestId = "";
    try {
      setLoading(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        subject: formData.subject.trim(),
        duration: Number(formData.duration),
        marksPerQuestion: Number(formData.marksPerQuestion) || 1,
        negativeMarks: Number(formData.negativeMarks) || 0,
        isPaid: Boolean(formData.isPaid),
        is_paid: Boolean(formData.isPaid),
        price: formData.isPaid ? Number(formData.price) : 0,
      };

      let testResponse = await fetchWithAuth("/api/tests", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!testResponse.ok) {
        testResponse = await fetchWithAuth("/api/test-creation", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      const testData = await testResponse.json().catch(() => ({}));
      if (!testResponse.ok || !testData.success) throw new Error(testData.message || "Failed to create test.");

      createdTestId = String(testData.test?.id || testData.test?._id || "");
      if (!createdTestId) throw new Error("Test created, but no test ID was returned.");

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        const questionPayload = {
          questionText: question.questionText.trim(),
          subject: formData.subject.trim(),
          options: question.options.map((option) => option.trim()),
          correctAnswer: Number(question.correctAnswer),
          marks: Number(question.marks) || Number(formData.marksPerQuestion) || 1,
          negativeMarks: Number(question.negativeMarks) || Number(formData.negativeMarks) || 0,
          difficulty: question.difficulty,
        };
        const questionResponse = await fetchWithAuth("/api/questions", {
          method: "POST",
          body: JSON.stringify(questionPayload),
        });
        const questionData = await questionResponse.json().catch(() => ({}));
        if (!questionResponse.ok || !questionData.success) {
          throw new Error(`Test draft created, but question ${index + 1} could not be saved: ${questionData.message || "unknown error"}. Draft ID: ${createdTestId}`);
        }
        const questionId = questionData.question?.id || questionData.question?._id;
        if (!questionId) throw new Error(`Question ${index + 1} was saved without an ID. Draft ID: ${createdTestId}`);

        let attachResponse = await fetchWithAuth(`/api/tests/${createdTestId}/questions`, {
          method: "POST",
          body: JSON.stringify({ questionId }),
        });
        if (!attachResponse.ok) {
          attachResponse = await fetchWithAuth(`/api/test-creation/${createdTestId}/questions`, {
            method: "POST",
            body: JSON.stringify({ questionId }),
          });
        }
        const attachData = await attachResponse.json().catch(() => ({}));
        if (!attachResponse.ok || !attachData.success) {
          throw new Error(`Question ${index + 1} was saved but could not be attached. Draft ID: ${createdTestId}`);
        }
      }

      navigate(`/test-creator/tests/${createdTestId}/preview`);
    } catch (err) {
      setError(err.message || "Something went wrong while creating the test.");
      if (createdTestId) setNotice(`Your test draft ID is ${createdTestId}. Open My Tests to continue if a later step failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="flex-1 min-w-0 bg-void text-chalk">
        <header className="border-b border-chalk-faint px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/test-creator/tests" aria-label="Back to tests" className="w-10 h-10 rounded-xl bg-panel-2 border border-chalk-faint flex items-center justify-center"><ArrowLeftIcon size={16} /></Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">Assessment Management</p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl">Create a Test</h1>
              <p className="mt-1 text-sm text-chalk-muted">Enter test details and write questions directly—no uploads or separate question-bank steps required.</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {error && <div role="alert" className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">{error}</div>}
          {notice && <div role="status" className="rounded-xl border border-brand-gold/30 bg-brand-gold-soft/20 px-4 py-3 text-sm text-chalk">{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-lg">1. Test details</h2>
                <p className="mt-1 text-sm text-chalk-muted">Set the basic information, duration, marking and pricing.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-xs font-semibold text-chalk-muted">Test title *
                  <input required maxLength={160} name="title" value={formData.title} onChange={handleChange} placeholder="e.g. SAT Mathematics Practice Test" className={`${fieldClass} mt-2`} />
                </label>
                <label className="text-xs font-semibold text-chalk-muted">Subject *
                  <input required maxLength={120} name="subject" value={formData.subject} onChange={handleChange} placeholder="e.g. SAT Mathematics" className={`${fieldClass} mt-2`} />
                </label>
                <label className="text-xs font-semibold text-chalk-muted">Duration (minutes) *
                  <input required type="number" min="1" max="600" name="duration" value={formData.duration} onChange={handleChange} className={`${fieldClass} mt-2`} />
                </label>
                <label className="text-xs font-semibold text-chalk-muted">Default marks per question
                  <input type="number" min="0" step="0.25" name="marksPerQuestion" value={formData.marksPerQuestion} onChange={handleChange} className={`${fieldClass} mt-2`} />
                </label>
                <label className="text-xs font-semibold text-chalk-muted">Default negative marks
                  <input type="number" min="0" step="0.25" name="negativeMarks" value={formData.negativeMarks} onChange={handleChange} className={`${fieldClass} mt-2`} />
                </label>
                <label className="text-xs font-semibold text-chalk-muted">Description (optional)
                  <textarea rows={2} name="description" value={formData.description} onChange={handleChange} className={`${fieldClass} mt-2 resize-y`} />
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm text-chalk">
                <input type="checkbox" name="isPaid" checked={formData.isPaid} onChange={handleChange} />
                Paid test
              </label>
              {formData.isPaid && <label className="block text-xs font-semibold text-chalk-muted sm:max-w-xs">Price (INR) *
                <input required type="number" min="1" name="price" value={formData.price} onChange={handleChange} className={`${fieldClass} mt-2`} />
              </label>}
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg">2. Add questions</h2>
                  <p className="mt-1 text-sm text-chalk-muted">Write your questions below and select the correct answer. Each question supports 2–5 options.</p>
                </div>
                <button type="button" onClick={() => setQuestions((current) => [...current, emptyQuestion()])} className={`${buttonClass} border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10`}>
                  <PlusIcon size={15} /> Add question
                </button>
              </div>

              {questions.map((question, index) => (
                <article key={index} className="rounded-2xl border border-chalk-faint bg-panel p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Question {index + 1}</h3>
                    {questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} className="inline-flex items-center gap-1.5 text-xs text-brand-red hover:underline"><CloseIcon size={14} /> Remove</button>}
                  </div>
                  <label className="block text-xs font-semibold text-chalk-muted">Question text *
                    <textarea required rows={3} value={question.questionText} onChange={(event) => updateQuestion(index, { questionText: event.target.value })} className={`${fieldClass} mt-2 resize-y`} placeholder="Enter the question…" />
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">Options · select the correct answer</p>
                      {question.options.length < 6 && <button type="button" onClick={() => addOption(index)} className="text-xs font-semibold text-brand-gold hover:underline">+ Add option</button>}
                    </div>
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input aria-label={`Correct answer option ${optionIndex + 1} for question ${index + 1}`} type="radio" name={`correct-${index}`} checked={question.correctAnswer === optionIndex} onChange={() => updateQuestion(index, { correctAnswer: optionIndex })} />
                        <span className="w-6 text-xs font-semibold text-chalk-muted">{String.fromCharCode(65 + optionIndex)}</span>
                        <input required aria-label={`Option ${optionIndex + 1} for question ${index + 1}`} value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} className={fieldClass} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} />
                        {question.options.length > 2 && <button type="button" aria-label={`Remove option ${optionIndex + 1}`} onClick={() => removeOption(index, optionIndex)} className="p-2 text-chalk-muted hover:text-brand-red"><CloseIcon size={14} /></button>}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="text-xs font-semibold text-chalk-muted">Marks
                      <input type="number" min="0" step="0.25" value={question.marks} onChange={(event) => updateQuestion(index, { marks: event.target.value })} className={`${fieldClass} mt-2`} />
                    </label>
                    <label className="text-xs font-semibold text-chalk-muted">Negative marks
                      <input type="number" min="0" step="0.25" value={question.negativeMarks} onChange={(event) => updateQuestion(index, { negativeMarks: event.target.value })} className={`${fieldClass} mt-2`} />
                    </label>
                    <label className="text-xs font-semibold text-chalk-muted">Difficulty
                      <select value={question.difficulty} onChange={(event) => updateQuestion(index, { difficulty: event.target.value })} className={`${fieldClass} mt-2`}>
                        <option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </section>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={loading} className={`${buttonClass} bg-brand-red text-white hover:bg-brand-red-dark`}>
                {loading ? "Saving test and questions…" : <><CheckIcon size={15} /> Save test as draft</>}
              </button>
              <button type="button" disabled={loading} onClick={() => navigate("/test-creator/tests")} className={`${buttonClass} border border-chalk-faint bg-panel-2 text-chalk`}>Cancel</button>
            </div>
          </form>
        </main>
      </div>
    </TeacherLayout>
  );
}

export default CreateExam;
