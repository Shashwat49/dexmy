import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TeacherLayout from "./components/TeacherLayout";
import { fetchWithAuth } from "./src/api";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "./components/Icons";

function CreateExam() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    duration: "",
    marksPerQuestion: "1",
    negativeMarks: "0",
    isPaid: false,
    price: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        subject: formData.subject.trim(),
        duration: Number(formData.duration),
        marksPerQuestion: Number(formData.marksPerQuestion),
        negativeMarks: Number(formData.negativeMarks),
        isPaid: Boolean(formData.isPaid),
        is_paid: Boolean(formData.isPaid),
        price: formData.isPaid ? Number(formData.price) || 0 : 0,
      };

      let response = await fetchWithAuth("/api/tests", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        response = await fetchWithAuth("/api/test-creation", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create test");
      }

      setSuccessMessage("Test created successfully!");
      const createdId = data.test?.id || data.test?._id;
      setTimeout(() => {
        if (createdId) {
          navigate(`/test-creator/tests/${createdId}/questions`);
        } else {
          navigate("/test-creator/tests");
        }
      }, 800);
    } catch (err) {
      setMessage(err.message || "Something went wrong while creating the test");
    } finally {
      setLoading(false);
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
              Create Test
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-chalk-muted">
              Configure parameters, duration and pricing for your new assessment.
            </p>
          </div>

          <Link
            to="/test-creator/tests"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-4 py-2 text-xs sm:text-sm font-medium text-chalk transition self-start sm:self-auto"
          >
            <ArrowLeftIcon size={14} />
            <span>Back to Tests</span>
          </Link>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-7">
          <div className="max-w-5xl mx-auto">
            {message && (
              <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 sm:px-5 py-3 text-sm text-brand-red">
                {message}
              </div>
            )}
            {successMessage && (
              <div className="mb-6 rounded-xl border border-success/30 bg-success-soft px-4 sm:px-5 py-3 text-sm text-success">
                {successMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Column (2 cols) */}
              <form
                onSubmit={handleSubmit}
                className="lg:col-span-2 rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-7 space-y-5 sm:space-y-6"
              >
                <div>
                  <h2 className="text-base font-semibold text-chalk">Exam Information</h2>
                  <p className="text-xs text-chalk-muted mt-0.5">Basic details shown to candidates</p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Test Title <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. CUET PG General Awareness Mock Test"
                    required
                    className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Subject / Domain <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="e.g. Quantitative Aptitude"
                    required
                    className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                    Description <span className="text-chalk-muted/50 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Brief instructions or topics covered in this assessment…"
                    className="w-full rounded-xl border border-chalk-faint bg-panel-2 px-4 py-3 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition resize-none"
                  />
                </div>

                {/* Configuration Section */}
                <div className="pt-5 border-t border-chalk-faint">
                  <h3 className="text-sm font-semibold text-chalk mb-4">Exam Configuration</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                        Duration (mins) <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="number"
                        name="duration"
                        value={formData.duration}
                        onChange={handleChange}
                        placeholder="60"
                        min="1"
                        required
                        className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                      />
                    </div>

                    {/* Marks Per Question */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                        Marks / Q <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="number"
                        name="marksPerQuestion"
                        value={formData.marksPerQuestion}
                        onChange={handleChange}
                        placeholder="1"
                        min="0.5"
                        step="0.5"
                        required
                        className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                      />
                    </div>

                    {/* Negative Marks */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                        Negative Marks
                      </label>
                      <input
                        type="number"
                        name="negativeMarks"
                        value={formData.negativeMarks}
                        onChange={handleChange}
                        placeholder="0.25"
                        min="0"
                        step="0.25"
                        className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div className="pt-5 border-t border-chalk-faint space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-semibold text-chalk">Paid Assessment</label>
                      <p className="text-xs text-chalk-muted">Require payment before students can attempt</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isPaid"
                        checked={formData.isPaid}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-panel-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
                    </label>
                  </div>

                  {formData.isPaid && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                        Price (INR ₹) <span className="text-brand-red">*</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        placeholder="499"
                        min="1"
                        required={formData.isPaid}
                        className="w-full sm:w-1/2 h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                      />
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="pt-6 border-t border-chalk-faint flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red hover:bg-brand-red-dark px-5 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-chalk transition disabled:opacity-60"
                  >
                    <PlusIcon size={16} />
                    <span>{loading ? "Creating Test…" : "Create Test & Add Questions"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/test-creator/tests")}
                    className="rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-5 py-3 text-xs sm:text-sm font-medium text-chalk transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {/* Sidebar Checklist (1 col) */}
              <div className="space-y-5">
                <div className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-chalk mb-3">Workflow</h3>
                  <div className="space-y-3 text-xs text-chalk-muted">
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-brand-red-soft text-brand-red flex items-center justify-center font-bold text-[10px] shrink-0">
                        1
                      </span>
                      <span>Configure test title, duration, and marking scheme.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-panel-2 text-chalk-muted flex items-center justify-center font-bold text-[10px] shrink-0">
                        2
                      </span>
                      <span>Select or add questions from your question repository.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-panel-2 text-chalk-muted flex items-center justify-center font-bold text-[10px] shrink-0">
                        3
                      </span>
                      <span>Preview candidate experience & publish test.</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-chalk-faint bg-panel p-5 sm:p-6">
                  <h3 className="text-sm font-semibold text-chalk mb-2">Need Questions First?</h3>
                  <p className="text-xs text-chalk-muted leading-relaxed mb-4">
                    You can add questions to your central question bank before or after creating this test.
                  </p>
                  <Link
                    to="/test-creator/questions/add"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-gold hover:underline"
                  >
                    <PlusIcon size={14} />
                    <span>Add to Question Bank</span>
                    <ArrowRightIcon size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default CreateExam;