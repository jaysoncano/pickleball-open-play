import { nameKey } from "@/lib/queue/names";
import type { QueueState } from "@/lib/queue/schema";

/** What the Players tab needs to know about a signed-up pair. */
export type RosterPair = {
  id: string;
  name: string;
  paid: boolean;
  blocked: string | null;
  members: { name: string; checkedIn: boolean }[];
};

export const ROSTER_FILTERS = [
  "all",
  "away",
  "here",
  "unpaid",
  "blocked",
] as const;
export type RosterFilter = (typeof ROSTER_FILTERS)[number];

export const ROSTER_FILTER_LABEL: Record<RosterFilter, string> = {
  all: "All",
  away: "Not checked in",
  here: "Checked in",
  unpaid: "Pay later",
  blocked: "Wrong rank",
};

/** Both players checked in: the pair is at the venue. */
export function isHere(pair: RosterPair): boolean {
  return pair.members.every((m) => m.checkedIn);
}

function matches(pair: RosterPair, filter: RosterFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "away":
      return !isHere(pair);
    case "here":
      return isHere(pair);
    case "unpaid":
      return !pair.paid;
    case "blocked":
      return pair.blocked !== null;
  }
}

/** How many pairs each filter shows. */
export function rosterCounts(
  pairs: RosterPair[],
): Record<RosterFilter, number> {
  return Object.fromEntries(
    ROSTER_FILTERS.map((f) => [f, pairs.filter((p) => matches(p, f)).length]),
  ) as Record<RosterFilter, number>;
}

/**
 * Pairs for a filter whose pair or player names match the search, not
 * checked in first (they need the host), then by name.
 */
export function filterRoster<P extends RosterPair>(
  pairs: P[],
  filter: RosterFilter,
  query: string,
): P[] {
  const key = nameKey(query);
  return pairs
    .filter(
      (p) =>
        matches(p, filter) &&
        (!key ||
          nameKey(p.name).includes(key) ||
          p.members.some((m) => nameKey(m.name).includes(key))),
    )
    .sort(
      (a, b) =>
        Number(isHere(a)) - Number(isHere(b)) || a.name.localeCompare(b.name),
    );
}

/** Where a pair is in the running session right now. */
export type Place =
  | { kind: "court"; label: string; playing: boolean }
  | { kind: "queue"; position: number }
  | { kind: "out" };

export function placeOf(state: QueueState, id: string): Place {
  const court = state.courts.find((c) => c.playerIds.includes(id));
  if (court) {
    return {
      kind: "court",
      label: court.label,
      playing: court.startedAt !== null || court.stoppedAfterMs !== null,
    };
  }
  const index = state.queue.indexOf(id);
  return index >= 0 ? { kind: "queue", position: index + 1 } : { kind: "out" };
}

/** Ranks (skill numbers) of the pairs on court right now, lowest first. */
export function skillsOnCourt(state: QueueState): number[] {
  const skills = new Set<number>();
  for (const court of state.courts) {
    for (const id of court.playerIds) {
      const skill = state.players[id]?.skill;
      if (skill !== undefined) skills.add(skill);
    }
  }
  return [...skills].sort((a, b) => a - b);
}
