"use client";

import { useEffect, useState } from "react";
import { entryFee } from "@/app/actions";
import { PayButton } from "@/components/admin/pair-modal";
import { LevelBadge } from "@/components/level-badge";
import { Modal } from "@/components/ui/modal";
import type { PairUnit } from "@/lib/db/queries";
import { LEVELS } from "@/lib/ranking/levels";

const MARK_PAID =
  "inline-flex min-h-9 shrink-0 items-center rounded-lg bg-lime-300 px-3 text-sm font-semibold whitespace-nowrap text-lime-950 ring-2 ring-lime-500 hover:bg-lime-200";

/**
 * Unpaid pairs of a running open play, out of the way of the queue: mark
 * each one paid as they pay. Paid pairs then wait to be added.
 */
export function UnpaidPairsDialog({
  openPlayId,
  pairs,
  onSaved,
  onClose,
}: {
  openPlayId: string;
  pairs: PairUnit[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof entryFee>>>();
  useEffect(() => {
    let live = true;
    entryFee(openPlayId)
      .then((f) => live && setInfo(f))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [openPlayId]);

  return (
    <Modal
      title={`Unpaid pairs (${pairs.length})`}
      eyebrow="Confirm when they pay"
      tone="from-rose-400 to-fuchsia-500"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2 overflow-y-auto p-4">
        {pairs.length === 0 ? (
          <p className="text-center text-ink/60">
            ✓ Everyone&apos;s paid. Add them to the queue.
          </p>
        ) : info === undefined ? (
          <p className="text-ink/50">Loading…</p>
        ) : info === null ? (
          <p className="text-rose-600">Couldn&apos;t load this open play.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pairs.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-2xl bg-rose-50 p-2 ring-2 ring-rose-200"
              >
                <LevelBadge level={LEVELS[p.skill] ?? LEVELS[0]} size="sm" />
                <span className="min-w-0 flex-1 font-bold">{p.name}</span>
                <PayButton
                  kind={info.kind}
                  pairId={p.id}
                  names={p.name}
                  notes=""
                  fee={info.fee}
                  onSaved={onSaved}
                  className={MARK_PAID}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
