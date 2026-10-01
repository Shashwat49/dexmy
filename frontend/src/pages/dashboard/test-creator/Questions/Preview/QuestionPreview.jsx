import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon, MinusIcon, CheckIcon } from "../../components/Icons";

function QuestionPreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [message, setMessage] = useState("");

  // =====================================================
  // FETCH QUESTION
  // =====================================================

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        setLoading(true);
        setMessage("");

        const response = await fetch(
          `http://localhost:5000/api/questions/${id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to fetch question"
          );
        }

        setQuestion(data.question);
      } catch (error) {
        setMessage(
          error.message || "Failed to load question"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestion();
    }
  }, [id]);

  // =====================================================
  // FONT SIZE
  // =====================================================

  const increaseFontSize = () => {
    setFontSize((prev) => Math.min(prev + 2, 30));
  };

  const decreaseFontSize = () => {
    setFontSize((prev) => Math.max(prev - 2, 14));
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f3] flex items-center justify-center">
        <div className="text-center">

          <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#dce8e3] border-t-[#0b211a] animate-spin" />

          <p className="mt-4 text-sm font-medium text-[#66756f]">
            Loading question preview...
          </p>

        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (!question || message) {
    return (
      <div className="min-h-screen bg-[#f4f5f3] flex items-center justify-center p-6">

        <div className="w-full max-w-md bg-white border border-[#d8e0dc] rounded-2xl p-7 text-center shadow-sm">

          <div className="w-14 h-14 mx-auto rounded-full bg-[#fff0f0] flex items-center justify-center text-red-600 text-xl font-bold">
            !
          </div>

          <h2 className="mt-4 text-xl font-bold text-[#0b211a]">
            Unable to Load Question
          </h2>

          <p className="mt-2 text-sm text-[#687770]">
            {message || "Question not found."}
          </p>

          <button
            type="button"
            onClick={() => navigate("/questions")}
            className="mt-6 px-5 py-2.5 rounded-lg bg-[#0b211a] text-white text-sm font-semibold hover:bg-[#12352a] transition"
          >
            <ArrowLeftIcon size={14} /> Back to Question Bank
          </button>

        </div>

      </div>
    );
  }

  const options = question.options || [];

  return (
    <div className="h-screen bg-[#f8f7f2] flex flex-col overflow-hidden">

      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header className="h-[76px] shrink-0 bg-[#0b211a] border-b border-[#29463b] px-5 lg:px-7 flex items-center justify-between">

        {/* LEFT */}

        <div className="min-w-0">

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => navigate("/questions")}
              className="w-9 h-9 rounded-lg border border-[#36584c] text-[#f4efe3] flex items-center justify-center hover:bg-[#f5b91e] hover:text-[#071a14] hover:border-[#f5b91e] transition"
              title="Back to Question Bank"
            >
              <ArrowLeftIcon size={18} />
            </button>

            <div className="min-w-0">

              <h1 className="text-lg sm:text-xl font-bold text-[#f4efe3] truncate">
                Question Preview
              </h1>

              <p className="text-xs sm:text-sm text-[#f5b91e] mt-0.5">
                Teacher Preview
              </p>

            </div>

          </div>

        </div>

        {/* RIGHT */}

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          {/* PREVIEW BADGE */}

          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg border border-[#36584c] text-[#c8d4cf] text-xs font-semibold">

            <span className="w-2 h-2 rounded-full bg-[#f5b91e]" />

            Teacher Preview

          </div>

          {/* EDIT */}

          <button
            type="button"
            onClick={() =>
              navigate(`/questions/${id}/edit`)
            }
            className="px-3 sm:px-4 py-2 rounded-lg border border-[#36584c] text-[#f4efe3] text-sm font-semibold hover:bg-[#f5b91e] hover:text-[#071a14] hover:border-[#f5b91e] transition"
          >
            <span className="hidden sm:inline">
              Edit Question
            </span>

            <span className="sm:hidden">
              Edit
            </span>
          </button>

        </div>

      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <div className="flex flex-1 min-h-0">

        {/* =====================================================
            LEFT QUESTION INFO
        ===================================================== */}

        <aside className="w-[230px] lg:w-[280px] shrink-0 bg-[#f8f7f2] border-r border-[#d3ddd7] flex flex-col">

          {/* HEADER */}

          <div className="px-5 py-5 border-b border-[#d9e1dc]">

            <div className="flex items-start gap-3">

              <div className="w-1.5 h-7 rounded-full bg-[#f5b91e] shrink-0" />

              <div>

                <h2 className="text-lg font-bold text-[#102a25]">
                  Question Preview
                </h2>

                <p className="text-xs text-[#697a72] mt-1">
                  Preview question details
                </p>

              </div>

            </div>

          </div>

          {/* QUESTION NUMBER */}

          <div className="px-5 py-5">

            <div className="w-12 h-12 rounded-xl bg-[#0b211a] text-white flex items-center justify-center text-sm font-bold shadow-sm">
              1
            </div>

            <p className="mt-4 text-[10px] font-bold tracking-[0.18em] uppercase text-[#e19f00]">
              Question
            </p>

            <p className="mt-1 text-sm font-semibold text-[#102a25]">
              Question 1
            </p>

          </div>

          {/* PREVIEW INFORMATION */}

          <div className="mt-auto border-t border-[#d9e1dc] px-5 py-5">

            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#e19f00] mb-4">
              Question Information
            </p>

            <div className="space-y-3 text-xs">

              <div className="flex items-center justify-between">
                <span className="text-[#617169]">
                  Options
                </span>

                <span className="font-bold text-[#102a25]">
                  {options.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#617169]">
                  Marks
                </span>

                <span className="font-bold text-[#102a25]">
                  {question.marks ?? 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#617169]">
                  Negative
                </span>

                <span className="font-bold text-[#102a25]">
                  {question.negativeMarks ?? 0}
                </span>
              </div>

            </div>

          </div>

        </aside>

        {/* =====================================================
            CENTER QUESTION
        ===================================================== */}

        <main className="flex-1 min-w-0 flex flex-col bg-white">

          {/* QUESTION HEADER */}

          <div className="px-6 lg:px-7 py-5 border-b border-[#d9e1dc] flex items-center justify-between shrink-0">

            <div>

              <div className="flex items-center gap-2">

                <h2 className="text-xl font-bold text-[#102a25]">
                  Question
                </h2>

                <span className="text-sm font-medium text-[#718079]">
                  1
                </span>

                <span className="text-xs text-[#8a9691]">
                  OF
                </span>

                <span className="text-sm font-semibold text-[#718079]">
                  1
                </span>

              </div>

              {/* BADGES */}

              <div className="flex flex-wrap gap-2 mt-3">

                <span className="px-3 py-1 rounded-full bg-[#fff4cf] border border-[#f2d67c] text-[#946900] text-xs font-semibold">
                  {question.difficulty || "Medium"}
                </span>

                <span className="px-3 py-1 rounded-full bg-[#e8f4ed] border border-[#c5ddd0] text-[#0b5968] text-xs font-semibold">
                  {question.questionType || "MCQ"}
                </span>

                <span className="px-3 py-1 rounded-full bg-[#fff0ed] border border-[#efc8bf] text-[#bd5444] text-xs font-semibold">
                  {question.subject || "General Awareness"}
                </span>

                <span className="px-3 py-1 rounded-full bg-[#edf1ef] border border-[#d4ddd8] text-[#42564e] text-xs font-semibold">
                  +{question.marks ?? 0}
                  {" / "}
                  -{question.negativeMarks ?? 0}
                </span>

              </div>

            </div>

            {/* LANGUAGE + FONT */}

            <div className="flex items-center gap-2">

              <select
                defaultValue="English"
                className="hidden sm:block border border-[#cbd7d1] rounded-lg px-3 py-2 bg-white text-sm text-[#102a25] outline-none focus:border-[#0b5968]"
              >
                <option>English</option>
                <option>Hindi</option>
              </select>

              <div className="flex border border-[#cbd7d1] rounded-lg overflow-hidden bg-white">

                <button
                  type="button"
                  onClick={decreaseFontSize}
                  className="px-3 py-2 text-sm font-bold text-[#102a25] hover:bg-[#f1f5f2] transition"
                >
                  <><span className="text-sm font-bold">A</span><MinusIcon size={12} /></>
                </button>

                <button
                  type="button"
                  onClick={increaseFontSize}
                  className="px-3 py-2 text-sm font-bold text-[#102a25] border-l border-[#cbd7d1] hover:bg-[#f1f5f2] transition"
                >
                  A+
                </button>

              </div>

            </div>

          </div>

          {/* QUESTION CONTENT */}

          <div className="flex-1 overflow-y-auto px-6 lg:px-7 py-7">

            {/* QUESTION LABEL */}

            <div className="flex items-center gap-3 mb-4">

              <span className="w-1.5 h-6 rounded-full bg-[#f5b91e]" />

              <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#617169]">
                Question
              </p>

            </div>

            {/* QUESTION TEXT */}

            <p
              className="text-[#102a25] font-medium leading-8 max-w-4xl"
              style={{
                fontSize: `${fontSize}px`,
              }}
            >
              {question.questionText ||
                "Question text not available."}
            </p>

            {/* IMAGE */}

            {question.questionImage && (
              <div className="mt-7">

                <img
                  src={question.questionImage}
                  alt="Question"
                  className="max-w-xl max-h-80 object-contain rounded-xl border border-[#d4ded9] bg-[#fafbf9] p-2"
                />

              </div>
            )}

          </div>

          {/* BOTTOM */}

          <div className="h-[82px] shrink-0 border-t border-[#d9e1dc] px-5 lg:px-7 flex items-center justify-between bg-[#fafbf9]">

            <button
              type="button"
              onClick={() => navigate("/questions")}
              className="px-4 sm:px-5 py-2.5 rounded-lg border border-[#cbd7d1] bg-white text-[#53655e] text-sm font-semibold hover:bg-[#f2f5f3] transition"
            >
              <ArrowLeftIcon size={14} /> Back
            </button>

            <div className="hidden sm:block text-center">

              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#84928c]">
                Previewing
              </p>

              <p className="text-sm font-bold text-[#102a25] mt-0.5">
                Question 1
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                navigate(`/questions/${id}/edit`)
              }
              className="px-5 sm:px-7 py-2.5 rounded-lg bg-[#0b211a] text-[#f4efe3] text-sm font-bold border border-[#29463b] hover:bg-[#12352a] transition"
            >
              <><span>Edit</span> <ArrowRightIcon size={14} /></>
            </button>

          </div>

        </main>

        {/* =====================================================
            RIGHT OPTIONS + INFORMATION
        ===================================================== */}

        <aside className="hidden xl:flex w-[390px] shrink-0 border-l border-[#d3ddd7] bg-[#f8f7f2] flex-col overflow-y-auto">

          <div className="p-6">

            {/* OPTIONS */}

            <div className="flex items-start justify-between gap-3 mb-5">

              <div>

                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#e19f00]">
                  Answer Options
                </p>

                <h2 className="mt-2 text-lg font-bold text-[#102a25]">
                  Correct answer
                </h2>

              </div>

              <div className="w-10 h-10 shrink-0 rounded-full bg-[#e8f1ed] flex items-center justify-center text-sm font-bold text-[#0b5968]">
                1
              </div>

            </div>

            <div className="space-y-3">

              {options.map((option, index) => {

                const isCorrect =
                  index === question.correctAnswer;

                const letter =
                  String.fromCharCode(65 + index);

                return (

                  <div
                    key={index}
                    className={`
                      flex items-center gap-4
                      min-h-[70px]
                      rounded-xl
                      border
                      px-4 py-3
                      transition-all duration-200
                      ${
                        isCorrect
                          ? "border-[#9dc7ae] bg-[#eef8f1]"
                          : "border-[#d7e0db] bg-white"
                      }
                    `}
                  >

                    <div
                      className={`
                        w-10 h-10
                        shrink-0
                        rounded-full
                        flex items-center justify-center
                        text-sm font-bold
                        ${
                          isCorrect
                            ? "bg-[#0b211a] text-[#f5b91e]"
                            : "bg-[#edf2ef] text-[#29463b]"
                        }
                      `}
                    >
                      {letter}
                    </div>

                    <span
                      className={`
                        flex-1 text-sm leading-6
                        ${
                          isCorrect
                            ? "text-[#17643a] font-semibold"
                            : "text-[#102a25]"
                        }
                      `}
                    >
                      {option}
                    </span>

                    {isCorrect && (
                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#d8f0df] text-[#237044] text-[10px] font-bold">
                        Correct
                      </span>
                    )}

                  </div>

                );
              })}

            </div>

            {/* GAP */}

            <div className="mt-8 pt-6 border-t border-[#d3ddd7]">

              {/* QUESTION INFORMATION */}

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#e19f00]">
                    Question Information
                  </p>

                  <h2 className="mt-2 text-lg font-bold text-[#102a25]">
                    Question 1
                  </h2>

                </div>

                <div className="w-10 h-10 rounded-full bg-[#e8f1ed] flex items-center justify-center text-sm font-bold text-[#0b5968]">
                  1
                </div>

              </div>

              {/* CURRENT QUESTION */}

              <div className="mt-5 bg-white border border-[#d6dfda] rounded-xl p-4">

                <p className="text-xs font-semibold text-[#718079]">
                  Current Question
                </p>

                <p className="mt-2 text-sm leading-6 text-[#102a25]">
                  {question.questionText ||
                    "Question text not available."}
                </p>

              </div>

              {/* DETAILS */}

              <div className="mt-4 space-y-3">

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Difficulty
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-[#fff4cf] text-[#946900] text-xs font-bold">
                    {question.difficulty || "Medium"}
                  </span>

                </div>

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Type
                  </span>

                  <span className="text-sm font-semibold text-[#102a25]">
                    {question.questionType || "MCQ"}
                  </span>

                </div>

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Options
                  </span>

                  <span className="text-sm font-semibold text-[#102a25]">
                    {options.length}
                  </span>

                </div>

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Correct Option
                  </span>

                  <span className="w-7 h-7 rounded-full bg-[#0b211a] text-[#f5b91e] flex items-center justify-center text-xs font-bold">
                    {question.correctAnswer !== undefined
                      ? String.fromCharCode(
                          65 + Number(question.correctAnswer)
                        )
                      : "-"}
                  </span>

                </div>

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Marks
                  </span>

                  <span className="text-sm font-semibold text-[#102a25]">
                    {question.marks ?? 0}
                  </span>

                </div>

                <div className="flex items-center justify-between bg-white border border-[#d6dfda] rounded-xl px-4 py-3">

                  <span className="text-sm text-[#687770]">
                    Negative Marks
                  </span>

                  <span className="text-sm font-semibold text-[#102a25]">
                    {question.negativeMarks ?? 0}
                  </span>

                </div>

              </div>

              {/* CORRECT ANSWER NOTICE */}

              <div className="mt-5 rounded-xl border border-[#b8d9c5] bg-[#eaf6ef] p-4">

                <div className="flex items-start gap-3">

                  <div className="w-8 h-8 shrink-0 rounded-full bg-[#0b211a] flex items-center justify-center text-[#f5b91e] font-bold">
                    <CheckIcon size={16} />
                  </div>

                  <div>

                    <p className="text-sm font-bold text-[#237044]">
                      Correct answer visible
                    </p>

                    <p className="text-xs leading-5 text-[#4c6a5a] mt-1">
                      Green option indicates the
                      correct answer for this
                      teacher preview.
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        </aside>

      </div>

      {/* =====================================================
          TEACHER NOTICE
      ===================================================== */}

      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-2 bg-[#0b211a] border border-[#29463b] shadow-lg rounded-full px-4 py-2 text-xs text-[#dce7e2]">

        <span className="w-2 h-2 rounded-full bg-[#f5b91e]" />

        Teacher Preview - Correct answer is highlighted
        in green.

      </div>

    </div>
  );
}

export default QuestionPreview;