import { z } from "zod";

/** Skill levels, lowest first. Add or rename here; the DB enum mirrors it. */
export const LEVELS = [
  "beginner",
  "novice",
  "intermediate",
  "advanced",
  "pro",
] as const;

export type Level = (typeof LEVELS)[number];

export const LevelSchema = z.enum(LEVELS, "Pick a level");

export const LEVEL_INFO: Record<Level, { label: string; tone: string }> = {
  beginner: { label: "Beginner", tone: "bg-sky-100 text-sky-800" },
  novice: { label: "Novice", tone: "bg-lime-200 text-lime-900" },
  intermediate: { label: "Intermediate", tone: "bg-amber-200 text-amber-900" },
  advanced: { label: "Advanced", tone: "bg-fuchsia-200 text-fuchsia-900" },
  pro: { label: "Pro", tone: "bg-violet-600 text-white" },
};

/** 0 for the lowest level; higher is stronger. */
export function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}
