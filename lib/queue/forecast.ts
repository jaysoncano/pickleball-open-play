import { upNext } from "./engine";
import type { Match, QueueState } from "./schema";

const MIN = 60_000;

/** Assumed game length until the session has finished games to learn from. */
export const DEFAULT_GAME_MS = 15 * MIN;

export function averageGameMs(matches: Match[]): number {
  if (matches.length === 0) return DEFAULT_GAME_MS;
  const total = matches.reduce((n, m) => n + (m.endedAt - m.startedAt), 0);
  return Math.max(MIN, total / matches.length);
}

export type Forecast = {
  /** Average game length the estimate is based on. */
  gameMs: number;
  /** Estimated ms until each waiting player gets on court. */
  startsIn: Record<string, number>;
  /** Waiting players unlikely to start a game before the session ends. */
  atRisk: string[];
};

/**
 * Rough wait times: each court frees up after an average-length game, and
 * the queue's groups take courts in order as they free up.
 */
export function forecast(state: QueueState, now: number): Forecast {
  const gameMs = averageGameMs(state.matches);
  const freeAt = state.courts.map((court) => {
    if (court.startedAt !== null) {
      return Math.max(now, court.startedAt + gameMs);
    }
    if (court.playerIds.length === 0) return now;
    // Paused courts have part of a game left; seated courts a whole one.
    return now + Math.max(0, gameMs - (court.stoppedAfterMs ?? 0));
  });

  const { next, onDeck, remainder } = upNext(state);
  const groups = [...(next.length > 0 ? [next] : []), ...onDeck];
  if (remainder.length > 0) groups.push(remainder);

  const startsIn: Record<string, number> = {};
  for (const group of groups) {
    freeAt.sort((a, b) => a - b);
    const start = freeAt[0];
    freeAt[0] = start + gameMs;
    for (const id of group) startsIn[id] = start - now;
  }

  const atRisk =
    now >= state.endsAt
      ? []
      : state.queue.filter((id) => now + startsIn[id] >= state.endsAt);
  return { gameMs, startsIn, atRisk };
}
