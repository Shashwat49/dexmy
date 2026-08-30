import { useAuth } from "../context/AuthContext";
import ClassroomProFixed from "../pages/ClassroomProFixed";

export default function ClassroomLiveAnnotation() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  return (
    <div data-classroom-role={isTeacher ? "teacher" : "student"} className="h-[100dvh] w-full overflow-hidden">
      <style>{`
        [data-classroom-role] aside { width: 380px !important; flex: 0 0 380px !important; overflow: hidden !important; transition: none !important; }
        [data-classroom-role] aside > div { width: 100% !important; }
        [data-classroom-role] aside > div > div:nth-child(2) { height: 280px !important; min-height: 280px !important; flex: 0 0 280px !important; }
        [data-classroom-role] #remote-stage, [data-classroom-role] #local-stage { aspect-ratio: 4 / 3 !important; }
        [data-classroom-role] #remote-stage, [data-classroom-role] #local-stage { min-height: 0 !important; height: auto !important; }
        [data-classroom-role="teacher"] #local-stage { order: 1 !important; }
        [data-classroom-role="teacher"] #remote-stage { order: 2 !important; }
        [data-classroom-role="student"] #remote-stage { order: 1 !important; }
        [data-classroom-role="student"] #local-stage { order: 2 !important; }
        [data-classroom-role] section > div:last-child > button:nth-child(4) { display: none !important; }
      `}</style>
      <ClassroomProFixed />
    </div>
  );
}
