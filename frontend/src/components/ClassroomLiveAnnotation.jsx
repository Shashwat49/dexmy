import { useAuth } from "../context/AuthContext";
import ClassroomPro from "../pages/ClassroomPro";

export default function ClassroomLiveAnnotation() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";

  return (
    <div data-classroom-role={isTeacher ? "teacher" : "student"} className="h-[100dvh] w-full overflow-hidden">
      <style>{`
        [data-classroom-role] aside {
          width: 380px !important;
          flex: 0 0 380px !important;
          overflow: hidden !important;
          transition: none !important;
        }

        [data-classroom-role] aside > div {
          width: 100% !important;
        }

        /* The right rail is persistent: chat is never collapsed/hidden. */
        [data-classroom-role] aside > div > div:first-child > button {
          display: none !important;
        }

        /* Two equal participant tiles: teacher first, student second. */
        [data-classroom-role] aside > div > div:nth-child(2) {
          height: 280px !important;
          min-height: 280px !important;
          flex: 0 0 280px !important;
          padding: 8px 12px 10px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          position: relative !important;
        }

        [data-classroom-role] #remote-stage,
        [data-classroom-role] #local-stage {
          position: relative !important;
          inset: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          top: auto !important;
          width: 100% !important;
          height: 132px !important;
          min-height: 132px !important;
          flex: 1 1 0 !important;
          aspect-ratio: 16 / 9 !important;
          border-radius: 10px !important;
        }

        /* Teacher view: local teacher tile first, remote student second. */
        [data-classroom-role="teacher"] #local-stage { order: 1 !important; }
        [data-classroom-role="teacher"] #remote-stage { order: 2 !important; }

        /* Student view: remote teacher tile first, local student second. */
        [data-classroom-role="student"] #remote-stage { order: 1 !important; }
        [data-classroom-role="student"] #local-stage { order: 2 !important; }

        /* Keep the camera-off placeholder inside the tile instead of covering both. */
        [data-classroom-role] #remote-stage > .absolute.inset-0.grid {
          pointer-events: none !important;
        }

        /* Chat remains visible and occupies the rest of the right rail. */
        [data-classroom-role] aside > div > div:nth-child(4) {
          min-height: 0 !important;
        }

        /* Remove the old Hide chat control from the bottom toolbar. */
        [data-classroom-role] section > div:last-child > button:nth-child(4) {
          display: none !important;
        }
      `}</style>
      <ClassroomPro />
    </div>
  );
}
