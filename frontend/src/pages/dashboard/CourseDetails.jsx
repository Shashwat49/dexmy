import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import { UsersIcon, BookIcon } from "../../components/dashboard/icons";
import * as subjectsApi from "../../api/subjects";

const navItems = [
  {
    label: "Parent",
    items: [
      { path: "/dashboard/parent", label: "My children", icon: <UsersIcon /> },
      { path: "/dashboard/parent/courses", label: "Explore courses", icon: <BookIcon /> },
    ],
  },
];

export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    subjectsApi.getSubject(courseId)
      .then(setCourse)
      .catch((err) => {
        console.error(err);
        setError("Failed to load course details.");
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <DashboardLayout navItems={navItems}>
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-8 md:py-5.5 border-b border-chalk-faint">
        <div>
          <button
            onClick={() => navigate("/dashboard/parent")}
            className="text-chalk-muted text-xs sm:text-sm hover:text-chalk mb-1.5 transition-colors flex items-center gap-1.5"
          >
            ← Back to Dashboard
          </button>
          <h1 className="font-display text-xl sm:text-2xl">{course ? course.name : "Course Details"}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 md:px-8 md:py-7">
        {loading ? (
          <p className="text-chalk-muted text-sm">Loading course details...</p>
        ) : error ? (
          <div className="rounded-xl border border-brand-red/30 bg-brand-red/10 p-5 sm:p-6 text-brand-red text-sm">
            {error}
          </div>
        ) : course ? (
          <div className="max-w-3xl space-y-5 sm:space-y-6">
            <div className="rounded-xl border border-chalk-faint bg-panel-2 p-5 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{course.name}</h2>
              <p className="text-xs sm:text-sm text-chalk-muted leading-relaxed whitespace-pre-wrap">
                {course.description || "No description available for this course."}
              </p>
            </div>
            
            <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-5 sm:px-6 sm:py-5">
              <h3 className="font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">Interested in this course?</h3>
              <p className="text-xs sm:text-sm text-chalk-muted mb-4">
                You can enroll your children in this course by logging in as the student and booking a class.
              </p>
              <button
                onClick={() => navigate("/dashboard/parent")}
                className="bg-brand-gold text-[#2C1E04] text-xs sm:text-sm font-bold px-4.5 py-2.5 rounded-lg hover:bg-[#FFC94D] transition-colors"
              >
                Return to My Children
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
