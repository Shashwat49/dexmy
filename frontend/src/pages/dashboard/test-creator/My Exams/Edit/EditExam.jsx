import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, EditPenIcon, CheckIcon, LockIcon } from "../../components/Icons";

function EditExam() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const onBack = () => {
    navigate("/exams");
  };

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    duration: "",
    marksPerQuestion: "",
    negativeMarks: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // =====================================================
  // FETCH EXAM
  // =====================================================

  useEffect(() => {
    const fetchExam = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `http://localhost:5000/api/exams/${examId}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch exam");
        }

        const exam = data.exam;

        setFormData({
          title: exam.title || "",
          description: exam.description || "",
          subject: exam.subject || "",
          duration: exam.duration || "",
          marksPerQuestion: exam.marksPerQuestion || "",
          negativeMarks: exam.negativeMarks || "",
        });
      } catch (error) {
        setMessage(error.message || "Failed to load exam");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    if (examId) {
      fetchExam();
    }
  }, [examId]);

  // =====================================================
  // HANDLE CHANGE
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (message) {
      setMessage("");
      setMessageType("");
    }
  };

  // =====================================================
  // HANDLE SUBMIT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setMessageType("");

      const response = await fetch(
        `http://localhost:5000/api/exams/${examId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            subject: formData.subject,
            duration: Number(formData.duration),
            marksPerQuestion: Number(formData.marksPerQuestion),
            negativeMarks: Number(formData.negativeMarks),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update exam"
        );
      }

      setMessage("Exam updated successfully.");
      setMessageType("success");

      // =====================================================
      // CREATE NOTIFICATION
      // =====================================================

      const existingNotifications =
        JSON.parse(
          localStorage.getItem("teacherNotifications")
        ) || [];

      const newNotification = {
        id: Date.now(),
        type: "info",
        title: "Exam updated successfully",
        description: `${formData.title} has been updated successfully.`,
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
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f3] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full border-4 border-[#dce8e3] border-t-[#0b211a] animate-spin" />

          <p className="mt-4 text-sm font-medium text-[#5f7069]">
            Loading exam...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-[#f4f5f3] px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* =================================================
            TOP HEADER
        ================================================= */}

        <div className="mb-7">

          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 mb-5 bg-white border border-[#d6ded9] rounded-lg text-sm font-semibold text-[#0b5968] hover:bg-[#f7faf8] hover:border-[#0b5968] transition"
          >
            <ArrowLeftIcon size={16} />

            Back to My Exams
          </button>

          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-[#0b5968]">
              Exam Management
            </p>

            <h1 className="mt-2 text-3xl font-bold text-[#0b211a]">
              Edit Exam
            </h1>

            <p className="mt-1 text-sm text-[#66756f]">
              Update the details and settings of your exam.
            </p>
          </div>

        </div>

        {/* =================================================
            MAIN CARD
        ================================================= */}

        <div className="bg-white border border-[#d9e0dc] rounded-2xl shadow-sm overflow-hidden">

          {/* CARD HEADER */}

          <div className="bg-[#0b211a] px-6 py-5 sm:px-7">

            <div className="flex items-center gap-4">

              <div className="w-11 h-11 rounded-xl bg-[#f5b91e] flex items-center justify-center text-[#071a14] text-xl font-bold">
                <EditPenIcon size={20} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-[#f4efe3]">
                  Exam Details
                </h2>

                <p className="text-xs text-[#b9c8c1] mt-0.5">
                  Modify the information shown to students.
                </p>
              </div>

            </div>

          </div>

          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-7"
          >

            {/* =================================================
                EXAM TITLE
            ================================================= */}

            <div className="mb-6">

              <label className="block text-sm font-semibold text-[#102a25] mb-2">
                Exam Title
              </label>

              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. CUET PG General Awareness Mock Test"
                required
                className="w-full border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 text-[15px] text-[#102a25] placeholder:text-[#8a9691] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
              />

            </div>

            {/* =================================================
                DESCRIPTION
            ================================================= */}

            <div className="mb-6">

              <label className="block text-sm font-semibold text-[#102a25] mb-2">
                Description
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
                placeholder="Enter a short description about this exam..."
                className="w-full resize-none border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 text-[15px] text-[#102a25] placeholder:text-[#8a9691] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
              />

            </div>

            {/* =================================================
                SUBJECT
            ================================================= */}

            <div className="mb-6">

              <label className="block text-sm font-semibold text-[#102a25] mb-2">
                Subject
              </label>

              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="e.g. General Awareness"
                required
                className="w-full border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 text-[15px] text-[#102a25] placeholder:text-[#8a9691] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
              />

            </div>

            {/* =================================================
                EXAM SETTINGS
            ================================================= */}

            <div className="border-t border-[#e1e6e3] pt-6">

              <div className="mb-4">

                <h3 className="text-base font-bold text-[#102a25]">
                  Exam Settings
                </h3>

                <p className="text-sm text-[#718079] mt-1">
                  Configure duration and marking scheme.
                </p>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* DURATION */}

                <div>

                  <label className="block text-sm font-semibold text-[#102a25] mb-2">
                    Duration
                  </label>

                  <div className="relative">

                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      min="1"
                      required
                      className="w-full border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 pr-20 text-[15px] text-[#102a25] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                    />

                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-[#7a8982]">
                      Minutes
                    </span>

                  </div>

                </div>

                {/* MARKS */}

                <div>

                  <label className="block text-sm font-semibold text-[#102a25] mb-2">
                    Marks / Question
                  </label>

                  <input
                    type="number"
                    name="marksPerQuestion"
                    value={formData.marksPerQuestion}
                    onChange={handleChange}
                    min="0"
                    required
                    className="w-full border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 text-[15px] text-[#102a25] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                  />

                </div>

                {/* NEGATIVE MARKS */}

                <div>

                  <label className="block text-sm font-semibold text-[#102a25] mb-2">
                    Negative Marks
                  </label>

                  <input
                    type="number"
                    name="negativeMarks"
                    value={formData.negativeMarks}
                    onChange={handleChange}
                    min="0"
                    step="0.25"
                    required
                    className="w-full border border-[#cbd7d1] bg-white rounded-xl px-4 py-3 text-[15px] text-[#102a25] outline-none transition focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                  />

                </div>

              </div>

            </div>

            {/* =================================================
                MESSAGE
            ================================================= */}

            {message && (
              <div
                className={`mt-6 rounded-xl px-4 py-3 text-sm font-medium border ${messageType === "success"
                    ? "bg-[#eaf6ef] border-[#b8d9c5] text-[#237044]"
                    : "bg-[#fff1f1] border-[#f0c4c4] text-[#c33d3d]"
                  }`}
              >
                <div className="flex items-center gap-2">

                  <span className="font-bold">
                    {messageType === "success"
                      ? <CheckIcon size={14} />
                      : "!"}
                  </span>

                  {message}

                </div>
              </div>
            )}

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-7 pt-6 border-t border-[#e1e6e3]">

              <button
                type="button"
                onClick={onBack}
                disabled={saving}
                className="px-5 py-3 rounded-xl border border-[#b9c8c1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#f5f8f6] transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-[#0b211a] text-[#f4efe3] text-sm font-bold border border-[#29463b] hover:bg-[#12352a] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-[#f4efe3]/30 border-t-[#f5b91e] animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    Save Changes
                    <CheckIcon size={16} className="text-[#f5b91e]" />
                  </>
                )}
              </button>

            </div>

          </form>

        </div>

        {/* =================================================
            FOOT NOTE
        ================================================= */}

        <div className="flex items-center justify-center gap-2 mt-5 text-xs text-[#7b8983]">
          <span><LockIcon size={16} /></span>
          Changes will be saved to your exam.
        </div>

      </div>
    </div>
  );
}

export default EditExam;