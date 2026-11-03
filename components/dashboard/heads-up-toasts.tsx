import type { ReactNode } from "react";
import type { UnpaidAlert } from "@/lib/queue/heads-up";
import type { OvertimeAlert } from "@/lib/queue/overtime";
import { formatClock } from "@/lib/queue/time";

/**
 * Pop-up heads-ups for the host, stacked top right: games running long,
 * and unpaid pairs playing right now. Notifications only: the host decides
 * what to do. Snoozed ones come back; dismissed ones stay away for that
 * game.
 */
export function HeadsUpToasts({
  overtime,
  unpaid,
  limitMinutes,
  remindMinutes,
  onSnooze,
  onDismiss,
}: {
  overtime: OvertimeAlert[];
  unpaid: UnpaidAlert[];
  limitMinutes: number;
  /** How long "Remind me later" hides an unpaid reminder. */
  remindMinutes: number;
  onSnooze: (key: string, minutes: number) => void;
  onDismiss: (key: string) => void;
}) {
  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {overtime.map((alert) => (
        <Toast
          key={alert.key}
          emoji="⏰"
          tone="rose"
          title={`${alert.courtLabel} is running long`}
          snoozeLabel="Snooze 5 min"
          onSnooze={() => onSnooze(alert.key, 5)}
          onDismiss={() => onDismiss(alert.key)}
        >
          Playing{" "}
          <span className="font-mono text-rose-600 tabular-nums">
            {formatClock(alert.elapsedMs)}
          </span>{" "}
          — over the {limitMinutes} min limit. Give them a heads-up.
        </Toast>
      ))}
      {unpaid.map((alert) => (
        <Toast
          key={alert.key}
          emoji="💸"
          tone="amber"
          title={`${alert.pairName} hasn't paid`}
          snoozeLabel={`Remind me in ${remindMinutes} min`}
          onSnooze={() => onSnooze(alert.key, remindMinutes)}
          onDismiss={() => onDismiss(alert.key)}
        >
          They&apos;re playing on{" "}
          <b className="text-amber-700">{alert.courtLabel}</b> now. Collect the
          entry fee, then mark them paid in <b>💰 Payments</b>.
        </Toast>
      ))}
    </div>
  );
}

const TONES = {
  rose: {
    card: "shadow-[0_20px_50px_-15px_rgba(225,29,72,0.55)] ring-rose-300",
    icon: "bg-rose-500",
    button: "bg-rose-500 hover:bg-rose-400",
  },
  amber: {
    card: "shadow-[0_20px_50px_-15px_rgba(217,119,6,0.55)] ring-amber-300",
    icon: "bg-amber-400",
    button: "bg-amber-500 hover:bg-amber-400",
  },
} as const;

function Toast({
  emoji,
  tone,
  title,
  children,
  snoozeLabel,
  onSnooze,
  onDismiss,
}: {
  emoji: string;
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
  snoozeLabel: string;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  const t = TONES[tone];
  return (
    <div
      role="alert"
      className={`animate-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-3xl bg-white p-4 ring-2 motion-reduce:animate-none ${t.card}`}
    >
      <span
        aria-hidden
        className={`flex size-11 shrink-0 animate-pulse-soft items-center justify-center rounded-2xl text-2xl motion-reduce:animate-none ${t.icon}`}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg leading-tight font-bold text-ink">
          {title}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink/60">{children}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSnooze}
            className={`min-h-10 rounded-full px-3 font-display text-sm font-semibold text-white ${t.button}`}
          >
            {snoozeLabel}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-10 rounded-full bg-ink/5 px-3 font-display text-sm font-semibold text-ink/70 hover:bg-ink/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
