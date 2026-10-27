"use client";

import Link from "next/link";
import { useState } from "react";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { PlayerSummary } from "@/lib/db/queries";
import { photoUrl } from "@/lib/profile/forms";
import { nameKey } from "@/lib/queue/names";
import { LEVEL_INFO, LEVELS, type Level } from "@/lib/ranking/levels";
import { rankPlayers } from "@/lib/ranking/rank";

export function PlayersDirectory({ players }: { players: PlayerSummary[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "all">("all");
  const [sort, setSort] = useState<"name" | "rank">("name");
  const ranks = rankPlayers(players);
  const key = nameKey(query);
  const shown = players
    .filter(
      (p) =>
        (nameKey(p.name).includes(key) || nameKey(p.fullName).includes(key)) &&
        (level === "all" || p.level === level),
    )
    .sort((a, b) =>
      sort === "rank"
        ? (ranks.get(a.id)?.rank ?? Infinity) -
            (ranks.get(b.id)?.rank ?? Infinity) || a.name.localeCompare(b.name)
        : 0,
    );

  return (
    <section className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="player-search" className="sr-only">
          Search players
        </label>
        <input
          id="player-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          autoComplete="off"
          className="min-h-12 flex-1 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
        <label htmlFor="level-filter" className="sr-only">
          Filter by level
        </label>
        <select
          id="level-filter"
          value={level}
          onChange={(e) => setLevel(e.target.value as Level | "all")}
          className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
        >
          <option value="all">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_INFO[l].label}
            </option>
          ))}
        </select>
        <label htmlFor="player-sort" className="sr-only">
          Sort players
        </label>
        <select
          id="player-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "rank")}
          className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
        >
          <option value="name">By name</option>
          <option value="rank">By ranking</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          {players.length === 0
            ? "No players yet. They're registered when a host adds them to open play."
            : "No player matches that search."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((p) => {
            const losses = p.games - p.wins;
            const rank = ranks.get(p.id);
            return (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-2 ring-transparent transition-colors hover:ring-fuchsia-200"
                >
                  <span className="w-8 text-center text-sm font-bold text-ink/45 tabular-nums">
                    {rank ? `#${rank.rank}` : "–"}
                  </span>
                  <Avatar
                    name={p.name}
                    src={photoUrl(p.id, p.photoUpdatedAt)}
                    size="md"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-bold">{p.name}</span>
                    {p.fullName && p.fullName !== p.name && (
                      <span className="ml-2 text-sm text-ink/50">
                        {p.fullName}
                      </span>
                    )}
                  </span>
                  <LevelBadge level={p.level} />
                  <span className="w-24 text-right text-sm font-semibold text-ink/55 tabular-nums">
                    {p.games ? `${p.wins}W – ${losses}L` : "No games"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
