import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMyTeacherProfile } from "../api/teachers";

function isComplete(profile) {
  return Boolean(profile?.bio?.trim() && profile?.qualifications?.trim() && profile?.years_experience !== null && profile?.years_experience !== undefined && profile?.hourly_rate !== null && profile?.hourly_rate !== undefined && Array.isArray(profile?.subject_ids) && profile.subject_ids.length > 0);
}

export default function TeacherProfileGuard({ children }) {
  const [state, setState] = useState("checking");
  useEffect(() => { let cancelled = false; getMyTeacherProfile().then(profile => { if (!cancelled) setState(isComplete(profile) ? "complete" : "incomplete"); }).catch(() => { if (!cancelled) setState("incomplete"); }); return () => { cancelled = true; }; }, []);
  if (state === "checking") return <div className="min-h-screen bg-void text-chalk flex items-center justify-center"><div className="text-sm text-chalk-muted">Preparing your teacher dashboard…</div></div>;
  if (state === "incomplete") return <Navigate to="/dashboard/teacher/profile" replace />;
  return children;
}
