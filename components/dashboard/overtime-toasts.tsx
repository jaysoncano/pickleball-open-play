import type { OvertimeAlert } from "@/lib/queue/overtime";
import { formatClock } from "@/lib/queue/time";

/**
 * Pop-up alerts for games running long. Notification only: the host
 * decides whether to tell the court.
 */
export function OvertimeToasts({
  alerts,
  limitMinutes,
  onSnooze,
  onDismiss,
}: {
  alerts: OvertimeAlert[];
  limitMinutes: number;
  onSnooze: (key: string) => void;
  onDismiss: (key: string) => void;
}) {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {alerts.map((alert) => (
        <div
          key={alert.key}
          role="alert"
          className="animate-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-3xl bg-white p-4 shadow-[0_20px_50px_-15px_rgba(225,29,72,0.55)] ring-2 ring-rose-300 motion-reduce:animate-none"
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 animate-pulse-soft items-center justify-center rounded-2xl bg-rose-500 text-2xl motion-reduce:animate-none"
          >
            ⏰
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight font-bold text-ink">
              {alert.courtLabel} is running long
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink/60">
              Playing{" "}
              <span className="font-mono text-rose-600 tabular-nums">
                {formatClock(alert.elapsedMs)}
              </span>{" "}
              — over the {limitMinutes} min limit. Give them a heads-up.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onSnooze(alert.key)}
                className="min-h-10 rounded-full bg-rose-500 px-3 font-display text-sm font-semibold text-white hover:bg-rose-400"
              >
                Snooze 5 min
              </button>
              <button
                type="button"
                onClick={() => onDismiss(alert.key)}
                className="min-h-10 rounded-full bg-ink/5 px-3 font-display text-sm font-semibold text-ink/70 hover:bg-ink/10"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
