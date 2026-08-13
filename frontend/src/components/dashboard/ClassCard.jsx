const formatDateTime = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
};

const initials = (name) =>
  name ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?";

// A booking is "joinable" from 10 minutes before its scheduled time until
// its slot ends — outside that window the join button stays disabled.
function getJoinState(booking) {
  const now = new Date();
  const start = new Date(booking.scheduled_at);
  const end = new Date(start.getTime() + booking.duration_minutes * 60000);
  const joinOpensAt = new Date(start.getTime() - 10 * 60000);

  if (booking.status !== "confirmed") return { canJoin: false, label: "Awaiting payment" };
  if (now < joinOpensAt) return { canJoin: false, label: `Starts ${formatDateTime(booking.scheduled_at)}` };
  if (now >= joinOpensAt && now <= end) return { canJoin: true, label: "Join class" };
  return { canJoin: false, label: "Class ended" };
}

export default function ClassCard({ booking, otherPartyName, onJoin, onDownloadNotes, isPast }) {
  const joinState = !isPast ? getJoinState(booking) : null;

  return (
    <div className="bg-panel border border-chalk-faint rounded-xl p-5 hover:border-chalk-muted transition-colors">
      <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-brand-red-soft px-2.5 py-1 rounded mb-3">
        {booking.subject_name}
      </span>

      <div className="flex items-center gap-2.5 mb-3.5">
        <div className="w-[30px] h-[30px] rounded-full bg-panel-3 flex items-center justify-center text-xs font-bold text-chalk-muted">
          {initials(otherPartyName)}
        </div>
        <div className="text-sm font-semibold">{otherPartyName}</div>
      </div>

      <div className="text-[13px] text-chalk-muted mb-4">{formatDateTime(booking.scheduled_at)}</div>

      {isPast ? (
        <button
          onClick={() => onDownloadNotes?.(booking)}
          className="w-full border border-chalk-muted hover:border-brand-gold hover:text-brand-gold transition-colors text-sm font-semibold py-2.5 rounded-lg"
        >
          Download notes
        </button>
      ) : (
        <button
          disabled={!joinState.canJoin}
          onClick={() => onJoin?.(booking)}
          className={`w-full text-sm font-semibold py-2.5 rounded-lg transition-colors ${
            joinState.canJoin
              ? "bg-brand-red hover:bg-brand-red-dark"
              : "border border-chalk-muted text-chalk-muted opacity-60 cursor-not-allowed"
          }`}
        >
          {joinState.label}
        </button>
      )}
    </div>
  );
}