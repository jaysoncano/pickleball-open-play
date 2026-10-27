import type { PairHistory } from "./schema";

/** Random number in [0, 1). Injected so tests can be deterministic. */
export type Rng = () => number;

/** Weight of a past partnership versus a past match-up when scoring. */
const TEAMMATE_WEIGHT = 2;

export function emptyHistory(): PairHistory {
  return { teammates: {}, opponents: {} };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function count(record: Record<string, number>, a: string, b: string) {
  return record[pairKey(a, b)] ?? 0;
}

function bump(record: Record<string, number>, a: string, b: string) {
  const key = pairKey(a, b);
  record[key] = (record[key] ?? 0) + 1;
}

/** Times two players have already shared a court, on either side. */
export function timesMet(history: PairHistory, a: string, b: string): number {
  return count(history.teammates, a, b) + count(history.opponents, a, b);
}

/** Record a finished game. The first half of `playerIds` is one team. */
export function recordGame(
  history: PairHistory,
  playerIds: string[],
): PairHistory {
  const teammates = { ...history.teammates };
  const opponents = { ...history.opponents };
  const half = Math.ceil(playerIds.length / 2);
  const teams = [playerIds.slice(0, half), playerIds.slice(half)];
  for (const team of teams) {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        bump(teammates, team[i], team[j]);
      }
    }
  }
  for (const a of teams[0]) for (const b of teams[1]) bump(opponents, a, b);
  return { teammates, opponents };
}

/** Repeat encounters inside a group; lower is fresher. */
export function groupRepeats(history: PairHistory, group: string[]): number {
  let total = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      total += timesMet(history, group[i], group[j]);
    }
  }
  return total;
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      result.push([items[i], ...rest]);
    }
  }
  return result;
}

/** Lowest-scoring option; ties are broken at random. */
function pickBest<T>(options: T[], score: (option: T) => number, rng: Rng) {
  let best = options[0];
  let bestScore = Infinity;
  for (const option of options) {
    const value = score(option) + rng() * 0.5;
    if (value < bestScore) {
      best = option;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Scoring priorities, highest first: keep games balanced, then avoid
 * rematches, then respect the order people joined the line.
 */
const GAMES_WEIGHT = 1000;
const REPEAT_WEIGHT = 20;
const POSITION_WEIGHT = 1;

/**
 * Order a waiting line into game groups, fairest first:
 *
 * 1. Players with fewer games go first; ties keep line order (longest wait
 *    first). Late arrivals and anyone who missed out catch up this way.
 * 2. Each group includes the first player in that order, then picks the
 *    rest from the next few, preferring people who haven't met yet. A short
 *    window keeps the order fair: nobody can be skipped for long.
 */
export function planQueue(
  queue: string[],
  capacity: number,
  history: PairHistory,
  rng: Rng,
  games: Record<string, number> = {},
): string[] {
  const played = (id: string) => games[id] ?? 0;
  // Array sort is stable, so equal games keep their place in line.
  const rest = [...queue].sort((a, b) => played(a) - played(b));
  const planned: string[] = [];
  while (rest.length >= capacity) {
    const [head, ...window] = rest.slice(0, capacity * 2);
    const group = [
      head,
      ...pickBest(
        combinations(window, capacity - 1),
        (picks) =>
          GAMES_WEIGHT * picks.reduce((n, id) => n + played(id), 0) +
          // Also score who is left behind, so one group doesn't take all the
          // fresh faces and leave the next group full of rematches.
          REPEAT_WEIGHT *
            (groupRepeats(history, [head, ...picks]) +
              groupRepeats(
                history,
                window.filter((id) => !picks.includes(id)),
              )) +
          POSITION_WEIGHT * picks.reduce((n, id) => n + window.indexOf(id), 0),
        rng,
      ),
    ];
    planned.push(...group);
    for (const id of group) rest.splice(rest.indexOf(id), 1);
  }
  return [...planned, ...rest];
}

/**
 * Split a doubles group into fresh teams: avoid repeat partners first, then
 * repeat opponents. Returns team A then team B. Singles are left as-is.
 */
export function arrangeTeams(
  group: string[],
  history: PairHistory,
  rng: Rng,
): string[] {
  if (group.length !== 4) return group;
  const [a, b, c, d] = group;
  const splits = [
    [a, b, c, d],
    [a, c, b, d],
    [a, d, b, c],
  ];
  return pickBest(
    splits,
    ([p, q, r, s]) =>
      TEAMMATE_WEIGHT *
        (count(history.teammates, p, q) + count(history.teammates, r, s)) +
      count(history.opponents, p, r) +
      count(history.opponents, p, s) +
      count(history.opponents, q, r) +
      count(history.opponents, q, s),
    rng,
  );
}
