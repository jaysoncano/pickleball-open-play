"use client";

import { CheckInRoster } from "@/components/checkin/check-in-roster";
import { OpenPlayNotice } from "@/components/open-play-notice";
import type { PairUnit } from "@/lib/db/queries";

export type { PairUnit };

/**
 * Check players in as they arrive, then add the ready pairs (paid, both
 * players checked in). Unpaid pairs pay and get confirmed at the desk.
 */
export function StepPlayers({
  openPlayId,
  pairs,
  courtCount,
  onChange,
}: {
  openPlayId: string;
  pairs: PairUnit[];
  courtCount: number;
  onChange: (pairs: PairUnit[]) => void;
}) {
  const onCourt = Math.min(courtCount * 2, pairs.length);
  const waiting = pairs.length - onCourt;

  return (
    <div className="flex flex-col gap-5">
      <OpenPlayNotice />

      <section
        aria-labelledby="checkin-title"
        className="rounded-3xl border-2 border-dashed border-sky-300 bg-sky-50 p-3"
      >
        <h2
          id="checkin-title"
          className="mb-2 px-1 font-display text-base font-semibold text-sky-800"
        >
          ✅ Check-in · tap each player as they arrive
        </h2>
        <CheckInRoster
          openPlayId={openPlayId}
          exclude={pairs.map((p) => p.id)}
          addLabel="Add"
          refreshMs={20_000}
          onAdd={(ready) => onChange([...pairs, ...ready])}
        />
      </section>

      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-semibold">
          {pairs.length} pair{pairs.length === 1 ? "" : "s"}
        </p>
        {pairs.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="min-h-11 text-sm font-semibold text-ink/50 hover:text-rose-600"
          >
            Clear all
          </button>
        )}
      </div>

      {pairs.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {pairs.map((p) => (
            <li
              key={p.id}
              className="animate-pop-in flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-3 ring-2 ring-ink/5 motion-reduce:animate-none"
            >
              <span className="max-w-48 truncate font-semibold">{p.name}</span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => onChange(pairs.filter((x) => x.id !== p.id))}
                className="relative flex size-7 items-center justify-center rounded-full text-ink/40 after:absolute after:-inset-2 hover:bg-rose-100 hover:text-rose-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pairs.length > 0 && (
        <p className="rounded-2xl bg-lime-100 px-4 py-3 text-sm font-semibold text-lime-900">
          {pairs.length >= 2
            ? `${Math.floor(onCourt / 2)} of ${courtCount} court${courtCount === 1 ? "" : "s"} ready to play`
            : "1 more pair to fill the first court"}
          {waiting > 0 &&
            ` · ${waiting} pair${waiting === 1 ? "" : "s"} waiting`}
        </p>
      )}
    </div>
  );
}
