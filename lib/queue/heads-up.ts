import { averageGameMs } from "./forecast";
import type { QueueState } from "./schema";

const MIN = 60_000;

/** How long a snoozed unpaid reminder stays away before it comes back. */
export const UNPAID_REMIND_MS = 10 * MIN;

export type UnpaidAlert = {
  /** Unique per pair per game, so dismissing one game doesn't hide the next. */
  key: string;
  courtId: string;
  courtLabel: string;
  pairId: string;
  pairName: string;
};

/**
 * Unpaid pairs in a game right now (running or paused): a heads-up for the
 * host to collect. Seated courts that haven't started don't count yet.
 */
export function unpaidOnCourtAlerts(
  state: QueueState,
  unpaid: ReadonlySet<string>,
): UnpaidAlert[] {
  return state.courts.flatMap((court) => {
    const inGame = court.startedAt !== null || court.stoppedAfterMs !== null;
    if (!inGame) return [];
    return court.playerIds
      .filter((id) => unpaid.has(id))
      .map((id) => ({
        key: `unpaid:${court.id}:${court.startedAt ?? court.stoppedAfterMs}:${id}`,
        courtId: court.id,
        courtLabel: court.label,
        pairId: id,
        pairName: state.players[id]?.name ?? "A pair",
      }));
  });
}

export type StartWarning = {
  /** Whole minutes until the session ends (0 once it's over). */
  minutesLeft: number;
  /** A typical game here, from finished games (or the default). */
  gameMinutes: number;
  /**
   * Waiting players with fewer games than everyone on this court: letting
   * them play first keeps game counts even.
   */
  behind: string[];
};

/**
 * Before a game starts: a warning when there isn't time for a typical game
 * before the session ends, or null when there is.
 */
export function startWarning(
  state: QueueState,
  courtId: string,
  now: number,
): StartWarning | null {
  const court = state.courts.find((c) => c.id === courtId);
  if (!court || court.playerIds.length === 0) return null;
  const gameMs = averageGameMs(state.matches);
  const leftMs = state.endsAt - now;
  if (leftMs >= gameMs) return null;

  const fewest = Math.min(
    ...court.playerIds.map((id) => state.players[id]?.gamesPlayed ?? 0),
  );
  const behind = state.queue
    .filter((id) => (state.players[id]?.gamesPlayed ?? 0) < fewest)
    .map((id) => state.players[id]?.name ?? id);

  return {
    minutesLeft: Math.max(0, Math.floor(leftMs / MIN)),
    gameMinutes: Math.round(gameMs / MIN),
    behind,
  };
}
