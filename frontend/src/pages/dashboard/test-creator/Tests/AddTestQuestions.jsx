import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  CheckIcon,
  EyeIcon,
} from "../components/Icons";

function AddTestQuestions() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      let testRes = await fetchWithAuth(`/api/tests/${testId}`);
      if (!testRes.ok) {
        testRes = await fetchWithAuth(`/api/test-creation/${testId}`);
      }
      const questionsRes = await fetchWithAuth("/api/questions");

      const testData = await testRes.json();
      const questionsData = await questionsRes.json();

      if (!testRes.ok || !testData.success) {
        throw new Error(testData.message || "Failed to fetch test");
      }

      if (!questionsRes.ok) {
        throw new Error(questionsData.message || "Failed to fetch questions");
      }

      setTest(testData.test);
      setQuestions(questionsData.questions || []);
    } catch (err) {
      console.error("FETCH TEST QUESTIONS ERROR:", err);
      setError(err.message || "Failed to load test questions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [testId]);

  const isQuestionAdded = (questionId) => {
    const qIdStr = String(questionId);
    return (
      test?.questions?.some((q) => {
        const id = q._id || q.id || q;
        return String(id) === qIdStr;
      }) || false
    );
  };

  const handleAddQuestion = async (questionId) => {
    try {
      setAddingId(questionId);
      setMessage("");
      setError("");

      let response = await fetchWithAuth(`/api/tests/${testId}/questions`, {
        method: "POST",
        body: JSON.stringify({ questionId }),
      });

      if (!response.ok) {
        response = await fetchWithAuth(`/api/test-creation/${testId}/questions`, {
          method: "POST",
          body: JSON.stringify({ questionId }),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to add question");
      }

      setTest(data.test);
      setMessage("Question added to test.");
    } catch (err) {
      console.error("ADD QUESTION ERROR:", err);
      setError(err.message || "Failed to add question");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemoveQuestion = async (questionId) => {
    try {
      setAddingId(questionId);
      setMessage("");
      setError("");

      let response = await fetchWithAuth(`/api/tests/${testId}/questions`, {
        method: "DELETE",
        body: JSON.stringify({ questionId }),
      });

      if (!response.ok) {
        response = await fetchWithAuth(`/api/test-creation/${testId}/questions`, {
          method: "DELETE",
          body: JSON.stringify({ questionId }),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to remove question");
      }

      setTest(data.test);
      setMessage("Question removed from test.");
    } catch (err) {
      console.error("REMOVE QUESTION ERROR:", err);
      setError(err.message || "Failed to remove question");
    } finally {
      setAddingId(null);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      q.questionText?.toLowerCase().includes(s) ||
      q.question?.toLowerCase().includes(s) ||
      q.subject?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk p-12 text-center text-chalk-muted">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-red" />
          <p className="text-sm">Loading questions repository…</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Header */}
        <div className="border-b border-chalk-faint px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/test-creator/tests"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint flex items-center justify-center text-chalk transition shrink-0"
            >
              <ArrowLeftIcon size={16} />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
                Question Management
              </p>
              <h1 className="mt-1 font-display text-xl sm:text-2xl lg:text-3xl tracking-tight text-chalk truncate">
                {test?.title || "Add Questions"}
              </h1>
              <p className="text-xs text-chalk-muted mt-0.5">
                {test?.subject || "General"} • {test?.duration || 0} mins
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-chalk-faint bg-panel px-3.5 sm:px-4 py-2 text-right">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                Questions Added
              </p>
              <p className="text-base sm:text-lg font-bold text-chalk">
                {test?.questions?.length || 0}
              </p>
            </div>

            <Link
              to={`/test-creator/tests/${testId}/preview`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-red hover:bg-brand-red-dark px-3.5 sm:px-4 py-2.5 text-xs font-semibold text-chalk transition"
            >
              <EyeIcon size={14} />
              <span>Preview Test</span>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 space-y-5">
          {message && (
            <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {error}
            </div>
          )}

          {/* Search bar */}
          <div className="rounded-2xl border border-chalk-faint bg-panel p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions by text or subject domain…"
                className="flex-1 h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
              />
              <Link
                to="/test-creator/questions/add"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-4 py-2.5 text-xs font-semibold text-chalk transition shrink-0"
              >
                <PlusIcon size={14} />
                <span>New Question</span>
              </Link>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="rounded-2xl border border-chalk-faint bg-panel p-12 text-center text-chalk-muted">
                <p className="text-sm font-medium">No matching questions found.</p>
                <p className="text-xs mt-1">Try another search term or add questions to your bank.</p>
                <Link
                  to="/test-creator/questions/add"
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-red px-4 py-2 text-xs font-semibold text-chalk"
                >
                  <PlusIcon size={14} />
                  <span>Add Question to Bank</span>
                </Link>
              </div>
            ) : (
              filteredQuestions.map((question, idx) => {
                const qId = question.id || question._id;
                const added = isQuestionAdded(qId);
                const isWorking = addingId === qId;
                const qText = question.questionText || question.question || "Untitled Question";
                const options = question.options || [];

                return (
                  <div
                    key={qId}
                    className="rounded-2xl border border-chalk-faint bg-panel overflow-hidden hover:border-chalk-muted/30 transition"
                  >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-chalk-faint flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-panel-2/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-red-soft text-brand-red flex items-center justify-center font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-chalk">
                            Question {idx + 1}
                          </p>
                          {question.subject && (
                            <p className="text-[11px] text-chalk-muted">
                              {question.subject}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {question.difficulty && (
                          <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-panel-2 text-chalk-muted border border-chalk-faint capitalize">
                            {question.difficulty}
                          </span>
                        )}

                        <button
                          onClick={() => (added ? handleRemoveQuestion(qId) : handleAddQuestion(qId))}
                          disabled={isWorking}
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-50 ${
                            added
                              ? "bg-panel-2 hover:bg-brand-red/15 border border-chalk-faint hover:border-brand-red/30 text-chalk-muted hover:text-brand-red"
                              : "bg-brand-red hover:bg-brand-red-dark text-chalk"
                          }`}
                        >
                          {isWorking ? (
                            "Updating…"
                          ) : added ? (
                            <>
                              <CheckIcon size={14} />
                              <span>In Test (Remove)</span>
                            </>
                          ) : (
                            <>
                              <PlusIcon size={14} />
                              <span>Add to Test</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="p-5 sm:p-6 space-y-4">
                      <p className="text-sm sm:text-base font-medium text-chalk leading-relaxed">
                        {qText}
                      </p>

                      {options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {options.map((opt, oIdx) => {
                            const optText = typeof opt === "string" ? opt : opt.text || opt.optionText;
                            const isCorrect =
                              question.correctAnswer !== undefined &&
                              (question.correctAnswer === oIdx ||
                                question.correctAnswer === optText ||
                                opt.isCorrect);

                            return (
                              <div
                                key={oIdx}
                                className={`rounded-xl px-3.5 py-2.5 text-xs font-medium border flex items-center gap-2.5 ${
                                  isCorrect
                                    ? "bg-success-soft border-success/30 text-success"
                                    : "bg-panel-2/50 border-chalk-faint text-chalk-muted"
                                }`}
                              >
                                <span className="w-5 h-5 rounded-md bg-panel flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span className="truncate">{optText}</span>
                                {isCorrect && (
                                  <CheckIcon size={13} className="ml-auto text-success" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default AddTestQuestions;