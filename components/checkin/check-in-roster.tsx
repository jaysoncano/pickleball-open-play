"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkInPair, rosterFor } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { PairUnit } from "@/lib/db/queries";
import { LEVELS } from "@/lib/ranking/levels";
import { notReady } from "@/lib/registration/gate";
/**
 * Every pair signed up for the open play: tap the pair in as they arrive
 * (both players at once). Checking a pair in is the host's go-ahead: it
 * can join once checked in, paid or not. Unpaid pairs are marked so the
 * host can collect later (the dashboard reminds them while they play).
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
  /** The open play is running: pairs join on their own once checked in. */
  live?: boolean;
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

  // Running: checked-in pairs join on their own (the parent puts them
  // first in line). Remember what's on its way, so a refresh can't add it
  // twice.
  const sending = useRef(new Set<string>());
  useEffect(() => {
    if (!live || !roster) return;
    const skip = new Set(exclude);
    for (const id of sending.current)
      if (skip.has(id)) sending.current.delete(id);
    const due = roster.filter(
      (p) => !skip.has(p.id) && !sending.current.has(p.id) && !notReady(p),
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
  const ready = list.filter((p) => !notReady(p));
  const unpaid = list.filter((p) => !p.paid).length;
  const here = list.filter((p) => p.members.every((m) => m.checkedIn));

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
          {here.length} pair{here.length === 1 ? "" : "s"} checked in ·{" "}
          {ready.length} ready
          {unpaid > 0 && (
            <span className="text-rose-600"> · {unpaid} pay later</span>
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
      <ul className="-m-1 flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-1">
        {list.map((p) => (
          <RosterRow
            key={p.id}
            pair={p}
            live={live}
            addLabel={addLabel}
            busy={busy}
            onToggle={(on) => toggle(p, on)}
            onAdd={() => add([p])}
          />
        ))}
      </ul>
      {error && (
        <p role="alert" className="px-1 text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One pair, two roomy lines: who (avatars, names, rank, Pay later), then
 * where they're at and the one thing to do next: check in, then add to
 * the queue (before the start) or join on their own (once live).
 */
function RosterRow({
  pair,
  live,
  addLabel,
  busy,
  onToggle,
  onAdd,
}: {
  pair: PairUnit;
  live: boolean;
  addLabel: string;
  /** The pair (or batch) being saved, if any. */
  busy: string | null;
  onToggle: (on: boolean) => void;
  onAdd: () => void;
}) {
  const here = pair.members.filter((m) => m.checkedIn).length;
  const all = here === pair.members.length;
  const saving = busy === pair.id;
  const status = pair.blocked
    ? pair.blocked
    : all
      ? "✓ Both here"
      : here > 0
        ? `${here} of ${pair.members.length} here`
        : "Not here yet";

  return (
    <li
      className={`flex flex-col gap-2.5 rounded-2xl p-3 ring-2 ${all ? "bg-white ring-lime-200" : pair.paid ? "bg-white ring-ink/5" : "bg-rose-50/50 ring-rose-200"}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex shrink-0 -space-x-2">
          {pair.members.map((m) => (
            <Avatar key={m.id} name={m.name} size="sm" />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate font-bold" title={pair.name}>
          {pair.name}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <LevelBadge level={LEVELS[pair.skill] ?? LEVELS[0]} size="sm" />
          {!pair.paid && (
            <span
              title="Can play now and pay later"
              className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black tracking-wide whitespace-nowrap text-white uppercase"
            >
              Pay later
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className={`min-w-0 text-xs font-semibold ${pair.blocked ? "text-rose-600" : all ? "text-lime-700" : "text-ink/50"}`}
        >
          {status}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {all && !pair.blocked && live && (
            <span className="text-xs font-semibold text-sky-700">
              Joining the queue…
            </span>
          )}
          {all && !pair.blocked && !live && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={onAdd}
              className="min-h-10 rounded-full bg-sky-500 px-3.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"
            >
              ＋ {addLabel}
            </button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={all}
            aria-label={`${pair.name} checked in`}
            disabled={saving}
            onClick={() => onToggle(!all)}
            className={`min-h-10 rounded-full px-3.5 text-sm font-bold whitespace-nowrap ring-2 transition-colors disabled:opacity-50 ${all ? "bg-lime-100 text-lime-900 ring-lime-300 hover:bg-lime-50" : "bg-amber-300 text-amber-950 ring-amber-400 hover:bg-amber-200"}`}
          >
            {saving ? "Saving…" : all ? "✓ Here" : "○ Check in"}
          </button>
        </span>
      </div>
    </li>
  );
}
