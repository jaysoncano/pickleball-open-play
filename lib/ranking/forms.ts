import { z } from "zod";
import { LevelSchema } from "./levels";

export const MAX_SCORE = 99;

const Score = z
  .int("Enter a whole number")
  .min(0, "Scores can't be negative")
  .max(MAX_SCORE, `Up to ${MAX_SCORE}`);

/** Final score of a finished game. Pickleball has no ties. */
export const ScoreSchema = z
  .object({ scoreA: Score, scoreB: Score })
  .refine((s) => s.scoreA !== s.scoreB, {
    message: "Scores can't be tied",
    path: ["scoreB"],
  });

export type Score = z.infer<typeof ScoreSchema>;

export const PROTEST_REASON = { min: 10, max: 500 } as const;

/** A player asking for a different level, with their reason. */
export const ProtestSchema = z
  .object({
    playerId: z.string().min(1),
    currentLevel: LevelSchema,
    requestedLevel: LevelSchema,
    reason: z
      .string()
      .trim()
      .min(PROTEST_REASON.min, "Tell the admin why (a sentence or two)")
      .max(
        PROTEST_REASON.max,
        `Keep it under ${PROTEST_REASON.max} characters`,
      ),
  })
  .refine((p) => p.requestedLevel !== p.currentLevel, {
    message: "Pick a level different from the current one",
    path: ["requestedLevel"],
  });

export type ProtestInput = z.infer<typeof ProtestSchema>;

export const ResolutionSchema = z.object({
  protestId: z.string().min(1),
  approve: z.boolean(),
  note: z.string().trim().max(PROTEST_REASON.max).default(""),
});

export const PROTEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type ProtestStatus = (typeof PROTEST_STATUSES)[number];
