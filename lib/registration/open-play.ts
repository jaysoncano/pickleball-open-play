import { z } from "zod";
import { ScheduleSchema, SessionDateSchema } from "@/lib/queue/schema";
import { formatTimeLabel, parseTime, sessionMinutes } from "@/lib/queue/time";
import {
  LEVEL_INFO,
  LEVELS,
  LevelSchema,
  levelRank,
  type Level,
} from "@/lib/ranking/levels";
import { VenueSchema } from "@/lib/roles";
import { MAX_FEE } from "./forms";

export const MAX_PAIRS = 200;

/** When, which ranks, how many pairs, and the entry: set and edited. */
const scheduleFields = {
  playDate: SessionDateSchema,
  ...ScheduleSchema.shape,
  /** The ticked ranks; each gets its own line in the queue. */
  levels: z
    .array(LevelSchema)
    .min(1, "Tick at least one rank")
    .transform((ls) => LEVELS.filter((l) => ls.includes(l))),
  maxPairs: z
    .union([z.literal(""), z.coerce.number()])
    .transform((v) => (v === "" ? null : v))
    .pipe(
      z
        .int("Max pairs must be a whole number")
        .min(2, "Allow at least 2 pairs (one court)")
        .max(MAX_PAIRS, `Up to ${MAX_PAIRS} pairs`)
        .nullable(),
    )
    .default(null),
  fee: z.coerce
    .number("Enter the entry fee")
    .min(0, "Fee can't be negative")
    .max(MAX_FEE, "That fee looks too high"),
};

const differentTimes = {
  check: (o: { startTime: string; endTime: string }) =>
    o.startTime !== o.endTime,
  error: {
    message: "End time must be different from start time",
    path: ["endTime"],
  },
};

function toCents<T extends { fee: number }>({ fee, ...o }: T) {
  return { ...o, feeCents: Math.round(fee * 100) };
}

/** What the admin fills in to schedule an open play. */
export const OpenPlaySchema = z
  .object({ ...VenueSchema.shape, ...scheduleFields })
  .refine(differentTimes.check, differentTimes.error)
  .transform(toCents);

/** Its hosts changing when it is, its ranks, cap, or entry. */
export const OpenPlayEditSchema = z
  .object(scheduleFields)
  .refine(differentTimes.check, differentTimes.error)
  .transform(toCents);

export type OpenPlayEdit = z.infer<typeof OpenPlayEditSchema>;
export type OpenPlayInput = z.infer<typeof OpenPlaySchema>;

export type Ranks = { levels: Level[] };

/** "All levels", "Advanced", "Beginner & Novice", "A, B & C". */
export function ranksLabel({ levels }: Ranks): string {
  if (levels.length === LEVELS.length) return "All levels";
  const names = levels.map((l) => LEVEL_INFO[l].label);
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

export type Member = { name: string; level: Level };

/** The pair's strongest player: their level is the pair's rank. */
export function strongest(members: Member[]): Member | undefined {
  return members.reduce<Member | undefined>(
    (top, m) => (!top || levelRank(m.level) > levelRank(top.level) ? m : top),
    undefined,
  );
}

/**
 * Why these players can't play in this open play, or null. A pair plays
 * at its strongest player's rank, so once either player is, say, Novice,
 * the pair can never join a lower rank like Beginner.
 */
export function rankProblem(play: Ranks, members: Member[]): string | null {
  const top = strongest(members);
  if (!top || play.levels.includes(top.level)) return null;
  const lower = play.levels.filter((l) => levelRank(l) < levelRank(top.level));
  const who = members.length > 1 ? "this pair" : "they";
  if (lower.length === play.levels.length) {
    return `${top.name} is ${LEVEL_INFO[top.level].label}, so ${who} can't join ${ranksLabel({ levels: lower })}`;
  }
  return `${top.name} is ${LEVEL_INFO[top.level].label}, so ${who} play${who === "they" ? "" : "s"} ${LEVEL_INFO[top.level].label}; this open play is for ${ranksLabel(play)}`;
}

/** Why a pair can't join (rank, then capacity), or null when it can. */
export function joinProblem(
  play: Ranks & { maxPairs: number | null },
  members: Member[],
  pairCount: number,
): string | null {
  const rank = rankProblem(play, members);
  if (rank) return rank;
  if (play.maxPairs !== null && pairCount >= play.maxPairs) {
    return "This open play is full";
  }
  return null;
}

/**
 * Why a solo player can't sign up, or null. A partner can lift the pair's
 * rank, so only a player above every rank is turned away.
 */
export function soloProblem(play: Ranks, member: Member): string | null {
  const top = play.levels.at(-1);
  return top && levelRank(member.level) > levelRank(top)
    ? rankProblem(play, [member])
    : null;
}

/** Spots left, or null when there's no cap. */
export function spotsLeft(maxPairs: number | null, pairCount: number) {
  return maxPairs === null ? null : Math.max(0, maxPairs - pairCount);
}

type Window = { playDate: string; startTime: string; endTime: string };

/** Minutes from midnight to the end, past midnight when it wraps. */
function span(w: Window): [number, number] {
  const start = parseTime(w.startTime);
  return [start, start + sessionMinutes(w.startTime, w.endTime)];
}

/** Whether two open plays on the same day overlap in time. */
export function overlaps(a: Window, b: Window): boolean {
  if (a.playDate !== b.playDate) return false;
  const [s1, e1] = span(a);
  const [s2, e2] = span(b);
  return s1 < e2 && s2 < e1;
}

const shortDay = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Tue, Oct 27 · 6:00 PM – 8:00 PM" */
export function whenLabel(w: Window): string {
  const day = shortDay.format(new Date(`${w.playDate}T00:00:00Z`));
  return `${day} · ${formatTimeLabel(w.startTime)} – ${formatTimeLabel(w.endTime)}`;
}
