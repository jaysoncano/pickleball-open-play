"use client";

import { addLateArrivals } from "@/app/actions";
import { CheckInRoster } from "@/components/checkin/check-in-roster";
import type { PairUnit } from "@/components/setup/step-players";

/**
 * Pairs signed up for this open play who aren't in the queue yet: check
 * them in as they arrive, then add them. Refreshes, so a pair that just
 * paid at the desk shows up without a reload.
 */
export function LatePairs({
  openPlayId,
  inSession,
  onAdd,
}: {
  openPlayId: string;
  inSession: string[];
  onAdd: (pairs: Pick<PairUnit, "id" | "name" | "skill">[]) => void;
}) {
  return (
    <section
      aria-labelledby="late-title"
      className="rounded-3xl border-2 border-dashed border-lime-400 bg-lime-50 p-3"
    >
      <h3
        id="late-title"
        className="mb-2 px-1 font-display text-base font-semibold text-lime-900"
      >
        ✅ Check-in · not in the queue yet
      </h3>
      <CheckInRoster
        openPlayId={openPlayId}
        exclude={inSession}
        addLabel="Add to queue"
        refreshMs={20_000}
        onAdd={async (pairs) =>
          onAdd(
            await addLateArrivals(
              openPlayId,
              pairs.map((p) => p.id),
            ),
          )
        }
      />
    </section>
  );
}
