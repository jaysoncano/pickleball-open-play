"use client";

import { Fragment, useState } from "react";
import { courtTheme } from "@/components/court-theme";
import { Avatar } from "@/components/ui/avatar";
import {
  courtNumber,
  playerStats,
  type PlayedGame,
  type PlayerSort,
  type PlayerStatus,
} from "@/lib/queue/history";
import type { QueueState } from "@/lib/queue/schema";
import { formatMinutes } from "@/lib/queue/time";

const SORTS: { id: PlayerSort; label: string }[] = [
  { id: "most", label: "Most games" },
  { id: "fewest", label: "Fewest" },
  { id: "name", label: "A–Z" },
];

const STATUS: Record<PlayerStatus, { label: string; tone: string }> = {
  playing: { label: "Playing", tone: "bg-lime-200 text-lime-900" },
  ready: { label: "On court", tone: "bg-amber-200 text-amber-900" },
  waiting: { label: "Waiting", tone: "bg-sky-100 text-sky-800" },
  left: { label: "Left", tone: "bg-ink/5 text-ink/50" },
};

export function PlayerStatsTable({ session }: { session: QueueState }) {
  const [sort, setSort] = useState<PlayerSort>("most");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = playerStats(session, sort);
  const maxGames = Math.max(1, ...rows.map((r) => r.games));
  const present = rows.filter((r) => r.status !== "left");
  const fewest = Math.min(...present.map((r) => r.games));
  const totalGames = present.reduce((n, r) => n + r.games, 0);

  return (
    <section
      aria-labelledby="players-title"
      className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="players-title" className="font-display text-2xl font-bold">
            Players
          </h2>
          {present.length > 0 && (
            <p className="text-sm font-semibold text-ink/50">
              {present.length} here · avg{" "}
              {(totalGames / present.length).toFixed(1)} games each
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label="Sort players"
          className="flex rounded-full bg-ink/5 p-1"
        >
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              className={`min-h-9 rounded-full px-3 text-sm font-bold transition-colors ${sort === s.id ? "bg-white text-fuchsia-600 shadow-sm" : "text-ink/55 hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1.5 text-left">
          <thead>
            <tr className="text-xs font-bold tracking-wide text-ink/45 uppercase">
              <th scope="col" className="w-8 px-1 text-center">
                #
              </th>
              <th scope="col" className="px-2">
                Player
              </th>
              <th scope="col" className="px-2">
                Games
              </th>
              <th scope="col" className="px-2 max-sm:hidden">
                Time
              </th>
              <th scope="col" className="px-2 text-right">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const behind =
                row.status !== "left" &&
                row.games === fewest &&
                fewest < maxGames;
              const open = openId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    className={`${row.status === "left" ? "opacity-60" : ""}`}
                  >
                    <td className="rounded-l-2xl bg-white px-1 py-2 text-center font-display text-sm font-bold text-ink/40 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="bg-white px-2 py-2">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`games-${row.id}`}
                        disabled={row.played.length === 0}
                        onClick={() => setOpenId(open ? null : row.id)}
                        className="flex min-w-0 items-center gap-2 rounded-xl text-left enabled:cursor-pointer enabled:hover:text-fuchsia-600"
                      >
                        <Avatar name={row.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block max-w-32 truncate font-bold sm:max-w-48">
                            {row.name}
                          </span>
                          <span className="block text-xs font-semibold text-ink/45 sm:hidden">
                            {formatMinutes(row.minutes)}
                          </span>
                        </span>
                        {row.played.length > 0 && (
                          <span
                            aria-hidden
                            className={`text-xs text-ink/40 transition-transform ${open ? "rotate-90" : ""}`}
                          >
                            ▶
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="bg-white px-2 py-2">
                      <span className="flex items-center gap-2">
                        <span className="w-6 font-display text-lg font-bold tabular-nums">
                          {row.games}
                        </span>
                        <span
                          aria-hidden
                          className="h-2 w-12 overflow-hidden rounded-full bg-ink/5 sm:w-20"
                        >
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-lime-400 to-fuchsia-500"
                            style={{
                              width: `${(row.games / maxGames) * 100}%`,
                            }}
                          />
                        </span>
                        {behind && (
                          <span
                            title="Fewest games so far"
                            className="rounded-full bg-fuchsia-100 px-1.5 text-[10px] font-bold text-fuchsia-700 uppercase max-sm:hidden"
                          >
                            Due
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="bg-white px-2 py-2 text-sm font-semibold text-ink/60 tabular-nums max-sm:hidden">
                      {formatMinutes(row.minutes)}
                    </td>
                    <td className="rounded-r-2xl bg-white px-2 py-2 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS[row.status].tone}`}
                      >
                        {STATUS[row.status].label}
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr id={`games-${row.id}`}>
                      <td
                        colSpan={5}
                        className="rounded-2xl bg-white/60 px-3 py-2"
                      >
                        <PlayedGames games={row.played} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One chip per finished game: court and how long it ran. */
function PlayedGames({ games }: { games: PlayedGame[] }) {
  return (
    <ol aria-label="Games played" className="flex flex-wrap gap-1.5">
      {games.map((game) => {
        const theme = courtTheme(courtNumber(game.courtLabel) - 1);
        return (
          <li
            key={game.endedAt}
            className="flex items-center gap-1 rounded-full bg-white py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-ink/70 ring-1 ring-ink/10"
          >
            <span
              className={`rounded-full px-2 py-0.5 font-display font-bold ${theme.badge}`}
            >
              {game.courtLabel}
            </span>
            ⏱ {formatMinutes(game.minutes)}
          </li>
        );
      })}
    </ol>
  );
}
