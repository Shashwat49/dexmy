import { useAuth } from "../context/AuthContext";
import ClassroomProFixed2 from "../pages/ClassroomProFixed2";

export default function ClassroomLiveAnnotation() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  return (
    <div data-classroom-role={isTeacher ? "teacher" : "student"} className="h-[100dvh] w-full overflow-hidden">
      <style>{`
        [data-classroom-role] aside { width: 380px !important; flex: 0 0 380px !important; overflow: hidden !important; }
        [data-classroom-role] aside > div { width: 100% !important; }
        [data-classroom-role] aside > div > div:nth-child(2) { height: 560px !important; min-height: 560px !important; flex: 0 0 560px !important; }
        [data-classroom-role] #remote-stage, [data-classroom-role] #local-stage { aspect-ratio: 4 / 3 !important; min-height: 0 !important; height: auto !important; }
        [data-classroom-role="teacher"] #local-stage { order: 1 !important; }
        [data-classroom-role="teacher"] #remote-stage { order: 2 !important; }
        [data-classroom-role="student"] #remote-stage { order: 1 !important; }
        [data-classroom-role="student"] #local-stage { order: 2 !important; }
      `}</style>
      <ClassroomProFixed2 />
    </div>
  );
}
