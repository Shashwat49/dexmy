import { useState, useMemo } from "react";
import {
  LockIcon,
  CheckIcon,
  TrophyIcon,
  GiftIcon,
  CloseIcon,
  SearchIcon,
  ArrowRightIcon,
  ClockIcon,
} from "./StudentIcons";

export default function StudentDashboard({
  tests = [],
  completedSubmissions = {},
  purchasedTestIds = new Set(),
  onStartTest,
  onUnlockTest,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [unlockModalTest, setUnlockModalTest] = useState(null);
  const [scorecardModalTest, setScorecardModalTest] = useState(null);

  // Extract unique subjects
  const subjects = useMemo(() => {
    const list = new Set();
    tests.forEach((t) => {
      if (t.subject) list.add(t.subject);
    });
    return ["all", ...Array.from(list)];
  }, [tests]);

  // Compute test metrics
  const stats = useMemo(() => {
    const total = tests.length;
    let completedCount = 0;
    let totalScore = 0;

    tests.forEach((t) => {
      const id = String(t.id || t._id);
      if (completedSubmissions[id]) {
        completedCount++;
        totalScore += completedSubmissions[id].percentage || 0;
      }
    });

    const notAttemptedCount = Math.max(0, total - completedCount);
    const avgScore = completedCount > 0 ? (totalScore / completedCount).toFixed(1) : "0";

    return {
      total,
      completedCount,
      notAttemptedCount,
      avgScore,
    };
  }, [tests, completedSubmissions]);

  // Filter tests based on tab, subject, and search query
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const id = String(test.id || test._id);
      const isPaid = Boolean(test.is_paid || test.isPaid);
      const isPurchased = purchasedTestIds.has(id);
      const isCompleted = Boolean(completedSubmissions[id]);

      // Filter by Tab
      if (activeTab === "free" && isPaid) return false;
      if (activeTab === "paid" && !isPaid) return false;
      if (activeTab === "purchased" && (!isPaid || !isPurchased)) return false;
      if (activeTab === "completed" && !isCompleted) return false;
      if (activeTab === "notAttempted" && isCompleted) return false;

      // Filter by Subject
      if (selectedSubject !== "all" && test.subject !== selectedSubject) {
        return false;
      }

      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = (test.title || "").toLowerCase().includes(query);
        const descMatch = (test.description || "").toLowerCase().includes(query);
        const subjectMatch = (test.subject || "").toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !subjectMatch) return false;
      }

      return true;
    });
  }, [tests, activeTab, selectedSubject, searchQuery, purchasedTestIds, completedSubmissions]);

  return (
    <div className="min-h-screen bg-void text-chalk font-body pb-16">
      {/* Top Header Bar (matches Dexmy Navbar) */}
      <header className="sticky top-0 z-30 bg-panel/95 backdrop-blur-md border-b border-chalk-faint px-4 py-3 sm:py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/dexmy.png" alt="Dexmy" className="h-8 sm:h-9 w-auto object-contain" />
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-panel-2 border border-chalk-faint text-chalk-muted">
            Student Assessment Portal
          </span>
        </div>

        <div className="flex items-center gap-3.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-panel-2 border border-chalk-faint text-xs text-chalk-muted">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>Active Student Session</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-brand-gold text-[#2C1E04] font-bold text-sm flex items-center justify-center shadow">
            ST
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Welcome & Overview Header */}
        <div className="bg-panel border border-chalk-faint rounded-2xl p-5 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-brand-gold px-2.5 py-1 rounded-lg bg-brand-gold-soft border border-brand-gold/20 mb-3">
              Student Tests Hub
            </span>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-chalk tracking-tight">
              Test Your Knowledge & Track Progress
            </h1>
            <p className="text-chalk-muted text-xs sm:text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
              Browse available mock assessments, topic practice tests, and certified examinations. Attempt tests with immediate evaluation and detailed scorecards.
            </p>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div className="bg-panel-2 border border-chalk-faint rounded-xl p-3">
                <div className="text-xs text-chalk-muted font-medium">Available Tests</div>
                <div className="text-lg font-semibold text-chalk mt-1">{stats.total}</div>
              </div>
              <div className="bg-panel-2 border border-chalk-faint rounded-xl p-3">
                <div className="text-xs text-chalk-muted font-medium">Completed</div>
                <div className="text-lg font-semibold text-success mt-1">{stats.completedCount}</div>
              </div>
              <div className="bg-panel-2 border border-chalk-faint rounded-xl p-3">
                <div className="text-xs text-chalk-muted font-medium">Not Attempted</div>
                <div className="text-lg font-semibold text-brand-gold mt-1">{stats.notAttemptedCount}</div>
              </div>
              <div className="bg-panel-2 border border-chalk-faint rounded-xl p-3">
                <div className="text-xs text-chalk-muted font-medium">Average Score</div>
                <div className="text-lg font-semibold text-chalk mt-1">{stats.avgScore}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Section: Search & Filters */}
        <div className="bg-panel border border-chalk-faint rounded-2xl p-4 mb-6 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-chalk-faint pb-2">
            {[
              { key: "all", label: "All Tests" },
              { key: "free", label: "Free" },
              { key: "paid", label: "Paid" },
              { key: "purchased", label: "Purchased" },
              { key: "notAttempted", label: "Not Attempted" },
              { key: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeTab === tab.key
                    ? "bg-brand-red text-chalk shadow-sm"
                    : "text-chalk-muted hover:text-chalk hover:bg-panel-2"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tests by title or topic…"
              className="w-full bg-panel-2 border border-chalk-faint rounded-xl pl-9 pr-8 py-2 text-xs text-chalk placeholder:text-chalk-muted/50 focus:outline-none focus:border-brand-red transition"
            />
            <SearchIcon size={14} className="absolute left-3 top-2.5 text-chalk-muted pointer-events-none" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2 text-xs text-chalk-muted hover:text-chalk p-0.5"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Subject Filter Pills */}
        {subjects.length > 2 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 text-xs">
            <span className="text-chalk-muted font-medium whitespace-nowrap">Subject:</span>
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1 rounded-lg capitalize whitespace-nowrap transition ${
                  selectedSubject === sub
                    ? "bg-brand-gold text-[#2C1E04] font-bold"
                    : "bg-panel-2 text-chalk-muted hover:text-chalk border border-chalk-faint"
                }`}
              >
                {sub === "all" ? "All Domains" : sub}
              </button>
            ))}
          </div>
        )}

        {/* Tests Grid */}
        {filteredTests.length === 0 ? (
          <div className="bg-panel border border-chalk-faint rounded-2xl p-12 text-center text-chalk-muted">
            <h3 className="text-base font-semibold text-chalk">No tests match your filter</h3>
            <p className="text-xs text-chalk-muted mt-1 max-w-sm mx-auto">
              Try switching tabs, clearing search keywords, or selecting another subject.
            </p>
            <button
              onClick={() => {
                setActiveTab("all");
                setSelectedSubject("all");
                setSearchQuery("");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-xs font-semibold text-chalk transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredTests.map((test) => {
              const testId = String(test.id || test._id);
              const isPaid = Boolean(test.is_paid || test.isPaid);
              const isPurchased = purchasedTestIds.has(testId);
              const isLocked = isPaid && !isPurchased;
              const submission = completedSubmissions[testId];
              const isCompleted = Boolean(submission);

              return (
                <div
                  key={testId}
                  className="bg-panel border border-chalk-faint rounded-2xl p-5 sm:p-6 hover:border-chalk-muted/30 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Badges Row */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-gold-soft text-brand-gold border border-brand-gold/30">
                          {isPurchased ? (
                            <>
                              <CheckIcon size={12} />
                              <span>Purchased</span>
                            </>
                          ) : (
                            <>
                              <LockIcon size={12} />
                              <span>Paid • ₹{test.price || 499}</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-success-soft text-success border border-success/30">
                          <GiftIcon size={12} />
                          <span>Free Test</span>
                        </span>
                      )}

                      {isCompleted ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-success-soft text-success border border-success/30">
                          Score: {submission.percentage}%
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-panel-2 text-chalk-muted border border-chalk-faint">
                          Not Attempted
                        </span>
                      )}
                    </div>

                    {/* Subject Tag */}
                    <div className="text-[11px] font-semibold tracking-wider text-chalk-muted uppercase mb-1">
                      {test.subject || "General"}
                    </div>

                    {/* Test Title */}
                    <h3 className="text-base font-semibold text-chalk line-clamp-2 leading-snug">
                      {test.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-chalk-muted mt-2 line-clamp-2 leading-relaxed">
                      {test.description || "Comprehensive mock assessment designed to evaluate test readiness."}
                    </p>

                    {/* Test Info Badges */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-chalk-faint text-[11px] text-chalk-muted">
                      <div>
                        <span className="text-chalk font-semibold">{test.duration || 60}</span> mins
                      </div>
                      <div>
                        <span className="text-chalk font-semibold">
                          {test.total_questions || test.totalQuestions || test.questions?.length || 50}
                        </span> Qs
                      </div>
                      <div>
                        <span className="text-chalk font-semibold">
                          +{test.marksPerQuestion ?? test.marks_per_question ?? 1} / -{test.negativeMarks ?? test.negative_marks ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-5 pt-4 border-t border-chalk-faint flex items-center justify-between gap-3">
                    {isCompleted && (
                      <button
                        onClick={() => setScorecardModalTest({ test, submission })}
                        className="px-3.5 py-2 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-xs font-medium text-chalk transition"
                      >
                        Scorecard
                      </button>
                    )}

                    {isLocked ? (
                      <button
                        onClick={() => setUnlockModalTest(test)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-[#2C1E04] text-xs font-bold transition shadow-sm"
                      >
                        <LockIcon size={14} />
                        <span>Unlock Test • ₹{test.price || 499}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onStartTest(test)}
                        className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                          isCompleted
                            ? "flex-1 bg-panel-2 hover:bg-panel-3 text-chalk border border-chalk-faint"
                            : "w-full bg-brand-red hover:bg-brand-red-dark text-chalk shadow-sm"
                        }`}
                      >
                        <span>{isCompleted ? "Retake Test" : "Start Test"}</span>
                        <ArrowRightIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Unlock / Purchase Simulation Modal */}
      {unlockModalTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-panel border border-chalk-faint rounded-2xl max-w-md w-full p-5 sm:p-6 text-chalk shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-chalk-faint">
              <h4 className="text-base font-semibold flex items-center gap-2 text-brand-gold">
                <LockIcon size={16} />
                <span>Unlock Premium Assessment</span>
              </h4>
              <button
                onClick={() => setUnlockModalTest(null)}
                className="text-chalk-muted hover:text-chalk p-1"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h5 className="font-semibold text-base text-chalk">{unlockModalTest.title}</h5>
                <p className="text-xs text-chalk-muted mt-1">{unlockModalTest.description}</p>
              </div>

              <div className="bg-panel-2 border border-chalk-faint rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between text-chalk-muted">
                  <span>Duration:</span>
                  <span className="font-semibold text-chalk">{unlockModalTest.duration} Mins</span>
                </div>
                <div className="flex justify-between text-chalk-muted">
                  <span>Total Questions:</span>
                  <span className="font-semibold text-chalk">
                    {unlockModalTest.total_questions || unlockModalTest.questions?.length || 0} Questions
                  </span>
                </div>
                <div className="flex justify-between text-chalk-muted">
                  <span>Domain / Subject:</span>
                  <span className="font-semibold text-brand-gold">{unlockModalTest.subject}</span>
                </div>
                <div className="flex justify-between text-chalk-muted pt-2 border-t border-chalk-faint text-sm">
                  <span className="font-semibold text-chalk">Access Fee:</span>
                  <span className="font-bold text-brand-gold">₹{unlockModalTest.price || 499}</span>
                </div>
              </div>

              <div className="text-xs text-chalk-muted bg-panel-2/60 p-3 rounded-xl border border-chalk-faint">
                Includes full attempt access, candidate performance analytics, and complete answer keys.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setUnlockModalTest(null)}
                className="flex-1 py-2.5 rounded-xl border border-chalk-faint bg-panel-2 hover:bg-panel-3 text-xs font-medium text-chalk transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUnlockTest(unlockModalTest);
                  setUnlockModalTest(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-xs font-bold text-[#2C1E04] shadow transition"
              >
                Verify &amp; Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scorecard Modal */}
      {scorecardModalTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-panel border border-chalk-faint rounded-2xl max-w-lg w-full p-5 sm:p-6 text-chalk shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-chalk-faint">
              <h4 className="text-base font-semibold flex items-center gap-2 text-chalk">
                <TrophyIcon size={18} className="text-brand-gold" />
                <span>Assessment Performance Scorecard</span>
              </h4>
              <button
                onClick={() => setScorecardModalTest(null)}
                className="text-chalk-muted hover:text-chalk p-1"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="mt-4">
              <h5 className="font-semibold text-base text-chalk">{scorecardModalTest.test?.title}</h5>
              <div className="text-xs text-chalk-muted mt-0.5">
                Submitted on: {new Date(scorecardModalTest.submission.createdAt || Date.now()).toLocaleString()}
              </div>

              {/* Score Highlight Box */}
              <div className="mt-4 bg-panel-2 border border-chalk-faint rounded-xl p-5 text-center">
                <div className="text-4xl font-semibold text-success">
                  {scorecardModalTest.submission.percentage}%
                </div>
                <div className="text-xs font-semibold text-chalk-muted uppercase tracking-wider mt-1">
                  Overall Score
                </div>
                <div className="text-sm font-semibold text-chalk mt-2">
                  {scorecardModalTest.submission.obtainedMarks} / {scorecardModalTest.submission.totalMarks} Marks Obtained
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs">
                <div className="bg-panel-2 border border-chalk-faint p-2.5 rounded-xl">
                  <div className="text-chalk-muted text-[10px]">Total Qs</div>
                  <div className="text-sm font-semibold text-chalk mt-0.5">
                    {scorecardModalTest.submission.totalQuestions}
                  </div>
                </div>
                <div className="bg-panel-2 border border-chalk-faint p-2.5 rounded-xl">
                  <div className="text-success text-[10px]">Correct</div>
                  <div className="text-sm font-semibold text-success mt-0.5">
                    {scorecardModalTest.submission.correct}
                  </div>
                </div>
                <div className="bg-panel-2 border border-chalk-faint p-2.5 rounded-xl">
                  <div className="text-brand-red text-[10px]">Incorrect</div>
                  <div className="text-sm font-semibold text-brand-red mt-0.5">
                    {scorecardModalTest.submission.incorrect}
                  </div>
                </div>
                <div className="bg-panel-2 border border-chalk-faint p-2.5 rounded-xl">
                  <div className="text-brand-gold text-[10px]">Unattempted</div>
                  <div className="text-sm font-semibold text-brand-gold mt-0.5">
                    {scorecardModalTest.submission.notAnswered}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setScorecardModalTest(null)}
                className="flex-1 py-2.5 rounded-xl border border-chalk-faint bg-panel-2 hover:bg-panel-3 text-xs font-medium text-chalk transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const testToStart = scorecardModalTest.test;
                  setScorecardModalTest(null);
                  onStartTest(testToStart);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-brand-red hover:bg-brand-red-dark text-xs font-semibold text-chalk shadow transition"
              >
                <span>Retake Test</span>
                <ArrowRightIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
