import { planQueue, type Rng } from "./matchmaking";
import type { PairHistory } from "./schema";

/**
 * Ranked open play: units (pairs) carry a `skill`, courts may carry a
 * `rank`, and units only ever play units of the same skill. Each skill is
 * its own line inside the one queue. Without skills, everything below
 * behaves like a single line.
 */

export type Skills = Record<string, number>;

/** The line a unit stands in: its skill, or -1 when it has none. */
export function lineOf(skill: Skills, id: string): number {
  return skill[id] ?? -1;
}

/**
 * The next game for a court: the first `cap` units of the court's rank,
 * in queue order. A court with no rank takes the line of whoever is first
 * in the queue. Null when that line can't fill a court yet.
 */
export function takeGroup(
  queue: string[],
  cap: number,
  skill: Skills,
  rank: number | null,
): { group: string[]; rest: string[] } | null {
  if (queue.length === 0) return null;
  const line = rank ?? lineOf(skill, queue[0]);
  const group = queue.filter((id) => lineOf(skill, id) === line).slice(0, cap);
  if (group.length < cap) return null;
  return { group, rest: queue.filter((id) => !group.includes(id)) };
}

/** The next unit for a court with an open slot, from its rank's line. */
export function takeOne(
  queue: string[],
  skill: Skills,
  line: number,
): { id: string; rest: string[] } | null {
  const id = queue.find((u) => lineOf(skill, u) === line);
  return id === undefined ? null : { id, rest: queue.filter((u) => u !== id) };
}

/**
 * Full games waiting, in the order they'd go on: each line fills a group
 * as its units come up in the queue. Also returns who is left over.
 */
export function queueGroups(
  queue: string[],
  cap: number,
  skill: Skills,
): { groups: string[][]; remainder: string[] } {
  const buckets = new Map<number, string[]>();
  const groups: string[][] = [];
  for (const id of queue) {
    const line = lineOf(skill, id);
    const bucket = [...(buckets.get(line) ?? []), id];
    if (bucket.length === cap) {
      groups.push(bucket);
      buckets.delete(line);
    } else {
      buckets.set(line, bucket);
    }
  }
  const grouped = new Set(groups.flat());
  return { groups, remainder: queue.filter((id) => !grouped.has(id)) };
}

/** The first full game of each line: kept in place when the queue re-plans. */
export function nextPerLine(
  queue: string[],
  cap: number,
  skill: Skills,
): string[] {
  const seen = new Set<number>();
  const locked: string[] = [];
  for (const group of queueGroups(queue, cap, skill).groups) {
    const line = lineOf(skill, group[0]);
    if (seen.has(line)) continue;
    seen.add(line);
    locked.push(...group);
  }
  return queue.filter((id) => locked.includes(id));
}

/**
 * Plan each line on its own (fairness and fresh match-ups within a rank),
 * then put each line back into the slots it held, so lines stay
 * interleaved the way people joined.
 */
export function planByLine(
  queue: string[],
  cap: number,
  history: PairHistory,
  rng: Rng,
  games: Record<string, number>,
  skill: Skills,
): string[] {
  const lines = [...new Set(queue.map((id) => lineOf(skill, id)))];
  if (lines.length <= 1) return planQueue(queue, cap, history, rng, games);
  const planned = new Map(
    lines.map((line) => [
      line,
      planQueue(
        queue.filter((id) => lineOf(skill, id) === line),
        cap,
        history,
        rng,
        games,
      ),
    ]),
  );
  return queue.map((id) => planned.get(lineOf(skill, id))!.shift()!);
}

/**
 * Suggest which rank each court plays: courts shared in proportion to
 * how many units each rank has, each rank that can fill a court getting
 * at least one while courts last. Ranks are listed in court order.
 */
export function suggestCourtRanks(
  courtCount: number,
  unitsPerRank: Map<number, number>,
  cap: number,
): number[] {
  const ranks = [...unitsPerRank.entries()]
    .filter(([, n]) => n >= cap)
    .sort((a, b) => a[0] - b[0]);
  if (ranks.length === 0 || courtCount < 1) return [];
  const total = ranks.reduce((n, [, units]) => n + units, 0);
  const counts = new Map(ranks.map(([rank]) => [rank, 0]));
  // One court each first (lowest ranks first if courts run out)...
  for (const [rank] of ranks.slice(0, courtCount)) counts.set(rank, 1);
  // ...then the rest to whoever is furthest below their share.
  for (
    let given = Math.min(courtCount, ranks.length);
    given < courtCount;
    given++
  ) {
    const [rank] = ranks.reduce((best, cur) => {
      const gap = (r: [number, number]) =>
        (r[1] / total) * courtCount - counts.get(r[0])!;
      return gap(cur) > gap(best) ? cur : best;
    });
    counts.set(rank, counts.get(rank)! + 1);
  }
  return ranks.flatMap(([rank]) => Array(counts.get(rank)!).fill(rank));
}
