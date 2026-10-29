import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { QueueState } from "@/lib/queue/schema";
import {
  formatDuration,
  sessionPhase,
  sessionProgress,
} from "@/lib/queue/time";

const timeLabel = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function SessionBar({
  session,
  now,
  onEditTime,
  onEnd,
}: {
  session: QueueState;
  now: number;
  onEditTime: () => void;
  onEnd: () => void;
}) {
  const phase = sessionPhase(session, now);
  const progress = sessionProgress(session, now);

  const status = {
    upcoming: {
      pill: "bg-sky-100 text-sky-700",
      dot: "bg-sky-500",
      label: "Starts soon",
      detail: `Starts in ${formatDuration(session.startsAt - now)}`,
    },
    live: {
      pill: "bg-lime-200 text-lime-900",
      dot: "bg-lime-600 animate-pulse-soft",
      label: "Live",
      detail: `${formatDuration(session.endsAt - now)} left`,
    },
    ended: {
      pill: "bg-rose-100 text-rose-700",
      dot: "bg-rose-500",
      label: "Time's up",
      detail: "Session time is over",
    },
  }[phase];

  return (
    <header className="flex flex-col gap-4 rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          <span aria-hidden>🏓</span> Open play
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onEditTime}>
            <span aria-hidden>⚙️</span> Settings
          </Button>
          <ConfirmButton
            label="End session"
            warning="The open play closes and shows its results: the top pairs, everyone ranked, and every game. It can't be started again."
            confirmText="End session"
            onConfirm={onEnd}
            className="min-h-11 px-4 text-ink/60 hover:bg-rose-50 hover:text-rose-600"
          >
            End session
          </ConfirmButton>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-display font-semibold ${status.pill}`}
          >
            <span
              aria-hidden
              className={`size-2.5 rounded-full motion-reduce:animate-none ${status.dot}`}
            />
            {status.label}
          </span>
          <span className="font-display text-lg font-semibold sm:text-xl">
            {status.detail}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-3 overflow-hidden rounded-full bg-ink/5"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-lime-400 via-sky-400 to-fuchsia-500 transition-[width] duration-1000"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-sm font-semibold text-ink/50">
          <span>{timeLabel.format(session.startsAt)}</span>
          <span>{timeLabel.format(session.endsAt)}</span>
        </div>
      </div>

      {phase === "ended" && (
        <p className="rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-3 font-display font-semibold text-white">
          🎉 That&apos;s a wrap! Edit the time to keep rotating, or end the
          session to start fresh.
        </p>
      )}
    </header>
  );
}
