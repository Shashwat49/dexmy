import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TeacherLayout from "../../components/TeacherLayout";
import { ArrowLeftIcon, SearchIcon, CheckIcon } from "../../components/Icons";

function AddQuestions() {
    const { examId } = useParams();
    const [exam, setExam] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addingId, setAddingId] = useState(null);
    const [message, setMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [removeQuestionId, setRemoveQuestionId] = useState(null);
    const [removing, setRemoving] = useState(false);

    // Fetch exam + questions
    const fetchData = async () => {
        try {
            setLoading(true);
            setMessage("");

            const [examResponse, questionsResponse] = await Promise.all([
                fetch(`http://localhost:5000/api/exams/${examId}`),
                fetch("http://localhost:5000/api/questions"),
            ]);

            const examData = await examResponse.json();
            const questionsData = await questionsResponse.json();

            if (!examResponse.ok) {
                throw new Error(examData.message || "Failed to fetch exam");
            }

            if (!questionsResponse.ok) {
                throw new Error(
                    questionsData.message || "Failed to fetch questions"
                );
            }

            setExam(examData.exam);
            setQuestions(questionsData.questions || []);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (examId) {
            fetchData();
        }
    }, [examId]);

    // Check whether question is already added
    const isQuestionAdded = (questionId) => {
        return exam?.questions?.some((question) => {
            const id =
                typeof question === "string"
                    ? question
                    : question._id;

            return id === questionId;
        });
    };

    const filteredQuestions = questions.filter((question) => {
        const search = searchTerm.toLowerCase().trim();

        if (!search) {
            return true;
        }

        return (
            question.questionText
                ?.toLowerCase()
                .includes(search) ||
            question.subject
                ?.toLowerCase()
                .includes(search) ||
            question.options?.some((option) =>
                option.toLowerCase().includes(search)
            )
        );
    });

    // Add question to exam
    const handleAddQuestion = async (questionId) => {
        try {
            setAddingId(questionId);
            setMessage("");

            const response = await fetch(
                `http://localhost:5000/api/exams/${examId}/questions`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        questionId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to add question"
                );
            }

            setExam(data.exam);

            setMessage("Question added to exam successfully.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setAddingId(null);
        }
    };

    // Remove question from exam
    const handleRemoveQuestion = async () => {
        if (!removeQuestionId) {
            return;
        }

        try {
            setRemoving(true);
            setMessage("");

            const response = await fetch(
                `http://localhost:5000/api/exams/${examId}/questions`,
                {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        questionId: removeQuestionId,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to remove question"
                );
            }

            setExam(data.exam);
            setRemoveQuestionId(null);

            setMessage("Question removed from exam successfully.");

        } catch (error) {
            setMessage(error.message);
        } finally {
            setRemoving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                    Loading questions...
                </p>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl">
                    <p className="text-red-600">
                        {message || "Exam not found."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <TeacherLayout>
            <div className="min-h-screen bg-[#f4f5f4] text-[#102a25]">

                {/* =====================================================
                PAGE CONTENT
            ====================================================== */}

                <main className="p-5 lg:p-8">

                    <div className="max-w-7xl mx-auto">

                        {/* =================================================
                        PAGE HEADER
                    ================================================= */}

                        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">

                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => window.history.back()}
                                        className="text-sm text-[#587069] hover:text-[#0b211a] transition"
                                    >
                                        <ArrowLeftIcon size={14} /> My Exams
                                    </button>

                                    <span className="text-[#a1aaa6]">
                                        /
                                    </span>

                                    <span className="text-sm text-[#0b211a] font-medium">
                                        Add Questions
                                    </span>
                                </div>

                                <h1 className="text-2xl lg:text-[28px] font-bold text-[#0b211a]">
                                    Add Questions
                                </h1>

                                <p className="text-sm text-[#64756e] mt-1">
                                    Add questions to{" "}
                                    <span className="font-semibold text-[#29463b]">
                                        {exam.title}
                                    </span>
                                </p>
                            </div>


                            {/* Exam Question Counter */}

                            <div className="flex items-center gap-3">

                                <div className="bg-white border border-[#d9e0dc] rounded-xl px-5 py-3 min-w-[150px]">

                                    <p className="text-[11px] uppercase tracking-wider font-semibold text-[#82908a]">
                                        Questions Added
                                    </p>

                                    <div className="flex items-end gap-2 mt-1">

                                        <span className="text-2xl font-bold text-[#0b211a]">
                                            {exam.totalQuestions || 0}
                                        </span>

                                        <span className="text-xs text-[#84918c] mb-1">
                                            questions
                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                        EXAM SUMMARY
                    ================================================= */}

                        <div className="bg-[#0b211a] rounded-2xl p-5 lg:p-6 mb-6 shadow-sm">

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

                                <div className="flex items-start gap-4">

                                    <div className="w-11 h-11 shrink-0 rounded-xl bg-[#f5b91e] text-[#071a14] flex items-center justify-center font-bold text-lg">
                                        ?
                                    </div>

                                    <div>

                                        <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-[#f5b91e]">
                                            Current Exam
                                        </p>

                                        <h2 className="text-lg font-bold text-[#f4efe3] mt-1">
                                            {exam.title}
                                        </h2>

                                        <p className="text-sm text-[#b8c8c1] mt-1">
                                            {exam.subject || "General"} &middot;{" "}
                                            {exam.duration || 0} minutes
                                        </p>

                                    </div>

                                </div>


                                <div className="flex items-center gap-6 text-sm">

                                    <div>
                                        <p className="text-[#82988e] text-xs">
                                            Marks / Question
                                        </p>

                                        <p className="text-[#f4efe3] font-semibold mt-1">
                                            {exam.marksPerQuestion ?? 0}
                                        </p>
                                    </div>

                                    <div className="w-px h-8 bg-[#365449]" />

                                    <div>
                                        <p className="text-[#82988e] text-xs">
                                            Negative Marks
                                        </p>

                                        <p className="text-[#f4efe3] font-semibold mt-1">
                                            {exam.negativeMarks ?? 0}
                                        </p>
                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                        SEARCH + STATUS
                    ================================================= */}

                        <div className="bg-white border border-[#dce3df] rounded-2xl p-4 mb-6">

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

                                <div className="relative w-full lg:max-w-xl">

                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#83918b] text-lg">
                                        <SearchIcon size={18} />
                                    </span>

                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) =>
                                            setSearchTerm(e.target.value)
                                        }
                                        placeholder="Search questions, subjects or options..."
                                        className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#d6dfda] bg-[#fafbfa] text-sm text-[#102a25] placeholder:text-[#929e99] outline-none transition-all focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                                    />

                                </div>


                                <div className="flex items-center gap-2">

                                    <span className="text-xs text-[#7b8983]">
                                        Showing
                                    </span>

                                    <span className="px-2.5 py-1 rounded-lg bg-[#eef5f1] text-[#0b5968] text-xs font-bold">
                                        {filteredQuestions.length}
                                    </span>

                                    <span className="text-xs text-[#7b8983]">
                                        questions
                                    </span>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                        MESSAGE
                    ================================================= */}

                        {message && (
                            <div className="mb-5 rounded-xl border border-[#d7dfda] bg-white px-4 py-3 flex items-center gap-3">

                                <div className="w-8 h-8 rounded-lg bg-[#eef5f1] text-[#0b5968] flex items-center justify-center font-bold">
                                    <CheckIcon size={16} />
                                </div>

                                <p className="text-sm text-[#456057]">
                                    {message}
                                </p>

                            </div>
                        )}


                        {/* =================================================
                        QUESTIONS
                    ================================================= */}

                        {filteredQuestions.length === 0 ? (

                            <div className="bg-white border border-[#dce3df] rounded-2xl p-12 text-center">

                                <div className="mx-auto w-14 h-14 rounded-xl bg-[#eef5f1] text-[#0b5968] flex items-center justify-center text-2xl mb-4">
                                    <SearchIcon size={24} />
                                </div>

                                <h2 className="text-lg font-bold text-[#0b211a]">
                                    No questions found
                                </h2>

                                <p className="text-sm text-[#7b8983] mt-1">
                                    {searchTerm
                                        ? "Try searching with a different keyword."
                                        : "Create questions in your question bank first."}
                                </p>

                            </div>

                        ) : (

                            <div className="space-y-4">

                                {filteredQuestions.map((question, index) => {

                                    const alreadyAdded =
                                        isQuestionAdded(question._id);

                                    return (

                                        <div
                                            key={question._id}
                                            className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${alreadyAdded
                                                    ? "border-[#b9d6c7]"
                                                    : "border-[#dce3df] hover:border-[#b7c8c0] hover:shadow-sm"
                                                }`}
                                        >

                                            {/* Question Top */}

                                            <div className="p-5 lg:p-6">

                                                <div className="flex flex-col lg:flex-row lg:items-start gap-5">

                                                    {/* Question Number */}

                                                    <div className="flex items-start gap-4 flex-1 min-w-0">

                                                        <div className="w-10 h-10 shrink-0 rounded-xl bg-[#eef5f1] text-[#0b5968] flex items-center justify-center text-sm font-bold">
                                                            {index + 1}
                                                        </div>

                                                        <div className="min-w-0 flex-1">

                                                            <div className="flex flex-wrap items-center gap-2 mb-2">

                                                                {question.subject && (
                                                                    <span className="px-2.5 py-1 rounded-full bg-[#f1e9ff] text-[#6d28d9] text-[11px] font-semibold">
                                                                        {question.subject}
                                                                    </span>
                                                                )}

                                                                {question.difficulty && (
                                                                    <span className="px-2.5 py-1 rounded-full bg-[#fff4d6] text-[#9a6800] text-[11px] font-semibold">
                                                                        {question.difficulty}
                                                                    </span>
                                                                )}

                                                                {alreadyAdded && (
                                                                    <span className="px-2.5 py-1 rounded-full bg-[#e8f4ed] text-[#18734b] text-[11px] font-bold">
                                                                        Added
                                                                    </span>
                                                                )}

                                                            </div>


                                                            <h2 className="text-[16px] lg:text-[17px] font-semibold leading-7 text-[#102a25]">
                                                                {question.questionText ||
                                                                    "Image-based question"}
                                                            </h2>


                                                            {/* Question Image */}

                                                            {question.questionImage && (
                                                                <div className="mt-4">

                                                                    <img
                                                                        src={question.questionImage}
                                                                        alt="Question"
                                                                        className="max-w-md max-h-64 object-contain rounded-xl border border-[#dce3df] bg-[#fafbfa]"
                                                                    />

                                                                </div>
                                                            )}


                                                            {/* Options */}

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">

                                                                {question.options.map(
                                                                    (option, optionIndex) => {

                                                                        const isCorrect =
                                                                            optionIndex ===
                                                                            question.correctAnswer;

                                                                        return (

                                                                            <div
                                                                                key={optionIndex}
                                                                                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${isCorrect
                                                                                        ? "border-[#a8cfba] bg-[#f0f8f3]"
                                                                                        : "border-[#e0e5e2] bg-[#fafbfa]"
                                                                                    }`}
                                                                            >

                                                                                <span
                                                                                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect
                                                                                            ? "bg-[#18734b] text-white"
                                                                                            : "bg-[#edf0ef] text-[#53645d]"
                                                                                        }`}
                                                                                >
                                                                                    {String.fromCharCode(
                                                                                        65 + optionIndex
                                                                                    )}
                                                                                </span>

                                                                                <span
                                                                                    className={`text-sm leading-6 ${isCorrect
                                                                                            ? "text-[#176440] font-medium"
                                                                                            : "text-[#344840]"
                                                                                        }`}
                                                                                >
                                                                                    {option}
                                                                                </span>

                                                                                {isCorrect && (
                                                                                    <span className="ml-auto text-[10px] font-bold text-[#18734b] uppercase tracking-wide">
                                                                                        Correct
                                                                                    </span>
                                                                                )}

                                                                            </div>

                                                                        );

                                                                    }
                                                                )}

                                                            </div>

                                                        </div>

                                                    </div>


                                                    {/* ACTION */}

                                                    <div className="lg:w-[145px] shrink-0 flex lg:flex-col items-center lg:items-end gap-3">

                                                        {alreadyAdded ? (

                                                            <>
                                                                <span className="px-3 py-1.5 rounded-full bg-[#e8f4ed] border border-[#b9d6c7] text-[#18734b] text-xs font-bold">
                                                                    Added to Exam
                                                                </span>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setRemoveQuestionId(
                                                                            question._id
                                                                        )
                                                                    }
                                                                    className="px-4 py-2 rounded-lg border border-[#e7b8b8] bg-[#fff7f7] text-[#b42318] text-sm font-semibold hover:bg-[#fff0f0] transition"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </>

                                                        ) : (

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleAddQuestion(
                                                                        question._id
                                                                    )
                                                                }
                                                                disabled={
                                                                    addingId ===
                                                                    question._id
                                                                }
                                                                className="w-full lg:w-auto px-4 py-2.5 rounded-lg bg-[#0b211a] text-[#f4efe3] text-sm font-semibold border border-[#29463b] hover:bg-[#12382b] hover:-translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                            >
                                                                {addingId ===
                                                                    question._id
                                                                    ? "Adding..."
                                                                    : "+ Add to Exam"}
                                                            </button>

                                                        )}

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    );

                                })}

                            </div>

                        )}

                    </div>

                </main>


                {/* =====================================================
                REMOVE CONFIRMATION MODAL
            ====================================================== */}

                {removeQuestionId && (

                    <div className="fixed inset-0 z-[60] bg-[#071a14]/75 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="w-full max-w-md bg-[#f8f7f2] rounded-2xl shadow-2xl border border-[#29463b] overflow-hidden">

                            <div className="h-1.5 bg-[#f5b91e]" />

                            <div className="p-6">

                                <div className="w-12 h-12 rounded-full bg-[#fff0f0] border border-[#f0c1c1] text-[#b42318] flex items-center justify-center text-xl font-bold mb-4">
                                    !
                                </div>

                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b42318]">
                                    Confirmation
                                </p>

                                <h2 className="text-xl font-bold text-[#0b211a] mt-1">
                                    Remove Question?
                                </h2>

                                <p className="text-sm leading-6 text-[#687972] mt-2">
                                    Are you sure you want to remove this question
                                    from this exam? The question will remain in
                                    your question bank.
                                </p>


                                <div className="flex justify-end gap-3 mt-6">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setRemoveQuestionId(null)
                                        }
                                        disabled={removing}
                                        className="px-5 py-2.5 rounded-lg border border-[#b8c8c1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#f1f5f3] disabled:opacity-50 transition"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRemoveQuestion}
                                        disabled={removing}
                                        className="px-5 py-2.5 rounded-lg bg-[#b42318] text-white text-sm font-semibold hover:bg-[#941b12] disabled:opacity-50 transition"
                                    >
                                        {removing
                                            ? "Removing..."
                                            : "Remove Question"}
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

export default AddQuestions;