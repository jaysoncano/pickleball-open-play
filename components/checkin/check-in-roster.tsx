"use client";

import { useCallback, useEffect, useState } from "react";
import { checkIn, rosterFor } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import type { PairUnit } from "@/lib/db/queries";
import { LEVELS } from "@/lib/ranking/levels";
import { notReady } from "@/lib/registration/gate";

/** Pair status at a glance: unpaid stands out in rose. */
function Status({ pair }: { pair: PairUnit }) {
  if (!pair.paid) {
    return (
      <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-black tracking-wide text-white uppercase">
        Unpaid
      </span>
    );
  }
  if (pair.blocked) {
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
        Wrong rank
      </span>
    );
  }
  return notReady(pair) ? (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
      Paid · check in
    </span>
  ) : (
    <span className="rounded-full bg-lime-200 px-2.5 py-0.5 text-xs font-bold text-lime-900">
      ✓ Ready
    </span>
  );
}

/**
 * Every pair signed up for the open play: tap each player in as they
 * arrive. A pair can join once it's paid and both players are checked in.
 * Unpaid pairs are marked so the host can collect at the desk.
 */
export function CheckInRoster({
  openPlayId,
  exclude,
  addLabel,
  onAdd,
  refreshMs,
}: {
  openPlayId: string;
  /** Pairs already picked or in the queue. */
  exclude: string[];
  addLabel: string;
  onAdd: (pairs: PairUnit[]) => void | Promise<void>;
  /** Reload this often, so new payments and check-ins show up. */
  refreshMs?: number;
}) {
  const [roster, setRoster] = useState<PairUnit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    rosterFor(openPlayId)
      .then(setRoster)
      .catch(() => setRoster((r) => r ?? []));
  }, [openPlayId]);

  useEffect(() => {
    load();
    if (!refreshMs) return;
    const timer = setInterval(load, refreshMs);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load, refreshMs]);

  async function toggle(pairId: string, playerId: string, on: boolean) {
    setBusy(playerId);
    setError(null);
    // Optimistic: flip it now, undo if the save fails.
    const flip = (value: boolean) =>
      setRoster((r) =>
        (r ?? []).map((p) =>
          p.id !== pairId
            ? p
            : {
                ...p,
                members: p.members.map((m) =>
                  m.id === playerId ? { ...m, checkedIn: value } : m,
                ),
              },
        ),
      );
    flip(on);
    try {
      if (!(await checkIn(openPlayId, playerId, on))) throw new Error();
    } catch {
      flip(!on);
      setError("Couldn't save the check-in. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function add(pairs: PairUnit[]) {
    setBusy(pairs.map((p) => p.id).join());
    try {
      await onAdd(pairs);
    } finally {
      setBusy(null);
    }
  }

  if (roster === null) {
    return <p className="px-1 py-2 text-sm text-ink/50">Loading pairs…</p>;
  }
  const skip = new Set(exclude);
  const list = roster.filter((p) => !skip.has(p.id));
  const ready = list.filter((p) => !notReady(p));
  const unpaid = list.filter((p) => !p.paid).length;
  const here = list.flatMap((p) => p.members).filter((m) => m.checkedIn);

  if (list.length === 0) {
    return (
      <p className="px-1 py-2 text-sm text-ink/60">
        {roster.length === 0 ? "No pairs signed up yet. " : "Everyone's in. "}
        Pairs register at the{" "}
        <a
          href="/admin/players"
          target="_blank"
          className="font-semibold text-fuchsia-600 underline"
        >
          Player desk
        </a>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm font-semibold text-ink/60">
          {here.length} checked in · {ready.length} pair
          {ready.length === 1 ? "" : "s"} ready
          {unpaid > 0 && (
            <span className="text-rose-600"> · {unpaid} unpaid</span>
          )}
        </p>
        {ready.length > 1 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => add(ready)}
            className="min-h-10 rounded-full bg-white px-3 text-sm font-bold text-sky-800 ring-2 ring-sky-200 hover:ring-sky-400 disabled:opacity-50"
          >
            {addLabel} all ready ({ready.length})
          </button>
        )}
      </div>
      <ul className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto">
        {list.map((p) => {
          const why = notReady(p);
          return (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-2 rounded-2xl p-2 ring-2 ${p.paid ? "bg-white ring-ink/5" : "bg-rose-50 ring-rose-300"}`}
            >
              <LevelBadge level={LEVELS[p.skill] ?? LEVELS[0]} size="sm" />
              <Status pair={p} />
              <span className="flex flex-1 flex-wrap gap-1.5">
                {p.members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={m.checkedIn}
                    disabled={busy === m.id}
                    onClick={() => toggle(p.id, m.id, !m.checkedIn)}
                    className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-2 transition-colors ${m.checkedIn ? "bg-lime-300 text-lime-950 ring-lime-500" : "bg-white text-ink/70 ring-ink/15 hover:ring-lime-400"}`}
                  >
                    <span aria-hidden>{m.checkedIn ? "✓" : "○"}</span>
                    {m.name}
                    <span className="sr-only">
                      {m.checkedIn ? ", checked in" : ", not checked in"}
                    </span>
                  </button>
                ))}
              </span>
              {why ? (
                <span className="w-full px-1 text-xs font-semibold text-ink/50 sm:w-auto">
                  {why}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => add([p])}
                  className="min-h-10 rounded-full bg-sky-500 px-3 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"
                >
                  ＋ {addLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="px-1 text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
