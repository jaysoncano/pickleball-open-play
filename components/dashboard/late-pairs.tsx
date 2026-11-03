"use client";

import { useCallback, useState } from "react";
import { addLateArrivals } from "@/app/actions";
import { CheckInRoster } from "@/components/checkin/check-in-roster";
import type { PairUnit } from "@/components/setup/step-players";
import { NewPairDialog } from "./new-pair-dialog";

/**
 * Pairs signed up for this open play who aren't in the queue yet. Check
 * a pair in and it joins the queue on its own, at the front; it can pay
 * later (the dashboard reminds the host while it plays).
 * Refreshes, so a pair checked in on another device shows up without a
 * reload. "New pair" registers one here; it waits until checked in.
 */
export function LatePairs({
  openPlayId,
  inSession,
  refreshKey = 0,
  onAdd,
}: {
  openPlayId: string;
  inSession: string[];
  /** Bump to look again now (a pair was checked in on the Players tab). */
  refreshKey?: number;
  onAdd: (pairs: Pick<PairUnit, "id" | "name" | "skill">[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return (
    <section
      aria-labelledby="late-title"
      className="rounded-3xl border-2 border-dashed border-lime-400 bg-lime-50 p-3.5 sm:p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h3
          id="late-title"
          className="font-display text-base font-semibold text-lime-900"
        >
          ⏳ Not in the queue yet
        </h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-9 rounded-full bg-lime-400 px-3 text-sm font-bold text-lime-950 ring-2 ring-lime-500 hover:bg-lime-300"
        >
          ＋ New pair
        </button>
      </div>
      <CheckInRoster
        openPlayId={openPlayId}
        exclude={inSession}
        addLabel="Add to queue"
        refreshMs={20_000}
        version={version + refreshKey}
        live
        onAdd={async (pairs) =>
          onAdd(
            await addLateArrivals(
              openPlayId,
              pairs.map((p) => p.id),
            ),
          )
        }
      />
      {adding && (
        <NewPairDialog
          openPlayId={openPlayId}
          onSaved={reload}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}
