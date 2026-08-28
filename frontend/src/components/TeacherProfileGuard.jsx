import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMyTeacherProfile } from "../api/teachers";

const PROFILE_CHECK_KEY = "dexmy_teacher_profile_complete";

function isComplete(profile) {
  return Boolean(
    profile?.bio?.trim() &&
      profile?.qualifications?.trim() &&
      profile?.years_experience !== null &&
      profile?.years_experience !== undefined &&
      profile?.hourly_rate !== null &&
      profile?.hourly_rate !== undefined &&
      Array.isArray(profile?.subject_ids) &&
      profile.subject_ids.length > 0
  );
}

function getCachedProfileState() {
  try {
    return sessionStorage.getItem(PROFILE_CHECK_KEY) === "true"
      ? "complete"
      : null;
  } catch {
    return null;
  }
}

export default function TeacherProfileGuard({ children }) {
  const cachedState = getCachedProfileState();
  const [state, setState] = useState(cachedState || "checking");

  useEffect(() => {
    // A completed teacher profile has already been checked during this browser session.
    // Avoid making another API request every time the teacher returns to the dashboard.
    if (cachedState === "complete") return;

    let cancelled = false;

    getMyTeacherProfile()
      .then((profile) => {
        if (cancelled) return;

        if (isComplete(profile)) {
          try {
            sessionStorage.setItem(PROFILE_CHECK_KEY, "true");
          } catch {
            // Ignore storage errors; the in-memory state still works.
          }
          setState("complete");
        } else {
          setState("incomplete");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [cachedState]);

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-void text-chalk flex items-center justify-center">
        <div className="text-sm text-chalk-muted">Checking teacher profile…</div>
      </div>
    );
  }

  if (state === "incomplete") {
    return <Navigate to="/dashboard/teacher/profile" replace />;
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-void text-chalk flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold">Unable to load your profile</h1>
          <p className="mt-2 text-sm text-chalk-muted">
            Please refresh and try again. Your account has not been changed.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
}
