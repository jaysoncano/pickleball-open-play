"use client";

import { useState, useTransition } from "react";
import { startOpenPlay } from "@/app/actions";
import { useSessionStore } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { CourtsSchema, firstError } from "@/lib/queue/schema";
import { suggestCourtRanks } from "@/lib/queue/ranks";
import { LEVELS, type Level } from "@/lib/ranking/levels";
import { StepCourts } from "./step-courts";
import { StepPlayers, type PairUnit } from "./step-players";
import { WizardProgress } from "./wizard-progress";

const STEPS = [
  { title: "Check-in", emoji: "✅", hint: "Check players in; add ready pairs" },
  { title: "Courts", emoji: "🎾", hint: "Courts, and which rank plays where" },
] as const;

/** Two pairs per court: open play is doubles by pairs. */
const PAIRS_PER_COURT = 2;

/** What the wizard shows about the open play it starts. */
export type OpenPlaySummary = {
  id: string;
  /** e.g. "Tue, Oct 27 · 6:00 PM – 8:00 PM" */
  when: string;
  /** e.g. "Beginner & Novice" */
  rank: string;
  /** The ticked ranks, lowest first. */
  levels: Level[];
};

/** Courts suggested for the picked pairs: shared by pairs per rank. */
function suggest(count: number, pairs: PairUnit[], levels: Level[]): Level[] {
  const perRank = new Map<number, number>();
  for (const p of pairs) perRank.set(p.skill, (perRank.get(p.skill) ?? 0) + 1);
  const ranks = suggestCourtRanks(count, perRank, PAIRS_PER_COURT).map(
    (r) => LEVELS[r],
  );
  // Courts beyond what the pairs fill take the busiest (or first) rank.
  const fallback = ranks.at(-1) ?? levels[0];
  return Array.from({ length: count }, (_, i) => ranks[i] ?? fallback);
}

/** Start a scheduled open play: pick courts, then its paid pairs. */
export function SetupWizard({ openPlay }: { openPlay: OpenPlaySummary }) {
  const { replace } = useSessionStore();
  const [starting, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pairs, setPairs] = useState<PairUnit[]>([]);
  const [courtLevels, setCourtLevels] = useState<Level[]>([]);

  const errors = [
    pairs.length < PAIRS_PER_COURT
      ? "Add at least 2 ready pairs (paid and checked in) to fill a court"
      : null,
    firstError(
      CourtsSchema.safeParse({
        courtCount: courtLevels.length,
        playersPerCourt: PAIRS_PER_COURT,
      }),
    ),
  ];
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function next() {
    if (errors[step]) return;
    if (!isLast) {
      // Suggest courts from the pairs just picked (keeps the count).
      setCourtLevels(suggest(courtLevels.length || 2, pairs, openPlay.levels));
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await startOpenPlay(
        openPlay.id,
        courtLevels,
        pairs.map((p) => p.id),
      );
      if ("error" in result) setStartError(result.error);
      else replace(result.state);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col items-center gap-5 text-center">
        <p className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-ink/70 ring-2 ring-white">
          {openPlay.rank} · {openPlay.when}
        </p>
        <WizardProgress steps={STEPS} current={step} onSelect={setStep} />
      </header>

      <section
        key={step}
        aria-labelledby="step-title"
        className="animate-pop-in rounded-[2rem] bg-white/80 p-5 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8 motion-reduce:animate-none"
      >
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1
          id="step-title"
          className="mt-1 font-display text-3xl font-bold sm:text-4xl"
        >
          <span aria-hidden>{current.emoji}</span> {current.hint}
        </h1>

        <div className="mt-6">
          {step === 0 && (
            <StepPlayers
              openPlayId={openPlay.id}
              pairs={pairs}
              courtCount={courtLevels.length || 2}
              onChange={setPairs}
            />
          )}
          {step === 1 && (
            <StepCourts
              courtLevels={courtLevels}
              ranks={openPlay.levels}
              waiting={waitingPerRank(pairs)}
              onCountChange={(n) =>
                setCourtLevels(suggest(n, pairs, openPlay.levels))
              }
              onLevelChange={(i, level) =>
                setCourtLevels((ls) => ls.map((l, j) => (j === i ? level : l)))
              }
            />
          )}
        </div>

        {(errors[step] ?? (isLast && startError)) && (
          <p role="status" className="mt-5 text-sm font-semibold text-rose-600">
            {errors[step] ?? startError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            className={step === 0 ? "invisible" : ""}
          >
            ← Back
          </Button>
          <Button
            variant={isLast ? "lime" : "primary"}
            size="lg"
            onClick={next}
            disabled={Boolean(errors[step]) || starting}
          >
            {isLast
              ? starting
                ? "Starting…"
                : "Start the queue 🚀"
              : "Next →"}
          </Button>
        </div>
      </section>
    </main>
  );
}

function waitingPerRank(pairs: PairUnit[]): Map<Level, number> {
  const out = new Map<Level, number>();
  for (const p of pairs) {
    const level = LEVELS[p.skill];
    out.set(level, (out.get(level) ?? 0) + 1);
  }
  return out;
}
