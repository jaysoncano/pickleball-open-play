"use client";

import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { Court, Player } from "@/lib/queue/schema";
import { firstError } from "@/lib/queue/schema";
import { MAX_SCORE, ScoreSchema, type Score } from "@/lib/ranking/forms";

const QUICK = [11, 15, 21];

/**
 * Enter the final score when a game ends. The match is recorded with it,
 * so it counts toward each player's record.
 */
export function ScoreDialog({
  court,
  players,
  onSave,
  onClose,
}: {
  court: Court;
  players: Record<string, Player>;
  onSave: (score: Score) => void;
  onClose: () => void;
}) {
  const [scores, setScores] = useState<[string, string]>(["", ""]);
  const half = Math.ceil(court.playerIds.length / 2);
  const sides = [court.playerIds.slice(0, half), court.playerIds.slice(half)];
  const parsed = ScoreSchema.safeParse({
    scoreA: scores[0] === "" ? NaN : Number(scores[0]),
    scoreB: scores[1] === "" ? NaN : Number(scores[1]),
  });
  const touched = scores[0] !== "" && scores[1] !== "";

  function submit(event: FormEvent) {
    event.preventDefault();
    if (parsed.success) onSave(parsed.data);
  }

  return (
    <Modal
      eyebrow={`${court.label} · game done`}
      title="Final score"
      tone="from-lime-400 to-sky-500"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4 p-5">
        {sides.map((ids, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 rounded-3xl p-3 ring-2 ${i === 0 ? "bg-lime-50 ring-lime-200" : "bg-sky-50 ring-sky-200"}`}
          >
            <ul className="flex min-w-0 flex-1 flex-col gap-1">
              {ids.map((id) => (
                <li key={id} className="flex min-w-0 items-center gap-2">
                  <Avatar name={players[id]?.name ?? "?"} size="sm" />
                  <span className="truncate font-bold">
                    {players[id]?.name}
                  </span>
                </li>
              ))}
            </ul>
            <label className="sr-only" htmlFor={`score-${i}`}>
              Side {i === 0 ? "A" : "B"} score
            </label>
            <input
              id={`score-${i}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_SCORE}
              autoFocus={i === 0}
              required
              value={scores[i]}
              onChange={(e) => {
                const next: [string, string] = [...scores];
                next[i] = e.target.value;
                setScores(next);
              }}
              className="w-20 rounded-2xl bg-white px-3 py-2 text-center font-display text-3xl font-bold ring-2 ring-ink/10 outline-none focus:ring-fuchsia-400"
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink/60">
          Winner got
          {QUICK.map((n) => (
            <span key={n} className="flex gap-1">
              {(["A", "B"] as const).map((side, i) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => {
                    const next: [string, string] = [...scores];
                    next[i] = String(n);
                    setScores(next);
                  }}
                  className="min-h-9 rounded-full bg-fuchsia-100 px-3 font-display text-fuchsia-700 hover:bg-fuchsia-200"
                >
                  {side} {n}
                </button>
              ))}
            </span>
          ))}
        </div>

        {touched && !parsed.success && (
          <p role="status" className="text-sm font-semibold text-rose-600">
            {firstError(parsed)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="lime" disabled={!parsed.success}>
            Save result ✓
          </Button>
        </div>
      </form>
    </Modal>
  );
}
