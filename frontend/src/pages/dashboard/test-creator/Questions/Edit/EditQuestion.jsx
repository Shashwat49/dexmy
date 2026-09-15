import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, CloseIcon, CheckIcon, GridSquareIcon } from "../../components/Icons";

function EditQuestion() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [marks, setMarks] = useState(4);
  const [negativeMarks, setNegativeMarks] = useState(1);
  const [subject, setSubject] = useState("");
  const [questionImage, setQuestionImage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");

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

        const question = data.question;

        setQuestionText(question.questionText || "");
        setOptions(question.options || []);
        setCorrectAnswer(Number(question.correctAnswer ?? 0));
        setMarks(question.marks ?? 4);
        setNegativeMarks(question.negativeMarks ?? 1);
        setSubject(question.subject || "");
        setDifficulty(question.difficulty || "Medium");
        setQuestionImage(question.questionImage || "");
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
  // OPTIONS
  // =====================================================

  const handleOptionChange = (index, value) => {
    setOptions((previous) =>
      previous.map((option, optionIndex) =>
        optionIndex === index ? value : option
      )
    );
  };

  const addOption = () => {
    if (options.length < 5) {
      setOptions((previous) => [...previous, ""]);
    }
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      return;
    }

    setOptions((previous) =>
      previous.filter(
        (_, optionIndex) => optionIndex !== index
      )
    );

    setCorrectAnswer((previous) => {
      if (index === previous) {
        return 0;
      }

      if (index < previous) {
        return previous - 1;
      }

      return previous;
    });
  };

  // =====================================================
  // SAVE
  // =====================================================

  const handleSave = async (e) => {
    e.preventDefault();

    setMessage("");

    if (options.length < 2 || options.length > 5) {
      setMessage(
        "Question must have between 2 and 5 options."
      );
      return;
    }

    if (options.some((option) => !option.trim())) {
      setMessage("Please fill all options.");
      return;
    }

    if (
      correctAnswer < 0 ||
      correctAnswer >= options.length
    ) {
      setMessage("Please select a valid correct answer.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `http://localhost:5000/api/questions/${id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questionText,
            options,
            correctAnswer,
            marks: Number(marks),
            negativeMarks: Number(negativeMarks),
            subject,
            questionImage,
            difficulty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update question"
        );
      }

      setMessage("Question updated successfully.");

      // Notification
      const existingNotifications =
        JSON.parse(
          localStorage.getItem("teacherNotifications")
        ) || [];

      const newNotification = {
        id: Date.now(),
        type: "question",
        title: "Question updated successfully",
        description:
          "A question in your question bank has been updated.",
        time: "Just now",
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(
        "teacherNotifications",
        JSON.stringify([
          newNotification,
          ...existingNotifications,
        ])
      );
    } catch (error) {
      setMessage(
        error.message || "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
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
            Loading question...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // MAIN
  // =====================================================

  return (
    <div className="min-h-screen bg-[#f4f5f3]">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="bg-[#f4f5f3] border-b border-[#d9e1dc]">
        <div className="max-w-6xl mx-auto px-5 sm:px-7 lg:px-8 py-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold mb-3">
            <span className="text-[#e19f00] uppercase tracking-[0.15em]">
              Teacher Portal
            </span>

            <span className="text-[#9aa7a1]">
              /
            </span>

            <button
              type="button"
              onClick={() => navigate("/questions")}
              className="text-[#687770] hover:text-[#0b5968] transition"
            >
              Question Bank
            </button>

            <span className="text-[#9aa7a1]">
              /
            </span>

            <span className="text-[#687770]">
              Edit Question
            </span>
          </div>

          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>
              <h1 className="text-3xl font-bold text-[#102a25]">
                Edit Question
              </h1>

              <p className="mt-1 text-sm text-[#687770]">
                Update the question, options and scoring details.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/questions")}
              className="self-start sm:self-auto px-4 py-2.5 rounded-lg border border-[#cbd7d1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#f0f5f2] transition"
            >
              <ArrowLeftIcon size={14} /> Back to Question Bank
            </button>

          </div>

        </div>
      </div>

      {/* =================================================
          CONTENT
      ================================================= */}

      <main className="max-w-6xl mx-auto px-5 sm:px-7 lg:px-8 py-7">

        <form onSubmit={handleSave}>
          {/* Difficulty */}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Difficulty Level
            </label>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6">


            {/* =================================================
                LEFT FORM
            ================================================= */}

            <div className="space-y-6">

              {/* QUESTION CARD */}

              <section className="bg-white border border-[#d6dfda] rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-[#e0e6e2]">

                  <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-[#e9f2ee] flex items-center justify-center text-[#0b5968] font-bold">
                      01
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-[#102a25]">
                        Question Details
                      </h2>

                      <p className="text-xs text-[#75827c] mt-0.5">
                        Edit the question content.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-6">

                  <label className="block text-sm font-bold text-[#102a25] mb-2">
                    Question
                  </label>

                  <textarea
                    value={questionText}
                    onChange={(e) =>
                      setQuestionText(e.target.value)
                    }
                    rows={6}
                    required
                    placeholder="Enter your question..."
                    className="w-full border border-[#cbd7d1] rounded-xl px-4 py-3.5 text-[15px] text-[#102a25] placeholder:text-[#9aa7a1] outline-none resize-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                  />

                  <p className="mt-2 text-xs text-[#87938e]">
                    Make sure the question is clear and easy to understand.
                  </p>

                </div>

              </section>

              {/* IMAGE CARD */}

              <section className="bg-white border border-[#d6dfda] rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-[#e0e6e2]">

                  <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-[#fff4cf] flex items-center justify-center text-[#946900]">
                      <GridSquareIcon size={18} />
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-[#102a25]">
                        Question Image
                      </h2>

                      <p className="text-xs text-[#75827c] mt-0.5">
                        Image attached to this question.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-6">

                  {questionImage ? (
                    <div className="relative w-fit">

                      <div className="rounded-xl border border-[#d5dfda] bg-[#fafbf9] p-3">

                        <img
                          src={questionImage}
                          alt="Question"
                          className="max-w-full sm:max-w-lg max-h-72 object-contain rounded-lg"
                        />

                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setQuestionImage("")
                        }
                        className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-[#fff0ed] border border-[#efc8bf] text-[#bd5444] flex items-center justify-center text-xl font-bold shadow-sm hover:bg-[#bd5444] hover:text-white transition"
                        title="Remove image"
                      >
                        <CloseIcon size={16} />
                      </button>

                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#cbd7d1] bg-[#fafbf9] px-6 py-10 text-center">

                      <div className="w-12 h-12 mx-auto rounded-xl bg-[#e9f2ee] flex items-center justify-center text-[#0b5968] text-xl">
                        <GridSquareIcon size={20} />
                      </div>

                      <p className="mt-3 text-sm font-semibold text-[#52635b]">
                        No question image
                      </p>

                      <p className="mt-1 text-xs text-[#87938e]">
                        This question does not have an image attached.
                      </p>

                    </div>
                  )}

                </div>

              </section>

              {/* OPTIONS CARD */}

              <section className="bg-white border border-[#d6dfda] rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-[#e0e6e2] flex items-center justify-between gap-4">

                  <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-[#e9f2ee] flex items-center justify-center text-[#0b5968] font-bold">
                      02
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-[#102a25]">
                        Answer Options
                      </h2>

                      <p className="text-xs text-[#75827c] mt-0.5">
                        Select the correct answer.
                      </p>
                    </div>

                  </div>

                  {options.length < 5 && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="shrink-0 px-3.5 py-2 rounded-lg bg-[#e9f2ee] text-[#0b5968] text-sm font-bold hover:bg-[#dcebe4] transition"
                    >
                      + Add Option
                    </button>
                  )}

                </div>

                <div className="p-6">

                  <div className="space-y-3">

                    {options.map((option, index) => {

                      const letter =
                        String.fromCharCode(65 + index);

                      const isCorrect =
                        correctAnswer === index;

                      return (
                        <div
                          key={index}
                          className={`group rounded-xl border p-3 transition ${isCorrect
                            ? "border-[#9dc7ae] bg-[#eef8f1]"
                            : "border-[#d6dfda] bg-white hover:border-[#b9c9c1]"
                            }`}
                        >

                          <div className="flex items-center gap-3">

                            {/* RADIO */}

                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={isCorrect}
                              onChange={() =>
                                setCorrectAnswer(index)
                              }
                              className="w-[18px] h-[18px] accent-[#0b211a] cursor-pointer shrink-0"
                            />

                            {/* LETTER */}

                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isCorrect
                                ? "bg-[#0b211a] text-[#f5b91e]"
                                : "bg-[#edf2ef] text-[#29463b]"
                                }`}
                            >
                              {letter}
                            </div>

                            {/* INPUT */}

                            <input
                              type="text"
                              value={option}
                              onChange={(e) =>
                                handleOptionChange(
                                  index,
                                  e.target.value
                                )
                              }
                              placeholder={`Option ${letter}`}
                              className={`flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] ${isCorrect
                                ? "text-[#17643a] font-semibold"
                                : "text-[#102a25]"
                                }`}
                            />

                            {/* CORRECT */}

                            {isCorrect && (
                              <span className="hidden sm:block px-2.5 py-1 rounded-full bg-[#d8f0df] text-[#237044] text-[10px] font-bold uppercase tracking-wide shrink-0">
                                Correct
                              </span>
                            )}

                            {/* REMOVE */}

                            {options.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  removeOption(index)
                                }
                                className="w-8 h-8 rounded-lg bg-[#fff0ed] text-[#bd5444] flex items-center justify-center font-bold hover:bg-[#bd5444] hover:text-white transition shrink-0"
                                title={`Remove option ${letter}`}
                              >
                                <CloseIcon size={16} />
                              </button>
                            )}

                          </div>

                        </div>
                      );
                    })}

                  </div>

                  <div className="mt-4 flex items-start gap-2 px-3 py-3 rounded-lg bg-[#f7f9f8] border border-[#e2e8e4]">

                    <span className="text-[#0b5968] font-bold">
                      <CheckIcon size={16} />
                    </span>

                    <p className="text-xs leading-5 text-[#6c7b74]">
                      Select the radio button next to the correct answer.
                      You can keep between 2 and 5 options.
                    </p>

                  </div>

                </div>

              </section>

              {/* SCORING CARD */}

              <section className="bg-white border border-[#d6dfda] rounded-2xl shadow-sm overflow-hidden">

                <div className="px-6 py-5 border-b border-[#e0e6e2]">

                  <div className="flex items-center gap-3">

                    <div className="w-9 h-9 rounded-lg bg-[#fff0ed] flex items-center justify-center text-[#bd5444] font-bold">
                      03
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-[#102a25]">
                        Question Settings
                      </h2>

                      <p className="text-xs text-[#75827c] mt-0.5">
                        Subject and scoring information.
                      </p>
                    </div>

                  </div>

                </div>

                <div className="p-6">

                  <div className="mb-5">

                    <label className="block text-sm font-bold text-[#102a25] mb-2">
                      Subject
                    </label>

                    <input
                      type="text"
                      value={subject}
                      onChange={(e) =>
                        setSubject(e.target.value)
                      }
                      placeholder="e.g. General Awareness"
                      className="w-full border border-[#cbd7d1] rounded-xl px-4 py-3 text-[15px] text-[#102a25] placeholder:text-[#9aa7a1] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                    />

                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div>

                      <label className="block text-sm font-bold text-[#102a25] mb-2">
                        Marks
                      </label>

                      <div className="relative">

                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={marks}
                          onChange={(e) =>
                            setMarks(e.target.value)
                          }
                          className="w-full border border-[#cbd7d1] rounded-xl px-4 py-3 text-[15px] text-[#102a25] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#87938e]">
                          MARKS
                        </span>

                      </div>

                    </div>

                    <div>

                      <label className="block text-sm font-bold text-[#102a25] mb-2">
                        Negative Marks
                      </label>

                      <div className="relative">

                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={negativeMarks}
                          onChange={(e) =>
                            setNegativeMarks(e.target.value)
                          }
                          className="w-full border border-[#cbd7d1] rounded-xl px-4 py-3 text-[15px] text-[#102a25] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#87938e]">
                          NEGATIVE
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

              </section>

            </div>

            {/* =================================================
                RIGHT SUMMARY
            ================================================= */}

            <aside className="lg:sticky lg:top-6 h-fit space-y-5">

              {/* SUMMARY */}

              <div className="bg-[#0b211a] rounded-2xl border border-[#29463b] p-5 shadow-sm">

                <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#f5b91e]">
                  Question Summary
                </p>

                <h2 className="mt-2 text-lg font-bold text-[#f4efe3]">
                  Edit Question
                </h2>

                <div className="mt-5 space-y-3">

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-[#aebdb6]">
                      Options
                    </span>

                    <span className="text-sm font-bold text-[#f4efe3]">
                      {options.length}
                    </span>

                  </div>

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-[#aebdb6]">
                      Correct Option
                    </span>

                    <span className="w-7 h-7 rounded-full bg-[#f5b91e] text-[#0b211a] flex items-center justify-center text-xs font-bold">
                      {String.fromCharCode(
                        65 + correctAnswer
                      )}
                    </span>

                  </div>

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-[#aebdb6]">
                      Marks
                    </span>

                    <span className="text-sm font-bold text-[#f4efe3]">
                      +{marks || 0}
                    </span>

                  </div>

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-[#aebdb6]">
                      Negative
                    </span>

                    <span className="text-sm font-bold text-[#f4efe3]">
                      -{negativeMarks || 0}
                    </span>

                  </div>

                </div>

              </div>

              {/* HELP */}

              <div className="bg-white border border-[#d6dfda] rounded-2xl p-5">

                <div className="flex items-center gap-3">

                  <div className="w-9 h-9 rounded-lg bg-[#e9f2ee] flex items-center justify-center text-[#0b5968] font-bold">
                    <CheckIcon size={18} />
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[#102a25]">
                      Editing Tips
                    </p>

                    <p className="text-xs text-[#7a8882]">
                      Before saving
                    </p>
                  </div>

                </div>

                <div className="mt-4 space-y-3">

                  <p className="text-xs leading-5 text-[#64736c]">
                    Check the question wording.
                  </p>

                  <p className="text-xs leading-5 text-[#64736c]">
                    Make sure the correct option is selected.
                  </p>

                  <p className="text-xs leading-5 text-[#64736c]">
                    Verify marks and negative marks.
                  </p>

                </div>

              </div>

            </aside>

          </div>

          {/* =================================================
              BOTTOM ACTION BAR
          ================================================= */}

          <div className="mt-6 bg-white border border-[#d6dfda] rounded-2xl shadow-sm px-5 sm:px-6 py-4">

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">

              <div className="w-full sm:w-auto">

                {message && (
                  <div
                    className={`px-4 py-2.5 rounded-lg text-sm border ${message.toLowerCase().includes("success")
                      ? "bg-[#eaf6ef] border-[#b8d9c5] text-[#237044]"
                      : "bg-[#fff0ed] border-[#efc8bf] text-[#bd5444]"
                      }`}
                  >
                    {message}
                  </div>
                )}

              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">

                <button
                  type="button"
                  onClick={() => navigate("/questions")}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg border border-[#cbd7d1] bg-white text-[#53655e] text-sm font-semibold hover:bg-[#f3f6f4] transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-[#0b211a] text-[#f4efe3] text-sm font-bold border border-[#29463b] hover:bg-[#12352a] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {saving
                    ? "Saving Changes..."
                    : "Save Changes"}
                </button>

              </div>

            </div>

          </div>

        </form>

      </main>

    </div>
  );
}

export default EditQuestion;