import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import TeacherLayout from "./components/TeacherLayout";
import { fetchWithAuth } from "./src/api";
import {
  DashboardIcon,
  TestsIcon,
  PlusIcon,
  QuestionIcon,
  AnalyticsIcon,
  CheckIcon,
  EditIcon,
  EyeIcon,
  ArrowRightIcon,
} from "./components/Icons";

function TestCreatorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalExams: 0,
    totalQuestions: 0,
    publishedExams: 0,
    draftExams: 0,
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [exams, setExams] = useState([]);
  const [teacherProfile, setTeacherProfile] = useState({
    fullName: "",
    email: "",
    designation: "",
  });

  useEffect(() => {
    const loadProfile = () => {
      const saved = localStorage.getItem("teacherProfile");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setTeacherProfile({
            fullName: data.fullName || "",
            email: data.email || "",
            designation: data.designation || "",
          });
        } catch {}
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setMessage("");

        let tests = [];
        let questions = [];

        try {
          const testRes = await fetchWithAuth("/api/tests");
          if (testRes.ok) {
            const testData = await testRes.json();
            tests = testData.tests || [];
          } else {
            const examRes = await fetchWithAuth("/api/exams");
            if (examRes.ok) {
              const examData = await examRes.json();
              tests = examData.exams || [];
            }
          }
        } catch (e) {
          console.warn("Tests fetch error, falling back:", e.message);
        }

        try {
          const qRes = await fetchWithAuth("/api/questions");
          if (qRes.ok) {
            const qData = await qRes.json();
            questions = qData.questions || [];
          }
        } catch (e) {
          console.warn("Questions fetch error:", e.message);
        }

        setExams(tests);
        const publishedExams = tests.filter(
          (exam) => exam.isPublished || exam.is_published
        );

        setStats({
          totalExams: tests.length,
          totalQuestions: questions.length,
          publishedExams: publishedExams.length,
          draftExams: Math.max(0, tests.length - publishedExams.length),
        });
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Top Header */}
        <div className="border-b border-chalk-faint px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
              Teacher Dashboard
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl tracking-tight text-chalk">
              Welcome back{teacherProfile.fullName ? `, ${teacherProfile.fullName}` : ""}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-chalk-muted">
              Manage your exams, questions and student assessments.
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

        {/* Content Body */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7 space-y-6 sm:space-y-7">
          {message && (
            <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
              {message}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 hover:border-chalk-muted/30 transition">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-chalk-muted">Total Tests</p>
                <span className="w-8 h-8 rounded-lg bg-panel-2 text-chalk flex items-center justify-center">
                  <TestsIcon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-chalk">
                {loading ? "…" : stats.totalExams}
              </p>
              <p className="mt-2 text-xs text-chalk-muted/70">All created assessments</p>
            </div>

            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 hover:border-chalk-muted/30 transition">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-chalk-muted">Question Bank</p>
                <span className="w-8 h-8 rounded-lg bg-brand-gold-soft text-brand-gold flex items-center justify-center">
                  <QuestionIcon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-chalk">
                {loading ? "…" : stats.totalQuestions}
              </p>
              <p className="mt-2 text-xs text-chalk-muted/70">Questions in repository</p>
            </div>

            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 hover:border-chalk-muted/30 transition">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-chalk-muted">Published</p>
                <span className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
                  <CheckIcon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-chalk">
                {loading ? "…" : stats.publishedExams}
              </p>
              <p className="mt-2 text-xs text-chalk-muted/70">Live for student attempts</p>
            </div>

            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 hover:border-chalk-muted/30 transition">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-chalk-muted">Drafts</p>
                <span className="w-8 h-8 rounded-lg bg-brand-red-soft text-brand-red flex items-center justify-center">
                  <EditIcon size={16} />
                </span>
              </div>
              <p className="mt-2 text-2xl sm:text-3xl font-semibold text-chalk">
                {loading ? "…" : stats.draftExams}
              </p>
              <p className="mt-2 text-xs text-chalk-muted/70">Unpublished tests</p>
            </div>
          </div>

          {/* Activity & Quick Actions Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Tests (2 cols) */}
            <div className="xl:col-span-2 rounded-2xl border border-chalk-faint bg-panel overflow-hidden">
              <div className="px-5 sm:px-6 py-4.5 border-b border-chalk-faint flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-chalk">Recent Tests</h2>
                  <p className="text-xs text-chalk-muted mt-0.5">Your latest examinations</p>
                </div>
                <Link
                  to="/test-creator/tests"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-chalk-muted hover:text-chalk transition"
                >
                  <span>View All</span>
                  <ArrowRightIcon size={13} />
                </Link>
              </div>

              <div className="divide-y divide-chalk-faint">
                {loading ? (
                  <div className="p-8 text-center text-sm text-chalk-muted">
                    Loading tests…
                  </div>
                ) : exams.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm font-semibold text-chalk">No tests created yet.</p>
                    <p className="text-xs text-chalk-muted mt-1">
                      Create your first test to get started.
                    </p>
                    <Link
                      to="/test-creator/tests/create"
                      className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-red px-4 py-2 text-xs font-semibold text-chalk"
                    >
                      <PlusIcon size={14} />
                      <span>Create Test</span>
                    </Link>
                  </div>
                ) : (
                  exams.slice(0, 5).map((exam) => {
                    const testId = exam.id || exam._id;
                    const isPub = exam.isPublished || exam.is_published;
                    const isPaid = exam.isPaid || exam.is_paid;

                    return (
                      <div
                        key={testId}
                        className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-panel-2/50 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm text-chalk truncate">
                              {exam.title}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                                isPub
                                  ? "bg-success-soft text-success border border-success/20"
                                  : "bg-brand-gold-soft text-brand-gold border border-brand-gold/20"
                              }`}
                            >
                              {isPub ? "Published" : "Draft"}
                            </span>
                            {isPaid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-brand-gold-soft text-brand-gold border border-brand-gold/20">
                                Paid • ₹{exam.price || 499}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-panel-2 text-chalk-muted border border-chalk-faint">
                                Free
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-chalk-muted mt-1 truncate">
                            {exam.subject || "General"} • {exam.duration} mins •{" "}
                            {exam.totalQuestions || exam.questions?.length || 0} questions
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            to={`/test-creator/tests/${testId}/questions`}
                            className="px-3 py-1.5 rounded-lg bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-xs font-medium text-chalk transition"
                          >
                            Questions
                          </Link>
                          <Link
                            to={`/test-creator/tests/${testId}/preview`}
                            className="px-3 py-1.5 rounded-lg bg-panel-2 hover:bg-panel-3 border border-chalk-faint text-xs font-medium text-chalk transition"
                          >
                            Preview
                          </Link>
                          <Link
                            to={`/test-creator/tests/${testId}/edit`}
                            className="px-3 py-1.5 rounded-lg bg-brand-red/15 hover:bg-brand-red/25 border border-brand-red/30 text-xs font-medium text-chalk transition"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions (1 col) */}
            <div className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-semibold text-chalk">Quick Actions</h2>
                <p className="text-xs text-chalk-muted mt-0.5">Common testing shortcuts</p>

                <div className="mt-5 space-y-3">
                  <Link
                    to="/test-creator/tests/create"
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-chalk-faint bg-panel-2/60 hover:bg-panel-2 hover:border-chalk-muted/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-red-soft text-brand-red flex items-center justify-center shrink-0">
                      <PlusIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-chalk">Create New Test</p>
                      <p className="text-xs text-chalk-muted">Draft a new mock test</p>
                    </div>
                  </Link>

                  <Link
                    to="/test-creator/questions/add"
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-chalk-faint bg-panel-2/60 hover:bg-panel-2 hover:border-chalk-muted/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-gold-soft text-brand-gold flex items-center justify-center shrink-0">
                      <QuestionIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-chalk">Add Question</p>
                      <p className="text-xs text-chalk-muted">Expand your question bank</p>
                    </div>
                  </Link>

                  <Link
                    to="/test-creator/tests"
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-chalk-faint bg-panel-2/60 hover:bg-panel-2 hover:border-chalk-muted/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-success-soft text-success flex items-center justify-center shrink-0">
                      <TestsIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-chalk">Manage Tests</p>
                      <p className="text-xs text-chalk-muted">Publish & edit assessments</p>
                    </div>
                  </Link>

                  <Link
                    to="/test-creator/results"
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-chalk-faint bg-panel-2/60 hover:bg-panel-2 hover:border-chalk-muted/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-panel-3 text-chalk-muted flex items-center justify-center shrink-0">
                      <AnalyticsIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-chalk">Student Results</p>
                      <p className="text-xs text-chalk-muted">View scores and performance</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-chalk-faint text-center">
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-chalk-muted hover:text-chalk transition"
                >
                  <span>Manage Teacher Profile & Settings</span>
                  <ArrowRightIcon size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default TestCreatorDashboard;