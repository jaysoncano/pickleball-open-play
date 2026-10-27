import { z } from "zod";

export const MAX_COURTS = 30;
export const MAX_NAME_LENGTH = 30;
export const PLAYERS_PER_COURT_OPTIONS = [2, 4] as const;

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time (HH:MM)");

export const ScheduleSchema = z
  .object({ startTime: timeOfDay, endTime: timeOfDay })
  .refine((s) => s.startTime !== s.endTime, {
    message: "End time must be different from start time",
    path: ["endTime"],
  });

/** Calendar day a new session runs on (setup only; not saved in config). */
export const SessionDateSchema = z.iso.date("Pick a date");

export const CourtsSchema = z.object({
  courtCount: z
    .int()
    .min(1, "Add at least one court")
    .max(MAX_COURTS, `Up to ${MAX_COURTS} courts`),
  playersPerCourt: z.union([z.literal(2), z.literal(4)]),
});

export const DEFAULT_OVERTIME_MINUTES = 12;
export const OVERTIME_RANGE = { min: 5, max: 90 } as const;

export const OvertimeSchema = z
  .int()
  .min(OVERTIME_RANGE.min, `At least ${OVERTIME_RANGE.min} minutes`)
  .max(OVERTIME_RANGE.max, `Up to ${OVERTIME_RANGE.max} minutes`);

export const SessionConfigSchema = z.object({
  ...ScheduleSchema.shape,
  ...CourtsSchema.shape,
  /** Alert when a game runs longer than this. Older saves get the default. */
  overtimeMinutes: OvertimeSchema.default(DEFAULT_OVERTIME_MINUTES),
});

export const PlayerNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(MAX_NAME_LENGTH, `Keep names under ${MAX_NAME_LENGTH} characters`);

export const PlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  gamesPlayed: z.int().nonnegative(),
  joinedAt: z.number(),
  /**
   * Skill rank (0 = lowest level). Set for pairs; matchmaking keeps
   * groups close in skill. Optional, so older saves still load.
   */
  skill: z.int().nonnegative().optional(),
});

export const CourtSchema = z.object({
  id: z.string(),
  label: z.string(),
  playerIds: z.array(z.string()),
  startedAt: z.number().nullable(),
  /** Set when a game was stopped mid-way: how long it had run (ms). */
  stoppedAfterMs: z.number().nullable(),
  /**
   * Ranked open play: the skill rank this court plays (its line in the
   * queue). Null takes whichever line is first. Defaults so older saves load.
   */
  rank: z.int().nonnegative().nullable().default(null),
});

export const MatchSchema = z.object({
  courtLabel: z.string(),
  /** First half is side A, second half side B. */
  playerIds: z.array(z.string()),
  /** Names at the time of the game, so history survives removals. */
  playerNames: z.array(z.string()),
  startedAt: z.number(),
  endedAt: z.number(),
});

/** How often each pair of players has met, keyed by `pairKey(a, b)`. */
export const PairHistorySchema = z.object({
  teammates: z.record(z.string(), z.int().nonnegative()),
  opponents: z.record(z.string(), z.int().nonnegative()),
});

export const QueueStateSchema = z.object({
  version: z.literal(4),
  config: SessionConfigSchema,
  startsAt: z.number(),
  endsAt: z.number(),
  players: z.record(z.string(), PlayerSchema),
  queue: z.array(z.string()),
  courts: z.array(CourtSchema),
  matches: z.array(MatchSchema),
  history: PairHistorySchema,
  nextCourtNumber: z.int().positive(),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;
/**
 * Setup input: the overtime limit is optional and defaults. `date`
 * (YYYY-MM-DD) picks the day; without it the next matching window is used.
 */
export type SessionSetup = z.input<typeof SessionConfigSchema> & {
  date?: string;
};
export type PlayersPerCourt = SessionConfig["playersPerCourt"];
export type Player = z.infer<typeof PlayerSchema>;
export type Court = z.infer<typeof CourtSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type PairHistory = z.infer<typeof PairHistorySchema>;
export type QueueState = z.infer<typeof QueueStateSchema>;

/** First validation message for a schema result, or null when valid. */
export function firstError(result: z.ZodSafeParseResult<unknown>) {
  return result.success ? null : (result.error.issues[0]?.message ?? "Invalid");
}
