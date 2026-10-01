import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import TeacherLayout from "../components/TeacherLayout";
import { fetchWithAuth } from "../src/api";
import { ArrowLeftIcon } from "../components/Icons";

function EditTest() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    duration: "",
    marksPerQuestion: "",
    negativeMarks: "",
    isPaid: false,
    price: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setLoading(true);
        let response = await fetchWithAuth(`/api/tests/${testId}`);
        if (!response.ok) {
          response = await fetchWithAuth(`/api/test-creation/${testId}`);
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to fetch test");
        }

        const test = data.test;

        setFormData({
          title: test.title || "",
          description: test.description || "",
          subject: test.subject || "",
          duration: test.duration || "",
          marksPerQuestion: test.marksPerQuestion ?? test.marks_per_question ?? "",
          negativeMarks: test.negativeMarks ?? test.negative_marks ?? "",
          isPaid: Boolean(test.isPaid ?? test.is_paid),
          price: test.price ?? "",
        });
      } catch (err) {
        console.error("FETCH TEST ERROR:", err);
        setError(err.message || "Failed to load test");
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [testId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSaving(true);

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

      let response = await fetchWithAuth(`/api/tests/${testId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        response = await fetchWithAuth(`/api/test-creation/${testId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to update test");
      }

      setSuccessMessage("Test updated successfully!");
      setTimeout(() => {
        navigate("/test-creator/tests");
      }, 800);
    } catch (err) {
      console.error("UPDATE TEST ERROR:", err);
      setError(err.message || "Failed to update test");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <TeacherLayout>
        <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk p-12 text-center text-chalk-muted">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-chalk-muted border-t-brand-red" />
          <p className="text-sm">Loading test details…</p>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="flex-1 flex flex-col min-w-0 bg-void text-chalk">
        {/* Header */}
        <div className="border-b border-chalk-faint px-6 lg:px-8 py-5.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-chalk-muted opacity-60">
              Assessment Management
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-tight text-chalk">
              Edit Test
            </h1>
            <p className="mt-1 text-sm text-chalk-muted">
              Update test parameters, duration, and pricing configuration.
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
        <div className="flex-1 overflow-auto px-6 lg:px-8 py-7">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-5 py-3.5 text-sm text-brand-red">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-6 rounded-xl border border-success/30 bg-success-soft px-5 py-3.5 text-sm text-success">
                {successMessage}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-chalk-faint bg-panel p-6 sm:p-7 space-y-6"
            >
              <div>
                <h2 className="text-base font-semibold text-chalk">Edit Information</h2>
                <p className="text-xs text-chalk-muted mt-0.5">Modify test details and settings</p>
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
                  required
                  className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full rounded-xl border border-chalk-faint bg-panel-2 px-4 py-3 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition resize-none"
                />
              </div>

              {/* Configuration */}
              <div className="pt-5 border-t border-chalk-faint">
                <h3 className="text-sm font-semibold text-chalk mb-4">Exam Configuration</h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                      Duration (mins) <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      min="1"
                      required
                      className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                      Marks / Q <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="number"
                      name="marksPerQuestion"
                      value={formData.marksPerQuestion}
                      onChange={handleChange}
                      min="0.5"
                      step="0.5"
                      required
                      className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-chalk-muted mb-2">
                      Negative Marks
                    </label>
                    <input
                      type="number"
                      name="negativeMarks"
                      value={formData.negativeMarks}
                      onChange={handleChange}
                      min="0"
                      step="0.25"
                      className="w-full h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="pt-5 border-t border-chalk-faint space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-chalk">Paid Assessment</label>
                    <p className="text-xs text-chalk-muted">Require students to pay before attempting</p>
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
                      min="1"
                      required={formData.isPaid}
                      className="w-full sm:w-1/2 h-11 rounded-xl border border-chalk-faint bg-panel-2 px-4 text-sm text-chalk placeholder:text-chalk-muted/50 focus:border-brand-red focus:outline-none transition"
                    />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="pt-6 border-t border-chalk-faint flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red hover:bg-brand-red-dark px-6 py-3 text-sm font-semibold text-chalk transition disabled:opacity-60"
                >
                  {saving ? "Saving Changes…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/test-creator/tests")}
                  className="rounded-xl bg-panel-2 hover:bg-panel-3 border border-chalk-faint px-5 py-3 text-sm font-medium text-chalk transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default EditTest;