import { useEffect, useState } from "react";
import QuestionPreview from "../Preview/QuestionPreview";
import EditQuestion from "../Edit/EditQuestion";
import { useNavigate, Link } from "react-router-dom";
import TeacherLayout from "../../components/TeacherLayout";
import { fetchWithAuth } from "../../src/api";
import { ArrowLeftIcon, RefreshIcon, CheckIcon, PlusIcon, EyeIcon, EditIcon, TrashIcon } from "../../components/Icons";

function AllQuestions() {
    const navigate = useNavigate();

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [previewQuestionId, setPreviewQuestionId] = useState(null);
    const [editQuestionId, setEditQuestionId] = useState(null);
    const [deleteQuestionId, setDeleteQuestionId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // =====================================================
    // FETCH QUESTIONS
    // =====================================================

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            setMessage("");

            const response = await fetchWithAuth("/api/questions");
            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch questions"
                );
            }

            setQuestions(data.questions || []);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // DELETE QUESTION
    // =====================================================

    const handleDelete = async () => {
        if (!deleteQuestionId) {
            return;
        }

        try {
            setDeleting(true);
            setMessage("");

            const response = await fetchWithAuth(
                `/api/questions/${deleteQuestionId}`,
                {
                    method: "DELETE",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to delete question"
                );
            }

            setDeleteQuestionId(null);
            setMessage("Question deleted successfully.");

            await fetchQuestions();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setDeleting(false);
        }
    };

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        fetchQuestions();
    }, []);

    // =====================================================
    // QUESTION PREVIEW
    // =====================================================

    if (previewQuestionId) {
        return (
            <TeacherLayout>
                <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
                    <div className="px-5 lg:px-8 pt-5">
                        <button
                            type="button"
                            onClick={() => setPreviewQuestionId(null)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-chalk-faint bg-panel-2 text-chalk text-sm font-semibold hover:bg-panel transition"
                        >
                            <ArrowLeftIcon size={14} />
                            <span>Back to Questions</span>
                        </button>
                    </div>

                    <QuestionPreview
                        questionId={previewQuestionId}
                    />
                </div>
            </TeacherLayout>
        );
    }

    // =====================================================
    // EDIT QUESTION
    // =====================================================

    if (editQuestionId) {
        return (
            <TeacherLayout>
                <EditQuestion
                    questionId={editQuestionId}
                    onBack={() => setEditQuestionId(null)}
                />
            </TeacherLayout>
        );
    }

    // =====================================================
    // MAIN PAGE
    // =====================================================

    return (
        <TeacherLayout>
            <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
                <main className="p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto space-y-6">

                        {/* =================================================
                            PAGE HEADER
                        ================================================= */}

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-chalk-faint pb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
                                        Question Bank
                                    </span>
                                    <span className="text-chalk-muted opacity-40">/</span>
                                    <span className="text-xs font-medium text-brand-gold">
                                        Repository
                                    </span>
                                </div>

                                <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-chalk">
                                    Question Repository
                                </h1>

                                <p className="text-xs sm:text-sm text-chalk-muted mt-1">
                                    Create, manage, and organize your question bank for tests.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={fetchQuestions}
                                    disabled={loading}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-chalk-faint bg-panel-2 text-chalk text-xs sm:text-sm font-semibold hover:bg-panel disabled:opacity-50 transition"
                                >
                                    <RefreshIcon size={15} />
                                    <span>Refresh</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/questions/add")}
                                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-brand-red text-white text-xs sm:text-sm font-semibold hover:bg-brand-red-dark transition shadow-sm"
                                >
                                    <PlusIcon size={16} />
                                    <span>Add Question</span>
                                </button>
                            </div>
                        </div>

                        {/* =================================================
                            SUMMARY CARDS
                        ================================================= */}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* TOTAL */}
                            <div className="bg-panel border border-chalk-faint rounded-2xl p-5 hover:border-chalk-muted/30 transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider font-semibold text-chalk-muted opacity-60">
                                            Total Questions
                                        </p>
                                        <p className="text-3xl font-display text-chalk mt-2">
                                            {loading ? "..." : questions.length}
                                        </p>
                                    </div>

                                    <div className="w-11 h-11 rounded-xl bg-brand-gold-soft text-brand-gold border border-brand-gold/30 flex items-center justify-center text-lg font-bold">
                                        ?
                                    </div>
                                </div>
                                <p className="text-xs text-chalk-muted mt-3">
                                    Questions in your repository
                                </p>
                            </div>

                            {/* SUBJECTS */}
                            <div className="bg-panel border border-chalk-faint rounded-2xl p-5 hover:border-chalk-muted/30 transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider font-semibold text-chalk-muted opacity-60">
                                            Subjects
                                        </p>
                                        <p className="text-3xl font-display text-chalk mt-2">
                                            {loading
                                                ? "..."
                                                : new Set(
                                                    questions
                                                        .map((q) => q.subject)
                                                        .filter(Boolean)
                                                ).size}
                                        </p>
                                    </div>

                                    <div className="w-11 h-11 rounded-xl bg-brand-red-soft text-brand-red border border-brand-red/30 flex items-center justify-center text-lg font-bold">
                                        #
                                    </div>
                                </div>
                                <p className="text-xs text-chalk-muted mt-3">
                                    Distinct subject domains
                                </p>
                            </div>

                            {/* STATUS */}
                            <div className="bg-panel border border-chalk-faint rounded-2xl p-5 hover:border-chalk-muted/30 transition">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs uppercase tracking-wider font-semibold text-chalk-muted opacity-60">
                                            Repository Status
                                        </p>
                                        <p className="text-lg font-bold text-emerald-400 mt-2">
                                            Active
                                        </p>
                                    </div>

                                    <div className="w-11 h-11 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                                        <CheckIcon size={20} />
                                    </div>
                                </div>
                                <p className="text-xs text-chalk-muted mt-3">
                                    Ready to attach to tests
                                </p>
                            </div>
                        </div>

                        {/* =================================================
                            MESSAGE
                        ================================================= */}

                        {!loading && message && (
                            <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 flex items-center gap-3">
                                <div className="w-7 h-7 shrink-0 rounded-lg bg-brand-red text-white flex items-center justify-center font-bold text-xs">
                                    !
                                </div>
                                <p className="text-sm font-medium text-brand-red">
                                    {message}
                                </p>
                            </div>
                        )}

                        {/* =================================================
                            LOADING
                        ================================================= */}

                        {loading && (
                            <div className="bg-panel border border-chalk-faint rounded-2xl p-12 text-center text-chalk-muted">
                                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-red" />
                                <p className="text-sm">Loading question repository...</p>
                            </div>
                        )}

                        {/* =================================================
                            EMPTY
                        ================================================= */}

                        {!loading && !message && questions.length === 0 && (
                            <div className="bg-panel border border-chalk-faint rounded-2xl p-12 text-center max-w-lg mx-auto">
                                <div className="w-12 h-12 mx-auto rounded-xl bg-brand-gold-soft text-brand-gold border border-brand-gold/30 flex items-center justify-center text-xl font-bold mb-3">
                                    ?
                                </div>
                                <h2 className="text-lg font-semibold text-chalk">No questions found</h2>
                                <p className="text-sm text-chalk-muted mt-1">
                                    Create your first question to build your question bank.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/questions/add")}
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-red hover:bg-brand-red-dark px-5 py-2.5 text-sm font-semibold text-chalk transition"
                                >
                                    <PlusIcon size={16} />
                                    <span>Create Question</span>
                                </button>
                            </div>
                        )}

                        {/* =================================================
                            QUESTIONS LIST
                        ================================================= */}

                        {!loading && !message && questions.length > 0 && (
                            <div className="space-y-4">
                                {questions.map((question, index) => (
                                    <div
                                        key={question._id || index}
                                        className="bg-panel border border-chalk-faint rounded-2xl overflow-hidden hover:border-chalk-muted/30 transition flex flex-col justify-between"
                                    >
                                        {/* QUESTION HEADER */}
                                        <div className="px-5 sm:px-6 py-3.5 border-b border-chalk-faint bg-panel-2/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-panel-3 border border-chalk-faint text-brand-gold flex items-center justify-center text-xs font-bold">
                                                    Q{index + 1}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-chalk">
                                                        Question {index + 1}
                                                    </p>
                                                </div>
                                            </div>

                                            {question.subject && (
                                                <span className="self-start sm:self-auto px-3 py-1 rounded-lg bg-brand-red-soft border border-brand-red/20 text-brand-red text-xs font-semibold">
                                                    {question.subject}
                                                </span>
                                            )}
                                        </div>

                                        {/* QUESTION BODY */}
                                        <div className="p-5 sm:p-6">
                                            <h2 className="text-base sm:text-lg font-medium leading-relaxed text-chalk">
                                                {question.questionText || "Image-based question"}
                                            </h2>

                                            {/* IMAGE */}
                                            {question.questionImage && (
                                                <div className="mt-4">
                                                    <img
                                                        src={question.questionImage}
                                                        alt="Question"
                                                        className="max-w-md max-h-64 object-contain rounded-xl border border-chalk-faint bg-panel-2 p-2"
                                                    />
                                                </div>
                                            )}

                                            {/* OPTIONS */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                                                {question.options?.map((option, optionIndex) => {
                                                    const isCorrect = optionIndex === question.correctAnswer;
                                                    const optionText = typeof option === "object"
                                                        ? option.text || option.option || option.label || ""
                                                        : option;

                                                    return (
                                                        <div
                                                            key={optionIndex}
                                                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                                                                isCorrect
                                                                    ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                                                                    : "border-chalk-faint bg-panel-2/60 text-chalk"
                                                            }`}
                                                        >
                                                            <span
                                                                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                    isCorrect
                                                                        ? "bg-emerald-500 text-[#0F1D17]"
                                                                        : "bg-panel border border-chalk-faint text-chalk-muted"
                                                                }`}
                                                            >
                                                                {String.fromCharCode(65 + optionIndex)}
                                                            </span>

                                                            <span className="text-sm leading-6 flex-1">
                                                                {optionText}
                                                            </span>

                                                            {isCorrect && (
                                                                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                                                                    Correct
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* INFO METADATA */}
                                            <div className="flex flex-wrap gap-2.5 mt-5">
                                                <span className="px-3 py-1 rounded-lg bg-panel-2 border border-chalk-faint text-chalk-muted text-xs">
                                                    <span className="text-chalk font-semibold">Marks:</span>{" "}
                                                    {question.marks ?? 0}
                                                </span>

                                                <span className="px-3 py-1 rounded-lg bg-panel-2 border border-chalk-faint text-chalk-muted text-xs">
                                                    <span className="text-chalk font-semibold">Negative:</span>{" "}
                                                    {question.negativeMarks ?? 0}
                                                </span>

                                                <span className="px-3 py-1 rounded-lg bg-panel-2 border border-chalk-faint text-chalk-muted text-xs">
                                                    <span className="text-chalk font-semibold">Options:</span>{" "}
                                                    {question.options?.length || 0}
                                                </span>
                                            </div>
                                        </div>

                                        {/* ACTION BAR */}
                                        <div className="px-5 sm:px-6 py-3 border-t border-chalk-faint bg-panel-2/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <p className="text-xs text-chalk-muted">
                                                ID: <span className="font-mono text-[11px] opacity-70">{question._id || "—"}</span>
                                            </p>

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/questions/${question._id}/preview`)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-chalk-faint bg-panel-2 hover:bg-panel text-chalk text-xs font-semibold transition"
                                                >
                                                    <EyeIcon size={14} />
                                                    <span>Preview</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/questions/${question._id}/edit`)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-chalk-faint bg-panel-2 hover:bg-brand-gold-soft hover:text-brand-gold text-chalk text-xs font-semibold transition"
                                                >
                                                    <EditIcon size={14} />
                                                    <span>Edit</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteQuestionId(question._id)}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-brand-red/30 bg-brand-red-soft hover:bg-brand-red hover:text-white text-brand-red text-xs font-semibold transition"
                                                >
                                                    <TrashIcon size={14} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>
                </main>

                {/* =====================================================
                    DELETE CONFIRMATION MODAL
                ====================================================== */}

                {deleteQuestionId && (
                    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
                        <div className="w-full max-w-md bg-panel rounded-2xl shadow-2xl border border-chalk-faint overflow-hidden text-chalk">
                            <div className="h-1.5 bg-brand-red" />

                            <div className="p-6">
                                <div className="w-11 h-11 rounded-xl bg-brand-red-soft border border-brand-red/30 text-brand-red flex items-center justify-center text-lg font-bold mb-4">
                                    !
                                </div>

                                <p className="text-xs font-bold uppercase tracking-wider text-brand-red">
                                    Confirmation
                                </p>

                                <h2 className="text-xl font-bold text-chalk mt-1">
                                    Delete Question?
                                </h2>

                                <p className="text-sm leading-6 text-chalk-muted mt-2">
                                    Are you sure you want to delete this question? It will be removed from your question repository.
                                </p>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setDeleteQuestionId(null)}
                                        disabled={deleting}
                                        className="px-4 py-2 rounded-xl border border-chalk-faint bg-panel-2 hover:bg-panel text-chalk text-xs font-semibold disabled:opacity-50 transition"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="px-4 py-2 rounded-xl bg-brand-red hover:bg-brand-red-dark text-white text-xs font-semibold disabled:opacity-50 transition"
                                    >
                                        {deleting ? "Deleting..." : "Delete Question"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TeacherLayout>
    );
}

export default AllQuestions;