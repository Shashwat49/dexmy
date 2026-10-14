import DashboardLayout from "../../../components/dashboard/DashboardLayout";
import StudentCalendarWidget from "../../../components/dashboard/StudentCalendarWidget";

export default function StudentCalendarPage() {
  return (
    <DashboardLayout>
      <div className="min-h-full px-4 py-5 sm:px-6 lg:px-8">
        <StudentCalendarWidget />
      </div>
    </DashboardLayout>
  );
}
