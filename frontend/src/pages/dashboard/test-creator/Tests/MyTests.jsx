import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import {
  PlusIcon,
  TestsIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
} from "../components/Icons";

function MyTests() {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTests = async () => {
    try {
      setLoading(true);
      setError("");
      let response = await fetchWithAuth("/api/tests");
      if (!response.ok) {
        response = await fetchWithAuth("/api/test-creation");
      }

      const data = await response.json();

      if (data.success) {
        setTests(data.tests || []);
      } else {
        setError(data.message || "Failed to load tests.");
      }
    } catch (err) {
      console.error("Failed to fetch tests:", err);
      setError("Unable to connect to test server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handlePublishToggle = async (test) => {
    try {
      const testId = test.id || test._id;
      let response = await fetchWithAuth(`/api/tests/${testId}/publish`, {
        method: "PATCH",
      });
      if (!response.ok) {
        response = await fetchWithAuth(`/api/test-creation/${testId}/publish`, {
          method: "PATCH",
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update test status");
      }

      setTests((prevTests) =>
        prevTests.map((item) => {
          const itemId = item.id || item._id;
          if (itemId === testId) {
            const newPub = data.test?.isPublished ?? data.test?.is_published ?? !item.isPublished;
            return {
              ...item,
              isPublished: newPub,
              is_published: newPub,
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.error("PUBLISH TEST ERROR:", err);
      alert(err.message || "Failed to update test status");
    }
  };

  const handleDelete = async (test) => {
    const testId = test.id || test._id;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${test.title}"?`
    );
    if (!confirmed) return;

    try {
      let response = await fetchWithAuth(`/api/tests/${testId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        response = await fetchWithAuth(`/api/test-creation/${testId}`, {
          method: "DELETE",
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete test");
      }

      setTests((prev) => prev.filter((item) => (item.id || item._id) !== testId));
    } catch (err) {
      console.error("DELETE TEST ERROR:", err);
      alert(err.message || "Failed to delete test");
    }
  };

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Header */}
        <div className="border-b border-chalk-faint px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
              Assessment Management
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl tracking-tight text-chalk">
              My Tests
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-chalk-muted">
              Manage, publish, and monitor your created assessments.
            </p>
          </div>

          <Link
            to="/test-creator/tests/create"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red hover:bg-brand-red-dark px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-chalk transition shadow-sm self-start sm:self-auto"
          >
            <PlusIcon size={16} />
            <span>Create Test</span>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
          {error && (
            <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red flex items-center justify-between">
              <span>{error}</span>
              <button onClick={fetchTests} className="underline text-xs ml-4">
                Retry
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="rounded-2xl border border-chalk-faint bg-panel p-12 text-center text-chalk-muted">
              <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-red" />
              <p className="text-sm">Loading your tests…</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && tests.length === 0 && (
            <div className="rounded-2xl border border-chalk-faint bg-panel p-12 text-center max-w-lg mx-auto">
              <div className="w-12 h-12 mx-auto rounded-xl bg-brand-red-soft text-brand-red flex items-center justify-center mb-3">
                <TestsIcon size={24} />
              </div>
              <h2 className="text-lg font-semibold text-chalk">No tests created yet</h2>
              <p className="text-sm text-chalk-muted mt-1">
                Create your first test to make it available to students.
              </p>
              <Link
                to="/test-creator/tests/create"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red hover:bg-brand-red-dark px-5 py-2.5 text-sm font-semibold text-chalk transition"
              >
                <PlusIcon size={16} />
                <span>Create Test</span>
              </Link>
            </div>
          )}

          {/* Test Cards Grid */}
          {!loading && tests.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {tests.map((test) => {
                const testId = test.id || test._id;
                const isPaid = Boolean(test.is_paid || test.isPaid);
                const isPub = Boolean(test.isPublished || test.is_published);

                return (
                  <div
                    key={testId}
                    className="rounded-2xl border border-chalk-faint bg-panel overflow-hidden hover:border-chalk-muted/30 transition flex flex-col justify-between"
                  >
                    {/* Top Info */}
                    <div className="p-5 sm:p-6 border-b border-chalk-faint">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-brand-red-soft text-brand-red border border-brand-red/30 flex items-center justify-center shrink-0">
                            <TestsIcon size={18} />
                          </div>
                          <div className="min-w-0">
                            <h2 className="font-semibold text-base text-chalk truncate">
                              {test.title}
                            </h2>
                            <p className="text-xs text-chalk-muted mt-0.5">
                              {test.subject || "General"}
                            </p>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isPaid ? (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-gold-soft text-brand-gold border border-brand-gold/30">
                              Paid • ₹{test.price || 499}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-panel-2 text-chalk-muted border border-chalk-faint">
                              Free
                            </span>
                          )}

                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                              isPub
                                ? "bg-success-soft text-success border border-success/30"
                                : "bg-brand-gold-soft text-brand-gold border border-brand-gold/30"
                            }`}
                          >
                            {isPub ? "Published" : "Draft"}
                          </span>
                        </div>
                      </div>

                      {test.description && (
                        <p className="text-xs text-chalk-muted/80 mt-3 line-clamp-2 leading-relaxed">
                          {test.description}
                        </p>
                      )}
                    </div>

                    {/* Numerical Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-chalk-faint bg-panel-2/30">
                      <div className="p-3.5 sm:px-5">
                        <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                          Questions
                        </p>
                        <p className="font-semibold text-sm text-chalk mt-0.5">
                          {test.totalQuestions ?? 0}
                        </p>
                      </div>

                      <div className="p-3.5 sm:px-5 border-l border-chalk-faint">
                        <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                          Duration
                        </p>
                        <p className="font-semibold text-sm text-chalk mt-0.5">
                          {test.duration} min
                        </p>
                      </div>

                      <div className="p-3.5 sm:px-5 border-l border-chalk-faint">
                        <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                          Marks / Q
                        </p>
                        <p className="font-semibold text-sm text-chalk mt-0.5">
                          {test.marksPerQuestion ?? 1}
                        </p>
                      </div>

                      <div className="p-3.5 sm:px-5 border-l border-chalk-faint">
                        <p className="text-[11px] uppercase tracking-wider text-chalk-muted font-medium">
                          Negative
                        </p>
                        <p className="font-semibold text-sm text-chalk mt-0.5">
                          {test.negativeMarks ?? 0}
                        </p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-panel">
                      <p className="text-[11px] text-chalk-muted/60">
                        Created{" "}
                        {test.createdAt
                          ? new Date(test.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/test-creator/tests/${testId}/questions`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-red hover:bg-brand-red-dark text-chalk transition"
                        >
                          <PlusIcon size={13} />
                          <span>Questions</span>
                        </Link>

                        <Link
                          to={`/test-creator/tests/${testId}/preview`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-chalk transition"
                        >
                          <EyeIcon size={13} />
                          <span>View</span>
                        </Link>

                        <Link
                          to={`/test-creator/tests/${testId}/edit`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-chalk transition"
                        >
                          <EditIcon size={13} />
                          <span>Edit</span>
                        </Link>

                        <button
                          onClick={() => handlePublishToggle(test)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                            isPub
                              ? "border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10"
                              : "border-success/40 text-success hover:bg-success/10"
                          }`}
                        >
                          {isPub ? "Unpublish" : "Publish"}
                        </button>

                        <button
                          onClick={() => handleDelete(test)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-red/30 text-brand-red hover:bg-brand-red/10 transition"
                        >
                          <TrashIcon size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default MyTests;