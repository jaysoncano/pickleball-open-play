"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkInPair, rosterFor } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import type { PairUnit } from "@/lib/db/queries";
import { LEVELS } from "@/lib/ranking/levels";
import { notReady } from "@/lib/registration/gate";
import { UnpaidPairsDialog } from "./unpaid-pairs-dialog";

/** Pair status at a glance: unpaid stands out in rose. */
function Status({ pair, live }: { pair: PairUnit; live: boolean }) {
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
  return notReady(pair, { live }) ? (
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
 * Every pair signed up for the open play: tap the pair in as they arrive
 * (both players at once). A pair can join once it's paid and checked in.
 * Unpaid pairs are marked so the host can collect at the desk.
 */
export function CheckInRoster({
  openPlayId,
  exclude,
  addLabel,
  onAdd,
  refreshMs,
  version,
  live = false,
}: {
  openPlayId: string;
  /** Pairs already picked or in the queue. */
  exclude: string[];
  addLabel: string;
  onAdd: (pairs: PairUnit[]) => void | Promise<void>;
  /** Reload this often, so new payments and check-ins show up. */
  refreshMs?: number;
  /** Bump to reload now (a pair was just registered). */
  version?: number;
  /** The open play is running: no check-in, paid pairs can be added. */
  live?: boolean;
}) {
  const [roster, setRoster] = useState<PairUnit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
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
  }, [load, refreshMs, version]);

  async function toggle(pair: PairUnit, on: boolean) {
    setBusy(pair.id);
    setError(null);
    const before = pair.members;
    // Optimistic: flip it now, put it back if the save fails.
    const set = (members: PairUnit["members"]) =>
      setRoster((r) =>
        (r ?? []).map((p) => (p.id === pair.id ? { ...p, members } : p)),
      );
    set(before.map((m) => ({ ...m, checkedIn: on })));
    try {
      if (!(await checkInPair(openPlayId, pair.id, on))) throw new Error();
    } catch {
      set(before);
      setError("Couldn't save the check-in. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // Running: paid pairs join on their own (the parent puts them first in
  // line). Remember what's on its way, so a refresh can't add it twice.
  const sending = useRef(new Set<string>());
  useEffect(() => {
    if (!live || !roster) return;
    const skip = new Set(exclude);
    for (const id of sending.current)
      if (skip.has(id)) sending.current.delete(id);
    const due = roster.filter(
      (p) =>
        !skip.has(p.id) &&
        !sending.current.has(p.id) &&
        !notReady(p, { live: true }),
    );
    if (due.length === 0) return;
    for (const p of due) sending.current.add(p.id);
    Promise.resolve(onAdd(due)).catch(() => {
      for (const p of due) sending.current.delete(p.id);
    });
  }, [live, roster, exclude, onAdd]);

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
  const ready = list.filter((p) => !notReady(p, { live }));
  const unpaidPairs = list.filter((p) => !p.paid);
  const unpaid = unpaidPairs.length;
  const here = list.filter((p) => p.members.every((m) => m.checkedIn));
  // Running: unpaid pairs fold into one "Review" line, out of the way.
  const shown = live ? list.filter((p) => p.paid) : list;

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
          {!live &&
            `${here.length} pair${here.length === 1 ? "" : "s"} checked in · `}
          {ready.length} pair
          {ready.length === 1 ? "" : "s"} ready
          {!live && unpaid > 0 && (
            <span className="text-rose-600"> · {unpaid} unpaid</span>
          )}
        </p>
        {!live && ready.length > 1 && (
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
      {live && unpaid > 0 && (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex min-h-10 items-center justify-between gap-2 rounded-2xl bg-rose-50 px-3 text-left text-sm font-semibold text-rose-800 ring-2 ring-rose-200 hover:ring-rose-400"
        >
          <span>
            ⚠️ {unpaid} unpaid pair{unpaid === 1 ? "" : "s"}
          </span>
          <span className="font-bold underline">Review &amp; confirm</span>
        </button>
      )}
      <ul className="-m-1 flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto p-1">
        {shown.map((p) => {
          const why = notReady(p, { live });
          return (
            <li
              key={p.id}
              className={`flex flex-wrap items-center gap-2 rounded-2xl p-2 ring-2 ${p.paid ? "bg-white ring-ink/5" : "bg-rose-50 ring-rose-300"}`}
            >
              <LevelBadge level={LEVELS[p.skill] ?? LEVELS[0]} size="sm" />
              <Status pair={p} live={live} />
              <span className="flex flex-1">
                {live ? (
                  <span className="px-1 text-sm font-bold">{p.name}</span>
                ) : (
                  <CheckInButton
                    pair={p}
                    busy={busy === p.id}
                    onToggle={(on) => toggle(p, on)}
                  />
                )}
              </span>
              {why ? (
                <span className="w-full px-1 text-xs font-semibold text-ink/50 sm:w-auto">
                  {why}
                </span>
              ) : live ? (
                <span className="text-xs font-semibold text-sky-700">
                  Joining the queue…
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
      {reviewing && (
        <UnpaidPairsDialog
          openPlayId={openPlayId}
          pairs={unpaidPairs}
          onSaved={load}
          onClose={() => setReviewing(false)}
        />
      )}
    </div>
  );
}

/** One tap for the whole pair: "○ Son & Gel · Check in" ↔ "✓ Son & Gel". */
function CheckInButton({
  pair,
  busy,
  onToggle,
}: {
  pair: PairUnit;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const here = pair.members.filter((m) => m.checkedIn).length;
  const all = here === pair.members.length;
  return (
    <button
      type="button"
      aria-pressed={all}
      disabled={busy}
      onClick={() => onToggle(!all)}
      className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-2 transition-colors ${all ? "bg-lime-300 text-lime-950 ring-lime-500" : "bg-white text-ink/70 ring-ink/15 hover:ring-lime-400"}`}
    >
      <span aria-hidden>{all ? "✓" : "○"}</span>
      {pair.name}
      {!all && (
        <span className="text-ink/45">
          · Check in{here > 0 && ` (${here}/${pair.members.length} here)`}
        </span>
      )}
      <span className="sr-only">
        {all ? ", checked in" : ", not checked in"}
      </span>
    </button>
  );
}
