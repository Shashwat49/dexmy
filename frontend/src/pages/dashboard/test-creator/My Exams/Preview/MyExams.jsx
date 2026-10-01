import { useEffect, useState } from "react";
import ExamPreview from "./ExamPreview";
import AddQuestions from "./AddQuestions";
import EditExam from "../Edit/EditExam";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../../components/TeacherLayout";
import { ArrowLeftIcon, RefreshIcon, CheckIcon, CloseIcon, GridSquareIcon, CircleIcon } from "../../components/Icons";

function MyExams() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [previewExamId, setPreviewExamId] = useState(null);
  const [addQuestionsExamId, setAddQuestionsExamId] = useState(null);
  const [editExamId, setEditExamId] = useState(null);
  const [deleteExamId, setDeleteExamId] = useState(null);
  const [deleting, setDeleting] = useState(false);



  // Fetch exams from backend
  const fetchExams = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        "http://localhost:5000/api/test-creation"
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch exams");
      }

      setExams(data.tests || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteExam = async () => {
    if (!deleteExamId) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(
        `http://localhost:5000/api/exams/${deleteExamId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete exam"
        );
      }

      // Remove deleted exam from UI immediately
      setExams((previous) =>
        previous.filter(
          (exam) => exam._id !== deleteExamId
        )
      );

      // Close popup
      setDeleteExamId(null);

    } catch (error) {
      console.error("Delete exam error:", error);

      alert(
        error.message || "Failed to delete exam"
      );
    } finally {
      setDeleting(false);
    }
  };


  const handleTogglePublish = async (examId) => {
    try {
      setMessage("");

      const response = await fetch(
        `http://localhost:5000/api/exams/${examId}/publish`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update exam status"
        );
      }

      setMessage(
        data.exam?.isPublished
          ? "Exam published successfully."
          : "Exam unpublished successfully."
      );

      await fetchExams();
    } catch (error) {
      setMessage(error.message);
    }
  };
  useEffect(() => {
    fetchExams();
  }, []);
  if (previewExamId) {
    return (
      <div className="min-h-screen">
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setPreviewExamId(null)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <ArrowLeftIcon size={14} />
            <span>Back to My Exams</span>
          </button>
        </div>

        <ExamPreview examId={previewExamId} />
      </div>
    );
  }
  if (addQuestionsExamId) {
    return (
      <div className="min-h-screen">
        <div className="fixed top-4 left-4 z-50">
          <button
            type="button"
            onClick={() => setAddQuestionsExamId(null)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <ArrowLeftIcon size={14} />
            <span>Back to My Exams</span>
          </button>
        </div>

        <AddQuestions examId={addQuestionsExamId} />
      </div>
    );
  }
  if (editExamId) {
    return (
      <EditExam
        examId={editExamId}
        onBack={() => setEditExamId(null)}
      />
    );
  }

  return (
    <TeacherLayout>

      {/* =====================================================
        PREVIEW
    ====================================================== */}
      {previewExamId ? (
        <div className="min-h-[calc(100vh-64px)] bg-[#f4f5f3]">

          <div className="px-5 py-5 lg:px-8">
            <div className="max-w-7xl mx-auto">

              <button
                type="button"
                onClick={() => setPreviewExamId(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#cbd6d1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#eef5f2] hover:border-[#0b5968] transition-all duration-200"
              >
                <ArrowLeftIcon size={14} />
                <span>Back to My Exams</span>
              </button>

            </div>
          </div>

          <ExamPreview examId={previewExamId} />

        </div>
      ) : addQuestionsExamId ? (

        /* =====================================================
           ADD QUESTIONS
        ====================================================== */
        <div className="min-h-[calc(100vh-64px)] bg-[#f4f5f3]">

          <div className="px-5 py-5 lg:px-8">
            <div className="max-w-7xl mx-auto">

              <button
                type="button"
                onClick={() => setAddQuestionsExamId(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#cbd6d1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#eef5f2] hover:border-[#0b5968] transition-all duration-200"
              >
                <ArrowLeftIcon size={14} />
                <span>Back to My Exams</span>
              </button>

            </div>
          </div>

          <AddQuestions examId={addQuestionsExamId} />

        </div>
      ) : editExamId ? (

        /* =====================================================
           EDIT EXAM
        ====================================================== */
        <EditExam
          examId={editExamId}
          onBack={() => setEditExamId(null)}
        />

      ) : (

        /* =====================================================
           MY EXAMS
        ====================================================== */
        <div className="min-h-[calc(100vh-64px)] bg-[#f4f5f3] px-5 py-7 lg:px-8 lg:py-8">

          <div className="max-w-7xl mx-auto">


            {/* =================================================
              PAGE HEADER
          ================================================= */}

            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">

              <div>

                <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#d99b00] mb-2">
                  Assessment Management
                </p>

                <h1 className="text-[28px] lg:text-[30px] font-bold tracking-tight text-[#0b211a]">
                  My Exams
                </h1>

                <p className="mt-1.5 text-[14px] text-[#66756e]">
                  Manage, publish and organize your examinations.
                </p>

              </div>


              <div className="flex items-center gap-3">

                {/* REFRESH */}
                <button
                  type="button"
                  onClick={fetchExams}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#cbd6d1] bg-white text-[#31544a] text-sm font-semibold hover:bg-[#eef5f2] hover:border-[#9eafa8] disabled:opacity-50 transition-all duration-200"
                >
                  <span className={loading ? "animate-spin inline-flex" : "inline-flex"}>
                    <RefreshIcon size={16} />
                  </span>

                  Refresh
                </button>


                {/* CREATE EXAM */}
                <button
                  type="button"
                  onClick={() => navigate("/create-exam")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#f5b91e] text-[#071a14] text-sm font-bold border border-[#e5aa09] hover:bg-[#ffca32] hover:-translate-y-[1px] hover:shadow-md transition-all duration-200"
                >
                  <span className="text-lg leading-none">
                    +
                  </span>

                  Create Exam
                </button>

              </div>

            </div>


            {/* =================================================
              SUMMARY BAR
          ================================================= */}

            {!loading && !message && exams.length > 0 && (

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">

                {/* TOTAL */}
                <div className="bg-white border border-[#dce3df] rounded-xl p-4 shadow-[0_3px_15px_rgba(11,33,26,0.04)]">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-xs text-[#718079]">
                        Total Exams
                      </p>

                      <p className="mt-1 text-2xl font-bold text-[#0b211a]">
                        {exams.length}
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-[#eaf3f0] text-[#0b5968] flex items-center justify-center">
                      <GridSquareIcon size={20} className="text-[#0b5968]" />
                    </div>

                  </div>

                </div>


                {/* PUBLISHED */}
                <div className="bg-white border border-[#dce3df] rounded-xl p-4 shadow-[0_3px_15px_rgba(11,33,26,0.04)]">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-xs text-[#718079]">
                        Published
                      </p>

                      <p className="mt-1 text-2xl font-bold text-[#23613a]">
                        {
                          exams.filter(
                            (exam) => exam.isPublished
                          ).length
                        }
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-[#edf8f1] text-[#2f7d4b] flex items-center justify-center">
                      <CheckIcon size={20} className="text-[#2f7d4b]" />
                    </div>

                  </div>

                </div>


                {/* DRAFT */}
                <div className="bg-white border border-[#dce3df] rounded-xl p-4 shadow-[0_3px_15px_rgba(11,33,26,0.04)]">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-xs text-[#718079]">
                        Drafts
                      </p>

                      <p className="mt-1 text-2xl font-bold text-[#a86b00]">
                        {
                          exams.filter(
                            (exam) => !exam.isPublished
                          ).length
                        }
                      </p>
                    </div>

                    <div className="w-10 h-10 rounded-lg bg-[#fff5d9] text-[#b47700] flex items-center justify-center">
                      <CircleIcon size={20} className="text-[#b47700]" />
                    </div>

                  </div>

                </div>

              </div>

            )}


            {/* =================================================
              MESSAGE
          ================================================= */}

            {!loading && message && (

              <div className="mb-6 rounded-xl border border-[#edc6bd] bg-[#fff4f1] px-4 py-3.5 text-sm text-[#a13f2b] flex items-center gap-3">

                <span className="w-7 h-7 rounded-full bg-[#fbe2dc] flex items-center justify-center font-bold">
                  !
                </span>

                <span>
                  {message}
                </span>

              </div>

            )}


            {/* =================================================
              LOADING
          ================================================= */}

            {loading && (

              <div className="bg-white border border-[#dce3df] rounded-2xl p-12 text-center shadow-[0_4px_20px_rgba(11,33,26,0.04)]">

                <div className="mx-auto w-10 h-10 rounded-full border-4 border-[#dce8e3] border-t-[#0b5968] animate-spin" />

                <p className="mt-4 text-sm font-medium text-[#52655d]">
                  Loading your exams...
                </p>

                <p className="mt-1 text-xs text-[#8a9691]">
                  Please wait a moment.
                </p>

              </div>

            )}


            {/* =================================================
              EMPTY STATE
          ================================================= */}

            {!loading && !message && exams.length === 0 && (

              <div className="bg-white border border-[#dce3df] rounded-2xl shadow-[0_4px_20px_rgba(11,33,26,0.04)] overflow-hidden">

                <div className="h-1.5 bg-[#f5b91e]" />

                <div className="p-12 text-center">

                  <div className="mx-auto w-16 h-16 rounded-2xl bg-[#eaf3f0] border border-[#cbded6] flex items-center justify-center">
                    <GridSquareIcon size={28} className="text-[#0b5968]" />
                  </div>

                  <h2 className="mt-5 text-xl font-bold text-[#0b211a]">
                    No exams found
                  </h2>

                  <p className="mt-1.5 text-sm text-[#718079]">
                    Create your first exam to get started.
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate("/create-exam")}
                    className="mt-6 px-5 py-2.5 rounded-lg bg-[#f5b91e] text-[#071a14] text-sm font-bold hover:bg-[#ffca32] hover:-translate-y-[1px] hover:shadow-md transition-all duration-200"
                  >
                    + Create Your First Exam
                  </button>

                </div>

              </div>

            )}


            {/* =================================================
              EXAMS LIST
          ================================================= */}

            {!loading && !message && exams.length > 0 && (

              <div className="space-y-5">

                {exams.map((exam) => (

                  <div
                    key={exam._id}
                    className="bg-white border border-[#dce3df] rounded-2xl shadow-[0_4px_20px_rgba(11,33,26,0.045)] overflow-hidden hover:shadow-[0_8px_28px_rgba(11,33,26,0.07)] transition-all duration-200"
                  >

                    {/* TOP ACCENT */}
                    <div
                      className={`h-1.5 ${exam.isPublished
                        ? "bg-[#0b5968]"
                        : "bg-[#f5b91e]"
                        }`}
                    />


                    {/* EXAM CONTENT */}
                    <div className="p-5 lg:p-6">


                      {/* HEADER */}
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                        <div className="flex gap-4 min-w-0">

                          {/* ICON */}
                          <div className="w-11 h-11 shrink-0 rounded-xl bg-[#eaf3f0] border border-[#cbded6] text-[#0b5968] flex items-center justify-center">
                            <GridSquareIcon size={22} className="text-[#0b5968]" />
                          </div>


                          {/* TITLE */}
                          <div className="min-w-0">

                            <h2 className="text-[18px] font-bold text-[#0b211a] truncate">
                              {exam.title}
                            </h2>

                            <p className="mt-1 text-sm text-[#718079]">
                              {exam.subject || "No subject"}
                            </p>

                          </div>

                        </div>


                        {/* STATUS */}
                        <span
                          className={`self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${exam.isPublished
                            ? "bg-[#edf8f1] text-[#23613a] border-[#c5e2ce]"
                            : "bg-[#fff6dc] text-[#9a6800] border-[#f1d78b]"
                            }`}
                        >

                          <span
                            className={`w-1.5 h-1.5 rounded-full ${exam.isPublished
                              ? "bg-[#2f8a4f]"
                              : "bg-[#d99b00]"
                              }`}
                          />

                          {exam.isPublished
                            ? "Published"
                            : "Draft"}

                        </span>

                      </div>


                      {/* DESCRIPTION */}
                      {exam.description && (

                        <p className="mt-5 text-sm leading-6 text-[#66756e] max-w-4xl">
                          {exam.description}
                        </p>

                      )}


                      {/* INFO */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">

                        {/* DURATION */}
                        <div className="rounded-xl bg-[#f7f9f8] border border-[#e2e9e5] px-4 py-3">

                          <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8a9691]">
                            Duration
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#0b211a]">
                            {exam.duration || 0} min
                          </p>

                        </div>


                        {/* QUESTIONS */}
                        <div className="rounded-xl bg-[#f7f9f8] border border-[#e2e9e5] px-4 py-3">

                          <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8a9691]">
                            Questions
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#0b211a]">
                            {exam.totalQuestions ||
                              exam.questions?.length ||
                              0}
                          </p>

                        </div>


                        {/* MARKS */}
                        <div className="rounded-xl bg-[#f7f9f8] border border-[#e2e9e5] px-4 py-3">

                          <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8a9691]">
                            Marks / Question
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#0b211a]">
                            +{exam.marksPerQuestion ?? 0}
                          </p>

                        </div>


                        {/* NEGATIVE */}
                        <div className="rounded-xl bg-[#f7f9f8] border border-[#e2e9e5] px-4 py-3">

                          <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-[#8a9691]">
                            Negative
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#a13f2b]">
                            -{exam.negativeMarks ?? 0}
                          </p>

                        </div>

                      </div>


                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-6 pt-5 border-t border-[#e5eae7]">


                        {/* ADD QUESTIONS */}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/exams/${exam._id}/questions`
                            )
                          }
                          className="px-4 py-2.5 rounded-lg bg-[#0b5968] text-white text-sm font-semibold hover:bg-[#084b59] hover:-translate-y-[1px] hover:shadow-sm transition-all duration-200"
                        >
                          + Add Questions
                        </button>


                        {/* PREVIEW */}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/exams/${exam._id}/preview`
                            )
                          }
                          className="px-4 py-2.5 rounded-lg border border-[#cbd6d1] bg-white text-[#31544a] text-sm font-semibold hover:bg-[#eef5f2] hover:border-[#0b5968] transition-all duration-200"
                        >
                          Preview
                        </button>


                        {/* EDIT */}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/exams/${exam._id}/edit`
                            )
                          }
                          className="px-4 py-2.5 rounded-lg border border-[#cbd6d1] bg-white text-[#31544a] text-sm font-semibold hover:bg-[#eef5f2] hover:border-[#0b5968] transition-all duration-200"
                        >
                          Edit
                        </button>


                        {/* PUBLISH */}
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePublish(exam._id)
                          }
                          className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${exam.isPublished
                            ? "border border-[#edc6bd] bg-[#fff4f1] text-[#a13f2b] hover:bg-[#fbe2dc]"
                            : "bg-[#f5b91e] text-[#071a14] border border-[#e5aa09] hover:bg-[#ffca32] hover:-translate-y-[1px]"
                            }`}
                        >
                          {exam.isPublished
                            ? "Unpublish"
                            : "Publish"}
                        </button>


                        {/* DELETE */}
                        <button
                          type="button"
                          onClick={() => setDeleteExamId(exam._id)}
                          className="px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 transition"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

          {/* DELETE EXAM MODAL */}

          {deleteExamId && (
            <div className="fixed inset-0 z-50 bg-[#071a14]/75 backdrop-blur-sm flex items-center justify-center p-4">

              <div className="w-full max-w-md bg-[#f8f7f2] rounded-2xl shadow-2xl border border-[#29463b] overflow-hidden">

                {/* HEADER */}

                <div className="bg-[#0b211a] px-6 py-5 flex items-start justify-between">

                  <div className="flex items-center gap-4">

                    <div className="w-12 h-12 rounded-xl bg-[#fff0ed] flex items-center justify-center text-red-600 text-xl font-bold">
                      !
                    </div>

                    <div>
                      <p className="text-xs font-bold tracking-[0.16em] uppercase text-[#f5b91e]">
                        Delete Exam
                      </p>

                      <h2 className="mt-1 text-lg font-bold text-[#f4efe3]">
                        Delete this exam?
                      </h2>
                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteExamId(null)}
                    disabled={deleting}
                    className="w-9 h-9 rounded-full border border-[#3c5d50] text-[#f4efe3] flex items-center justify-center hover:bg-[#f5b91e] hover:text-[#071a14] transition disabled:opacity-40"
                  >
                    <CloseIcon size={16} />
                  </button>

                </div>


                {/* CONTENT */}

                <div className="px-6 py-6">

                  <p className="text-sm leading-6 text-[#52645c]">
                    Are you sure you want to delete this exam?
                    This action cannot be undone and all exam
                    data associated with it may be permanently removed.
                  </p>


                  {/* WARNING */}

                  <div className="mt-5 rounded-xl border border-[#f0c8c1] bg-[#fff5f3] px-4 py-3">

                    <div className="flex items-start gap-3">

                      <div className="w-7 h-7 shrink-0 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">
                        !
                      </div>

                      <div>

                        <p className="text-sm font-bold text-red-700">
                          This action is permanent
                        </p>

                        <p className="text-xs leading-5 text-red-600/80 mt-1">
                          Once deleted, this exam cannot be recovered.
                        </p>

                      </div>

                    </div>

                  </div>


                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 mt-6">

                    <button
                      type="button"
                      onClick={() => setDeleteExamId(null)}
                      disabled={deleting}
                      className="px-5 py-2.5 rounded-lg border border-[#b9c8c1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#f1f5f3] transition disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteExam}
                      className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {deleting ? "Deleting..." : "Delete Exam"}
                    </button>

                  </div>

                </div>

              </div>

            </div>
          )}

        </div>

      )}

    </TeacherLayout>
  );
}

export default MyExams;