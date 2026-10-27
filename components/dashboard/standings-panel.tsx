"use client";

import { useCallback, useEffect, useState } from "react";
import { liveStandingGames } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { QueueState } from "@/lib/queue/schema";
import {
  LEVEL_INFO,
  LEVELS,
  levelRank,
  type Level,
} from "@/lib/ranking/levels";
import {
  POINTS,
  predictionStatus,
  standings,
  topStandings,
  TOP_OPTIONS,
  type Standing,
  type UnitGame,
} from "@/lib/ranking/standings";

const REFRESH_MS = 20_000;
const MEDALS = ["🥇", "🥈", "🥉"];
const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
const CHIP =
  "min-h-9 rounded-full px-3 text-sm font-bold transition-colors aria-pressed:bg-white aria-pressed:text-fuchsia-600 aria-pressed:shadow-sm text-ink/55 hover:text-ink";

/**
 * Predicted top pairs by points. Starts once every pair in the session
 * has a scored game; the host picks how many to show and which rank.
 */
export function StandingsPanel({
  openPlayId,
  session,
  ranks,
  active,
}: {
  openPlayId: string;
  session: QueueState;
  ranks: Level[];
  /** The tab is showing: refresh while it is. */
  active: boolean;
}) {
  const [games, setGames] = useState<UnitGame[] | null>(null);
  const [top, setTop] = useState<number>(TOP_OPTIONS[0]);
  const [rank, setRank] = useState<Level | "all">("all");
  const recorded = session.matches.length;

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    liveStandingGames(openPlayId)
      .then(setGames)
      .catch(() => setGames((g) => g ?? []));
  }, [openPlayId]);

  // Reload when a game is scored (its save lands a moment later) and
  // every so often while showing, for scores entered on another device.
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
  const all = games ? standings(units, games) : [];
  const status = predictionStatus(units, games ?? []);
  const rows = topStandings(
    all,
    top,
    rank === "all" ? undefined : levelRank(rank),
  );
  const played = units.length - status.waiting.length;

  return (
    <section aria-labelledby="standings-title" className={CARD}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="standings-title" className="font-display text-2xl font-bold">
            {status.ready ? `Predicted top ${top}` : "Leaders so far"}
          </h2>
          <p className="text-sm font-semibold text-ink/50">
            Ranked by points per game, not just wins
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            role="group"
            aria-label="How many to show"
            className="flex rounded-full bg-ink/5 p-1"
          >
            {TOP_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={top === n}
                onClick={() => setTop(n)}
                className={CHIP}
              >
                Top {n}
              </button>
            ))}
          </div>
          {ranks.length > 1 && (
            <div
              role="group"
              aria-label="Rank"
              className="flex flex-wrap rounded-full bg-ink/5 p-1"
            >
              {(["all", ...ranks] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={rank === r}
                  onClick={() => setRank(r)}
                  className={CHIP}
                >
                  {r === "all" ? "All ranks" : LEVEL_INFO[r].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {games && !status.ready && (
        <div className="mb-4 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 p-3">
          <p className="font-display font-semibold text-amber-900">
            ⏳ The prediction starts when every pair has played a game: {played}{" "}
            of {units.length} so far.
          </p>
          {status.waiting.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-amber-900/70">
              Waiting: {status.waiting.map((u) => u.name).join(", ")}
            </p>
          )}
        </div>
      )}

      {games === null ? (
        <p className="font-semibold text-ink/50">Loading scores…</p>
      ) : rows.length === 0 ? (
        <p className="font-semibold text-ink/50">
          {all.length === 0
            ? "No scored games yet."
            : "No scored games in this rank yet."}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <StandingRow key={row.id} row={row} leader={status.ready} />
          ))}
        </ol>
      )}

      <details className="mt-4 rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
        <summary className="cursor-pointer font-bold text-ink/80">
          How points work
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          <li>
            <b>Win:</b> {POINTS.win} points. A loss is 0.
          </li>
          <li>
            <b>Margin:</b> up to ±{POINTS.margin} for the score difference (11–0
            is +{POINTS.margin}, 11–9 is about +0.18).
          </li>
          <li>
            <b>Rank:</b> +{POINTS.perRank} per rank for beating a stronger pair,
            −{POINTS.perRank} per rank for losing to a weaker one.
          </li>
          <li>
            Pairs are ranked by <b>points per game</b>, counted as if each had
            played {POINTS.prior} extra average game, so one lucky win
            can&apos;t top the list. Ties go to more wins, then point
            difference, then points scored.
          </li>
        </ul>
      </details>
    </section>
  );
}

function StandingRow({ row, leader }: { row: Standing; leader: boolean }) {
  const first = row.rank === 1;
  const level = row.skill === undefined ? null : LEVELS[row.skill];
  return (
    <li
      className={`flex items-center gap-3 rounded-3xl p-3 ${first ? "bg-gradient-to-r from-amber-100 to-lime-100 ring-2 ring-amber-300" : "bg-white"}`}
    >
      <span
        aria-label={`Rank ${row.rank}`}
        className="w-9 text-center font-display text-2xl font-bold text-ink/50 tabular-nums"
      >
        {MEDALS[row.rank - 1] ?? row.rank}
      </span>
      <Avatar name={row.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold">{row.name}</span>
          {level && <LevelBadge level={level} size="sm" />}
          {first && leader && (
            <span className="rounded-full bg-amber-300 px-2 text-xs font-bold text-amber-950">
              👑 Predicted winner
            </span>
          )}
        </span>
        <span className="block text-xs font-semibold text-ink/50 tabular-nums">
          {row.wins}W–{row.losses}L · {row.pointDiff > 0 ? "+" : ""}
          {row.pointDiff} pts diff · {row.points} points in {row.games} game
          {row.games === 1 ? "" : "s"}
        </span>
      </span>
      <span className="text-right">
        <span className="block font-display text-2xl font-bold text-fuchsia-600 tabular-nums">
          {row.rating.toFixed(2)}
        </span>
        <span className="block text-xs font-semibold text-ink/45">
          pts / game
        </span>
      </span>
    </li>
  );
}
