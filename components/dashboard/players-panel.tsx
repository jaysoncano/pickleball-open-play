"use client";

import { useCallback, useEffect, useState } from "react";
import { checkInPair, rosterFor } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { PairUnit } from "@/lib/db/queries";
import type { QueueState } from "@/lib/queue/schema";
import { LEVELS } from "@/lib/ranking/levels";
import {
  filterRoster,
  isHere,
  placeOf,
  ROSTER_FILTER_LABEL,
  ROSTER_FILTERS,
  rosterCounts,
  type Place,
  type RosterFilter,
} from "@/lib/registration/roster";

const REFRESH_MS = 20_000;
const CARD =
  "rounded-[2rem] bg-white/80 p-3 ring-2 ring-white backdrop-blur sm:p-5";
const CHIP =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-semibold whitespace-nowrap ring-2 transition-colors sm:min-h-10 sm:px-3.5 sm:text-sm";

/**
 * The Players tab: every pair signed up for this open play. Search,
 * filter, see where each pair is (on court, in line, not in the queue)
 * and how many games it has played, and check pairs in at the booth,
 * even after the start. A pair checked in here joins the queue at the
 * front (`onCheckedIn` tells the queue to look now).
 */
export function PlayersPanel({
  openPlayId,
  session,
  active,
  onCount,
  onCheckedIn,
}: {
  openPlayId: string;
  session: QueueState;
  /** The tab is showing: keep it fresh while it is. */
  active: boolean;
  /** Pairs signed up, for the tab's badge. */
  onCount: (n: number) => void;
  /** A pair was just checked in: the queue picks it up now. */
  onCheckedIn: () => void;
}) {
  const [roster, setRoster] = useState<PairUnit[] | null>(null);
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    rosterFor(openPlayId)
      .then((r) => {
        setRoster(r);
        onCount(r.length);
      })
      .catch(() => setRoster((r) => r ?? []));
  }, [openPlayId, onCount]);

  // Load once for the badge, then keep fresh while the tab is open.
  useEffect(() => {
    load();
    if (!active) return;
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load, active]);

  async function toggle(pair: PairUnit, on: boolean) {
    setBusy(pair.id);
    setError(null);
    const set = (members: PairUnit["members"]) =>
      setRoster((r) =>
        (r ?? []).map((p) => (p.id === pair.id ? { ...p, members } : p)),
      );
    // Optimistic: flip it now, put it back if the save fails.
    set(pair.members.map((m) => ({ ...m, checkedIn: on })));
    try {
      if (!(await checkInPair(openPlayId, pair.id, on))) throw new Error();
      if (on) onCheckedIn();
    } catch {
      set(pair.members);
      setError(`Couldn't save ${pair.name}'s check-in. Try again.`);
    } finally {
      setBusy(null);
    }
  }

  if (!roster) {
    return <p className={`${CARD} text-ink/50`}>Loading players…</p>;
  }

  const counts = rosterCounts(roster);
  const shown = filterRoster(roster, filter, query);

  return (
    <section aria-labelledby="players-tab-title" className={CARD}>
      <header className="mb-4 px-1 sm:px-0">
        <h2 id="players-tab-title" className="font-display text-2xl font-bold">
          Players
        </h2>
        <p className="font-semibold text-ink/70">
          {roster.length} pair{roster.length === 1 ? "" : "s"} signed up ·{" "}
          {counts.here} checked in
        </p>
        <p className="mt-0.5 text-sm text-ink/50">
          Check pairs in at the booth: they join the queue right away, paid or
          not.
        </p>
      </header>

      <div className="flex flex-col gap-3 rounded-3xl bg-ink/[0.03] p-2.5 ring-1 ring-ink/5 sm:p-3 lg:flex-row lg:items-center lg:gap-4">
        <label className="relative block lg:w-80 lg:shrink-0">
          <span className="sr-only">Search players</span>
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink/40"
          >
            🔍
          </span>
          <input
            id="players-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a pair or player…"
            autoComplete="off"
            className="min-h-12 w-full rounded-2xl bg-white pr-3 pl-10 text-base ring-2 ring-sky-100 outline-none placeholder:text-ink/40 focus:ring-sky-400"
          />
        </label>
        <div
          role="group"
          aria-label="Show"
          className="flex flex-wrap gap-2 p-0.5"
        >
          {ROSTER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`${CHIP} ${filter === f ? "bg-fuchsia-500 text-white ring-fuchsia-600" : "bg-white text-ink/75 ring-ink/10 hover:ring-fuchsia-300"}`}
            >
              {ROSTER_FILTER_LABEL[f]}
              <span
                className={`min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums ${filter === f ? "bg-white/25" : "bg-ink/5"}`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="mt-5 rounded-2xl border-2 border-dashed border-ink/15 p-5 text-center text-ink/50">
          {roster.length === 0
            ? "No pairs signed up yet. Add one with ＋ New pair under the queue."
            : "No pairs match."}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {shown.map((p) => (
            <Row
              key={p.id}
              pair={p}
              place={placeOf(session, p.id)}
              games={session.players[p.id]?.gamesPlayed ?? 0}
              busy={busy === p.id}
              onToggle={(on) => toggle(p, on)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  pair,
  place,
  games,
  busy,
  onToggle,
}: {
  pair: PairUnit;
  place: Place;
  games: number;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const here = isHere(pair);
  // Phones: name and the check-in switch on top, where the pair is below.
  // From sm up: one line, avatars · name · where · switch.
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl p-3 ring-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:gap-x-4 ${here ? "bg-white ring-ink/5" : "bg-amber-50/70 ring-amber-200"}`}
    >
      <span className="col-start-1 row-start-1 flex shrink-0 -space-x-2">
        {pair.members.map((m) => (
          <Avatar key={m.id} name={m.name} size="sm" />
        ))}
      </span>

      <span className="col-start-2 row-start-1 min-w-0">
        <span className="block truncate font-bold" title={pair.name}>
          {pair.name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          <LevelBadge level={LEVELS[pair.skill] ?? LEVELS[0]} size="sm" />
          {!pair.paid && (
            <span className="rounded-full bg-rose-500 px-2 py-px text-[11px] font-black tracking-wide text-white uppercase">
              Pay later
            </span>
          )}
          {pair.blocked && (
            <span
              title={pair.blocked}
              className="rounded-full bg-rose-100 px-2 py-px text-[11px] font-bold text-rose-800"
            >
              Wrong rank
            </span>
          )}
        </span>
      </span>

      <span className="col-span-2 col-start-2 row-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end">
        <PlaceChip place={place} />
        <span className="font-semibold whitespace-nowrap text-ink/55 tabular-nums">
          {games} game{games === 1 ? "" : "s"}
        </span>
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={here}
        aria-label={`${pair.name} checked in`}
        disabled={busy}
        onClick={() => onToggle(!here)}
        className={`col-start-3 row-start-1 inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap ring-2 transition-colors disabled:opacity-50 sm:col-start-4 ${here ? "bg-lime-200 text-lime-900 ring-lime-400 hover:bg-lime-100" : "bg-white text-ink ring-amber-300 hover:ring-amber-500"}`}
      >
        {busy ? (
          "Saving…"
        ) : here ? (
          <>
            ✓<span className="sm:hidden">Here</span>
            <span className="hidden sm:inline">Checked in</span>
          </>
        ) : (
          "○ Check in"
        )}
      </button>
    </li>
  );
}

/** On court, in line, or not in the queue yet. */
function PlaceChip({ place }: { place: Place }) {
  if (place.kind === "court") {
    return (
      <span className="rounded-full bg-lime-200 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-lime-900">
        {place.playing ? "▶ Playing" : "Seated"} · {place.label}
      </span>
    );
  }
  if (place.kind === "queue") {
    return (
      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-sky-800">
        In line #{place.position}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-ink/55">
      Not in queue
    </span>
  );
}
