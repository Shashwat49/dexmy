import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import {
  ArrowLeftIcon,
  CheckIcon,
  EditIcon,
  PlusIcon,
} from "../components/Icons";

function TestPreview() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        setError("");

        let response = await fetchWithAuth(`/api/tests/${testId}`);
        if (!response.ok) {
          response = await fetchWithAuth(`/api/test-creation/${testId}`);
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to fetch test");
        }

        setTest(data.test);
      } catch (err) {
        console.error("FETCH TEST ERROR:", err);
        setError(err.message || "Failed to load test");
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId]);

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk p-12 text-center text-chalk-muted">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-red" />
          <p className="text-sm">Loading test preview…</p>
        </div>
      </TeacherLayout>
    );
  }

  if (error || !test) {
    return (
      <TeacherLayout>
        <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk p-12 text-center">
          <div className="rounded-2xl border border-chalk-faint bg-panel p-8 sm:p-10 max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-chalk">Unable to load test</h2>
            <p className="text-sm text-brand-red mt-2">{error || "Test not found"}</p>
            <Link
              to="/test-creator/tests"
              className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-red px-5 py-2.5 text-xs sm:text-sm font-semibold text-chalk transition"
            >
              <ArrowLeftIcon size={14} />
              <span>Back to My Tests</span>
            </Link>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  const questions = test.questions || [];
  const isPaid = Boolean(test.isPaid || test.is_paid);
  const isPub = Boolean(test.isPublished || test.is_published);
  const currentId = test.id || test._id;

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
                Test Preview
              </p>
              <h1 className="mt-1 font-display text-xl sm:text-2xl lg:text-3xl tracking-tight text-chalk truncate">
                {test.title}
              </h1>
              <p className="text-xs text-chalk-muted mt-0.5">
                {test.subject || "General"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to={`/test-creator/tests/${currentId}/edit`}
              className="inline-flex items-center gap-1 px-3.5 sm:px-4 py-2 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-xs font-medium text-chalk transition"
            >
              <EditIcon size={13} />
              <span>Edit Test</span>
            </Link>
            <Link
              to={`/test-creator/tests/${currentId}/questions`}
              className="inline-flex items-center gap-1 px-3.5 sm:px-4 py-2 rounded-xl bg-brand-red hover:bg-brand-red-dark text-xs font-semibold text-chalk transition"
            >
              <PlusIcon size={13} />
              <span>Manage Questions</span>
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 space-y-6">
          {/* Summary Box */}
          <div className="rounded-2xl border border-chalk-faint bg-panel overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-chalk-faint flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-chalk-muted">
                  Configuration Summary
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isPub
                        ? "bg-success-soft text-success border border-success/30"
                        : "bg-brand-gold-soft text-brand-gold border border-brand-gold/30"
                    }`}
                  >
                    {isPub ? "Published" : "Draft"}
                  </span>

                  {isPaid ? (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-gold-soft text-brand-gold border border-brand-gold/30">
                      Paid Assessment • ₹{test.price || 499}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-panel-2 text-chalk-muted border border-chalk-faint">
                      Free Assessment
                    </span>
                  )}
                </div>
              </div>

              {test.description && (
                <p className="text-xs text-chalk-muted max-w-xl leading-relaxed">
                  {test.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 bg-panel-2/30">
              <div className="p-3.5 sm:p-4 sm:px-6">
                <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                  Total Questions
                </p>
                <p className="text-base sm:text-lg font-semibold text-chalk mt-0.5">
                  {questions.length}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 sm:px-6 border-l border-chalk-faint">
                <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                  Duration
                </p>
                <p className="text-base sm:text-lg font-semibold text-chalk mt-0.5">
                  {test.duration} mins
                </p>
              </div>

              <div className="p-3.5 sm:p-4 sm:px-6 border-l border-chalk-faint">
                <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                  Marks / Q
                </p>
                <p className="text-base sm:text-lg font-semibold text-chalk mt-0.5">
                  {test.marksPerQuestion ?? 1}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 sm:px-6 border-l border-chalk-faint">
                <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                  Negative Mark
                </p>
                <p className="text-base sm:text-lg font-semibold text-chalk mt-0.5">
                  {test.negativeMarks ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-chalk">
                Test Questions ({questions.length})
              </h2>
              <Link
                to={`/test-creator/tests/${currentId}/questions`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-gold hover:underline"
              >
                <PlusIcon size={12} />
                <span>Add More Questions</span>
              </Link>
            </div>

            {questions.length === 0 ? (
              <div className="rounded-2xl border border-chalk-faint bg-panel p-10 text-center text-chalk-muted">
                <p className="text-sm">No questions have been added to this test yet.</p>
                <Link
                  to={`/test-creator/tests/${currentId}/questions`}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-red px-5 py-2.5 text-xs font-semibold text-chalk transition"
                >
                  <PlusIcon size={14} />
                  <span>Add Questions Now</span>
                </Link>
              </div>
            ) : (
              questions.map((q, idx) => {
                const qText = q.questionText || q.question || "Question";
                const opts = q.options || [];

                return (
                  <div
                    key={q.id || q._id || idx}
                    className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-brand-red-soft text-brand-red flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-chalk-muted">
                          {q.subject || test.subject || "Question"}
                        </span>
                      </div>
                      {q.difficulty && (
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-panel-2 text-chalk-muted border border-chalk-faint capitalize">
                          {q.difficulty}
                        </span>
                      )}
                    </div>

                    <p className="text-sm sm:text-base font-medium text-chalk leading-relaxed">
                      {qText}
                    </p>

                    {opts.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {opts.map((opt, oIdx) => {
                          const optText = typeof opt === "string" ? opt : opt.text || opt.optionText;
                          const isCorrect =
                            q.correctAnswer !== undefined &&
                            (q.correctAnswer === oIdx ||
                              q.correctAnswer === optText ||
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
                                <CheckIcon size={12} className="ml-auto text-success" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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

export default TestPreview;