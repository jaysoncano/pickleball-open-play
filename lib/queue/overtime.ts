import type { QueueState } from "./schema";

export type OvertimeAlert = {
  /** Unique per game, so snoozing one game doesn't hide the next. */
  key: string;
  courtId: string;
  courtLabel: string;
  elapsedMs: number;
};

/** Running games that have gone past the session's overtime limit. */
export function overtimeAlerts(
  state: QueueState,
  now: number,
): OvertimeAlert[] {
  const limitMs = state.config.overtimeMinutes * 60_000;
  return state.courts.flatMap((court) => {
    if (court.startedAt === null) return [];
    const elapsedMs = now - court.startedAt;
    if (elapsedMs < limitMs) return [];
    return [
      {
        key: `${court.id}:${court.startedAt}`,
        courtId: court.id,
        courtLabel: court.label,
        elapsedMs,
      },
    ];
  });
}

/** Hide alerts that are snoozed (key → until when) or dismissed (Infinity). */
export function visibleAlerts(
  alerts: OvertimeAlert[],
  hidden: Record<string, number>,
  now: number,
): OvertimeAlert[] {
  return alerts.filter((a) => !(hidden[a.key] > now));
}
