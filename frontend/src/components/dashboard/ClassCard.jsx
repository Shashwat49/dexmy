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

// TESTING MODE: confirmed bookings are joinable immediately, regardless of
// their scheduled start/end time. Restore production scheduling restrictions later.
function getJoinState(booking) {
  if (booking.status === "completed") return { canJoin: false, label: "Class completed" };
  if (booking.status === "cancelled") return { canJoin: false, label: "Class cancelled" };
  if (booking.status !== "confirmed") return { canJoin: false, label: "Awaiting payment" };
  if (Date.now() < new Date(booking.scheduled_at).getTime() - 5 * 60 * 1000) return { canJoin: false, label: "Join class" };
  return { canJoin: true, label: "Join class" };
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

      {booking.status === "no_show" ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-center">
          <div className="text-sm font-semibold text-amber-300">Student did not join this class</div>
          <p className="mt-1 text-xs text-chalk-muted">This session was recorded as a no-show and one class was deducted from the package. The teacher was not credited for a completed class.</p>
        </div>
      ) : isPast ? (
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
