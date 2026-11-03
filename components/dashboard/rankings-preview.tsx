"use client";

import { useCallback, useEffect, useState } from "react";
import { liveStandingGames } from "@/app/actions";
import type { QueueState } from "@/lib/queue/schema";
import { RankingList } from "./ranking-list";
import {
  predictionStatus,
  standings,
  type UnitGame,
} from "@/lib/ranking/standings";

const REFRESH_MS = 20_000;

/**
 * The Rankings tab: every pair ranked so far, best first. The list shows
 * once each pair has played a game, so the order means something.
 */
export function RankingsPreview({
  openPlayId,
  session,
  active,
}: {
  openPlayId: string;
  session: QueueState;
  /** The Rankings tab is showing: refresh while it is. */
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
  if (!games) {
    return (
      <p className="rounded-[2rem] bg-white/80 p-5 text-ink/50 ring-2 ring-white">
        Loading rankings…
      </p>
    );
  }
  if (!predictionStatus(units, games).ready) {
    return (
      <p className="rounded-[2rem] border-2 border-dashed border-ink/15 bg-white/60 p-6 text-center text-ink/55">
        🏆 Rankings show here once every pair has played a scored game.
      </p>
    );
  }
  const rows = standings(units, games);

  return (
    <section
      aria-labelledby="preview-title"
      className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="preview-title" className="font-display text-2xl font-bold">
          🏆 Rankings so far
        </h2>
        <span className="text-sm font-semibold text-ink/50">
          Everyone has played · points per game
        </span>
      </div>
      <RankingList rows={rows} />
    </section>
  );
}
