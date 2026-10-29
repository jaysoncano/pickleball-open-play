"use client";

import { useCallback, useEffect, useState } from "react";
import { liveStandingGames } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { QueueState } from "@/lib/queue/schema";
import { LEVELS } from "@/lib/ranking/levels";
import {
  predictionStatus,
  standings,
  type UnitGame,
} from "@/lib/ranking/standings";

const REFRESH_MS = 20_000;
const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Under the courts: every pair ranked so far, best first. Shows once each
 * pair has played a game, so the order means something.
 */
export function RankingsPreview({
  openPlayId,
  session,
  active,
}: {
  openPlayId: string;
  session: QueueState;
  /** The Courts tab is showing: refresh while it is. */
  active: boolean;
}) {
  const [games, setGames] = useState<UnitGame[] | null>(null);
  const recorded = session.matches.length;

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    liveStandingGames(openPlayId)
      .then(setGames)
      .catch(() => setGames((g) => g ?? []));
  }, [openPlayId]);

  // Reload when a game is scored (its save lands a moment later) and every
  // so often, for scores entered on another device.
  useEffect(() => {
    if (!active) return;
    load();
    const again = setTimeout(load, 2_000);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(again);
      clearInterval(timer);
    };
  }, [active, load, recorded]);

  const units = Object.values(session.players).map(({ id, name, skill }) => ({
    id,
    name,
    skill,
  }));
  if (!games || !predictionStatus(units, games).ready) return null;
  const rows = standings(units, games);

  return (
    <section
      aria-labelledby="preview-title"
      className="mt-5 rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="preview-title" className="font-display text-2xl font-bold">
          🏆 Rankings so far
        </h2>
        <span className="text-sm font-semibold text-ink/50">
          Everyone has played · points per game
        </span>
      </div>
      <ol className="-m-1 flex max-h-96 flex-col gap-1.5 overflow-y-auto p-1">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-2xl px-3 py-2 ring-2 ${r.rank <= 3 ? "bg-amber-50 ring-amber-200" : "bg-white ring-ink/5"}`}
          >
            <span className="text-center font-display text-lg font-bold tabular-nums">
              {MEDALS[r.rank - 1] ?? r.rank}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              {r.name.split(" & ").map((person, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <Avatar name={person} size="sm" />
                  <span className="font-bold">{person}</span>
                </span>
              ))}
              <LevelBadge level={LEVELS[r.skill ?? 0] ?? LEVELS[0]} size="sm" />
            </span>
            <span className="text-right text-sm tabular-nums">
              <span className="block font-bold">{r.rating.toFixed(2)}</span>
              <span className="text-xs font-semibold text-ink/50">
                {r.wins}–{r.losses} · {r.pointDiff > 0 ? "+" : ""}
                {r.pointDiff}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
