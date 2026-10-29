import type { DayMember, DayPair, PendingPair } from "@/lib/db/queries";
import { nameKey } from "@/lib/queue/names";

/** One line of the desk's table: a pair (paid or not) or a solo player. */
export type DeskRow =
  | { kind: "unpaid"; id: string; notes: string; pair: PendingPair }
  | { kind: "paid"; id: string; notes: string; pair: DayPair }
  | { kind: "solo"; id: string; notes: string; member: DayMember };

export const DESK_FILTERS = ["all", "paid", "unpaid", "notes", "solo"] as const;
export type DeskFilter = (typeof DESK_FILTERS)[number];

export const FILTER_LABEL: Record<DeskFilter, string> = {
  all: "All",
  paid: "Paid",
  unpaid: "Unpaid",
  notes: "Notes",
  solo: "Solo",
};

/** Unpaid first (they need the desk), then paid pairs, then solos. */
export function deskRows(day: {
  pairs: DayPair[];
  pending: PendingPair[];
  solos: DayMember[];
}): DeskRow[] {
  return [
    ...day.pending.map((pair) => ({
      kind: "unpaid" as const,
      id: pair.id,
      notes: pair.notes,
      pair,
    })),
    ...day.pairs.map((pair) => ({
      kind: "paid" as const,
      id: pair.id,
      notes: pair.notes,
      pair,
    })),
    ...day.solos.map((member) => ({
      kind: "solo" as const,
      id: member.playerId,
      notes: "",
      member,
    })),
  ];
}

/** The people on a row, for search and display. */
export function rowMembers(row: DeskRow): DayMember[] {
  return row.kind === "solo" ? [row.member] : row.pair.members;
}

function matches(row: DeskRow, filter: DeskFilter): boolean {
  if (filter === "all") return true;
  if (filter === "notes") return row.notes.trim() !== "";
  return row.kind === filter;
}

/** How many rows each filter shows. */
export function filterCounts(rows: DeskRow[]): Record<DeskFilter, number> {
  return Object.fromEntries(
    DESK_FILTERS.map((f) => [f, rows.filter((r) => matches(r, f)).length]),
  ) as Record<DeskFilter, number>;
}

/** Rows for a filter whose players' names (or the notes) match the search. */
export function filterRows(
  rows: DeskRow[],
  filter: DeskFilter,
  query: string,
): DeskRow[] {
  const key = nameKey(query);
  return rows.filter(
    (r) =>
      matches(r, filter) &&
      (!key ||
        nameKey(r.notes).includes(key) ||
        rowMembers(r).some(
          (m) =>
            nameKey(m.name).includes(key) || nameKey(m.fullName).includes(key),
        )),
  );
}

/** "Ana Maria Cruz" → first "Ana Maria", last "Cruz"; one word is a first name. */
export function splitName(name: string): {
  firstName: string;
  lastName: string;
} {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] ?? "", lastName: "" };
  return {
    firstName: words.slice(0, -1).join(" "),
    lastName: words[words.length - 1],
  };
}

/**
 * A random partner for a solo player from the other solos, or null when
 * there's no one else. `rng` returns [0, 1), like Math.random.
 */
export function randomPartner<T extends { playerId: string }>(
  solos: T[],
  playerId: string,
  rng: () => number,
): T | null {
  const others = solos.filter((s) => s.playerId !== playerId);
  if (others.length === 0) return null;
  return others[Math.min(others.length - 1, Math.floor(rng() * others.length))];
}

/**
 * Every solo paired at random: shuffled (Fisher–Yates), then two by two.
 * With an odd count, one is left to wait for a partner.
 */
export function shufflePairs<T>(
  solos: T[],
  rng: () => number,
): { pairs: [T, T][]; left: T | null } {
  const deck = [...solos];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const pairs: [T, T][] = [];
  for (let i = 0; i + 1 < deck.length; i += 2)
    pairs.push([deck[i], deck[i + 1]]);
  return { pairs, left: deck.length % 2 ? deck[deck.length - 1] : null };
}
