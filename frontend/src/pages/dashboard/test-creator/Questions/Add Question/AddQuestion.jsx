import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "../../components/TeacherLayout";
import { fetchWithAuth } from "../../src/api";
import { ArrowLeftIcon, CloseIcon } from "../../components/Icons";

function AddQuestion() {
  const navigate = useNavigate();

  const [questionText, setQuestionText] = useState("");
  const [subject, setSubject] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [difficulty, setDifficulty] = useState("Medium");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const handleOptionChange = (index, value) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index) => {
    if (options.length <= 2) return;
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
    if (correctAnswer >= updated.length) {
      setCorrectAnswer(updated.length - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!questionText.trim()) {
      setMessage("Please enter the question text.");
      setMessageType("error");
      return;
    }

    if (options.some((opt) => !opt.trim())) {
      setMessage("Please fill all option fields.");
      setMessageType("error");
      return;
    }

    try {
      setLoading(true);

      const response = await fetchWithAuth("/api/questions", {
        method: "POST",
        body: JSON.stringify({
          questionText: questionText.trim(),
          subject: subject.trim() || "General",
          options: options.map((opt) => opt.trim()),
          correctAnswer,
          marks: Number(marks),
          negativeMarks: Number(negativeMarks),
          difficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create question");
      }

      setMessage("Question added to question bank successfully.");
      setMessageType("success");

      setQuestionText("");
      setSubject("");
      setOptions(["", "", "", ""]);
      setCorrectAnswer(0);

      setTimeout(() => {
        navigate("/test-creator/questions");
      }, 1000);
    } catch (err) {
      setMessage(err.message || "Failed to create question");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Header */}
        <div className="border-b border-chalk-faint px-6 lg:px-8 py-5.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/test-creator/questions"
              className="w-10 h-10 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint flex items-center justify-center text-chalk transition shrink-0"
            >
              <ArrowLeftIcon size={18} />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
                Question Bank
              </p>
              <h1 className="mt-1 font-display text-2xl sm:text-3xl tracking-tight text-chalk">
                Add New Question
              </h1>
              <p className="text-xs text-chalk-muted mt-0.5">
                Create a reusable question with multiple choice options.
              </p>
            </div>
          </div>

          <Link
            to="/test-creator/questions"
            className="rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-4 py-2 text-xs font-medium text-chalk transition"
          >
            Cancel
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 lg:px-8 py-7">
          <div className="max-w-4xl mx-auto">
            {message && (
              <div
                className={`mb-6 rounded-xl border px-5 py-3.5 text-sm ${
                  messageType === "success"
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-brand-red/30 bg-brand-red/10 text-brand-red"
                }`}
              >
                {message}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-7 space-y-6"
            >
              <div>
                <h2 className="text-base font-semibold text-chalk">Question Information</h2>
                <p className="text-xs text-chalk-muted mt-0.5">
                  Define the question statement and topic category
                </p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                  Subject / Topic Domain
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. General Knowledge, Quantitative, Logic"
                  className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                />
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                  Question Text <span className="text-brand-red">*</span>
                </label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows="3"
                  placeholder="Enter the question statement clearly..."
                  required
                  className="w-full rounded-xl border border-chalk-faint bg-panel-2 px-4 py-3 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition resize-none"
                />
              </div>

              {/* Options */}
              <div className="pt-4 border-t border-chalk-faint space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-chalk">Options & Correct Answer</h3>
                    <p className="text-xs text-chalk-muted">
                      Select the radio button next to the correct choice
                    </p>
                  </div>
                  {options.length < 6 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-xs font-semibold text-brand-gold hover:underline"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <label className="relative flex items-center cursor-pointer p-1">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={correctAnswer === idx}
                          onChange={() => setCorrectAnswer(idx)}
                          className="w-4 h-4 text-brand-red bg-panel-2 border-chalk-faint focus:ring-brand-red"
                        />
                      </label>
                      <span className="w-6 h-6 rounded-lg bg-panel-2 flex items-center justify-center font-bold text-xs text-chalk-muted shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + idx)} text...`}
                        required
                        className="flex-1 h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                      />
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(idx)}
                          className="w-9 h-9 rounded-xl bg-panel-2 hover:bg-brand-red/20 text-chalk-muted hover:text-brand-red flex items-center justify-center transition"
                        >
                          <CloseIcon size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Marking & Difficulty */}
              <div className="pt-4 border-t border-chalk-faint grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk focus:border-brand-red focus:outline-none transition"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Marks
                  </label>
                  <input
                    type="number"
                    value={marks}
                    onChange={(e) => setMarks(e.target.value)}
                    min="1"
                    className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk focus:border-brand-red focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Negative Marks
                  </label>
                  <input
                    type="number"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(e.target.value)}
                    min="0"
                    step="0.25"
                    className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk focus:border-brand-red focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-6 border-t border-chalk-faint flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-brand-red hover:bg-brand-red-dark px-6 py-3 text-sm font-semibold text-chalk transition disabled:opacity-60"
                >
                  {loading ? "Saving Question..." : "Save Question to Bank"}
                </button>
                <Link
                  to="/test-creator/questions"
                  className="rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-5 py-3 text-sm font-medium text-chalk transition"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default AddQuestion;