import Link from "next/link";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { OpenPlay, PairUnit } from "@/lib/db/queries";
import { formatClock } from "@/lib/queue/time";
import { LEVELS } from "@/lib/ranking/levels";
import type { RecordedMatch } from "@/lib/ranking/record";
import {
  finalStandings,
  type Standing,
  type UnitGame,
} from "@/lib/ranking/standings";
import { KIND_INFO, ranksLabel, whenLabel } from "@/lib/registration/open-play";
import { venueLabel } from "@/lib/roles";
import { PlayBanner } from "./play-banner";

const CARD =
  "rounded-[2rem] bg-white/85 p-4 ring-2 ring-white backdrop-blur sm:p-6";

/** 1st, 2nd, 3rd: medal, podium colors, and step height. */
const PLACES = [
  {
    medal: "🥇",
    step: "h-28 sm:h-32",
    block: "bg-gradient-to-b from-amber-300 to-yellow-500 text-amber-950",
    ring: "ring-amber-300",
  },
  {
    medal: "🥈",
    step: "h-20 sm:h-24",
    block: "bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800",
    ring: "ring-slate-300",
  },
  {
    medal: "🥉",
    step: "h-14 sm:h-16",
    block: "bg-gradient-to-b from-orange-300 to-amber-700 text-orange-950",
    ring: "ring-orange-300",
  },
] as const;

/** "Ana & Ben" → ["Ana", "Ben"]. */
const people = (pair: string) => pair.split(" & ");

/**
 * A finished open play: the top pairs, everyone who joined ranked best
 * first, and every game played. What hosts (and players) see after the
 * session ends, instead of setting it up again.
 */
export function ResultsView({
  play,
  pairs,
  games,
  matches,
  backHref,
}: {
  play: OpenPlay;
  /** The pairs who joined (paid). */
  pairs: PairUnit[];
  games: UnitGame[];
  matches: RecordedMatch[];
  /** Hosts go back to My open plays; everyone else to the open plays. */
  backHref: string;
}) {
  const rows = finalStandings(
    pairs.map((p) => ({ id: p.id, name: p.name, skill: p.skill })),
    games,
  );
  const podium = rows.filter((r) => r.games > 0).slice(0, 3);
  // Oldest first, numbered like the night went.
  const played = [...matches].sort((a, b) => a.endedAt - b.endedAt);
  const points = played.reduce((n, m) => n + m.scoreA + m.scoreB, 0);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href={backHref}
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← Back
      </Link>

      <header className="relative overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-28px_rgba(36,28,71,0.55)] ring-2 ring-white">
        <div aria-hidden className="absolute inset-0">
          <PlayBanner play={play} className="h-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/90 via-violet-600/80 to-sky-500/80" />
        <span
          aria-hidden
          className="pointer-events-none absolute top-4 right-6 animate-float text-4xl motion-reduce:animate-none"
        >
          🎉
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-24 bottom-6 animate-float text-3xl [animation-delay:-2s] motion-reduce:animate-none"
        >
          🏓
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute top-16 right-40 animate-float text-2xl [animation-delay:-4s] motion-reduce:animate-none max-sm:hidden"
        >
          ✨
        </span>
        <div className="relative flex flex-col gap-3 p-5 text-white sm:p-7">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-black tracking-widest uppercase backdrop-blur">
              🏁 Final results
            </span>
            <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-black tracking-widest uppercase backdrop-blur">
              {KIND_INFO[play.kind].label}
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold drop-shadow-sm sm:text-4xl">
            {whenLabel(play)}
          </h1>
          <p className="font-semibold text-white/85">
            {[venueLabel(play), ranksLabel(play)].filter(Boolean).join(" · ")}
          </p>
          <dl className="mt-1 grid grid-cols-3 gap-2 sm:max-w-md">
            <Stat label="Pairs" value={rows.length} />
            <Stat label="Games" value={played.length} />
            <Stat label="Points" value={points} />
          </dl>
        </div>
      </header>

      {podium.length > 0 && (
        <section aria-labelledby="top-title" className={CARD}>
          <h2
            id="top-title"
            className="mb-4 text-center font-display text-2xl font-bold"
          >
            🏆 Top pairs
          </h2>
          <ol className="flex items-end justify-center gap-2 sm:gap-4">
            {/* 2nd, 1st, 3rd: the winner stands in the middle. */}
            {[1, 0, 2]
              .filter((i) => podium[i])
              .map((i) => (
                <Podium key={podium[i].id} row={podium[i]} place={i} />
              ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="rank-title" className={CARD}>
        <h2 id="rank-title" className="font-display text-2xl font-bold">
          📊 Rankings
        </h2>
        <p className="mb-4 text-sm text-ink/55">
          Everyone who joined, highest to lowest: points per game for wins,
          margins, and beating stronger pairs.
        </p>
        {rows.length === 0 ? (
          <p className="text-ink/50">No pairs joined.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((r) => (
              <RankRow key={r.id} row={r} />
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="games-title" className={CARD}>
        <h2 id="games-title" className="mb-4 font-display text-2xl font-bold">
          🎾 Every game
        </h2>
        {played.length === 0 ? (
          <p className="text-ink/50">No games were recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white ring-2 ring-ink/5">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-gradient-to-r from-sky-100 to-violet-100 text-[11px] font-bold tracking-wide text-ink/55 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Court
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Duration
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Pair A
                  </th>
                  <th scope="col" className="px-3 py-2 text-center">
                    Score
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Pair B
                  </th>
                </tr>
              </thead>
              <tbody>
                {played.map((m, i) => (
                  <Game key={m.id} match={m} n={i + 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/20 px-3 py-2 text-center backdrop-blur">
      <dt className="text-[11px] font-bold tracking-wider text-white/80 uppercase">
        {label}
      </dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/** Two players' avatars, overlapping. */
function Duo({ pair, size }: { pair: string; size: "sm" | "md" | "lg" }) {
  return (
    <span className="flex shrink-0 -space-x-2">
      {people(pair).map((p, i) => (
        <Avatar key={i} name={p} size={size} className="ring-2 ring-white" />
      ))}
    </span>
  );
}

function Podium({ row, place }: { row: Standing; place: number }) {
  const look = PLACES[place];
  return (
    <li className="animate-pop-in flex w-1/3 max-w-52 flex-col items-center gap-2 motion-reduce:animate-none">
      <span className="relative">
        {place === 0 && (
          <span
            aria-hidden
            className="absolute -top-6 left-1/2 -translate-x-1/2 animate-float text-2xl motion-reduce:animate-none"
          >
            👑
          </span>
        )}
        <span className={`flex rounded-full bg-white p-1 ring-4 ${look.ring}`}>
          <Duo pair={row.name} size="lg" />
        </span>
      </span>
      <span className="text-center font-display text-base leading-tight font-bold sm:text-lg">
        {row.name}
      </span>
      <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-xs font-bold text-ink/60 tabular-nums">
        {row.wins}–{row.losses} · {row.pointDiff > 0 ? "+" : ""}
        {row.pointDiff}
      </span>
      <span
        className={`flex w-full flex-col items-center justify-start rounded-t-2xl pt-2 shadow-inner ${look.step} ${look.block}`}
      >
        <span aria-hidden className="text-3xl">
          {look.medal}
        </span>
        <span className="font-display text-xl font-black">{place + 1}</span>
      </span>
    </li>
  );
}

function RankRow({ row }: { row: Standing }) {
  const idle = row.games === 0;
  const winRate = row.games ? Math.round((row.wins / row.games) * 100) : 0;
  const top = row.rank <= 3 && !idle;
  return (
    <li
      className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-2xl px-3 py-2.5 ring-2 transition-colors ${top ? "bg-gradient-to-r from-amber-50 to-white ring-amber-200" : idle ? "bg-ink/[0.03] ring-transparent" : "bg-white ring-ink/5 hover:ring-fuchsia-200"}`}
    >
      <span
        className={`flex size-9 items-center justify-center rounded-full font-display text-lg font-black ${top ? "bg-white shadow-sm" : "bg-ink/5 text-ink/60"}`}
      >
        {top ? PLACES[row.rank - 1].medal : row.rank}
      </span>
      <span
        className={`flex min-w-0 items-center gap-2 ${idle ? "opacity-60" : ""}`}
      >
        <Duo pair={row.name} size="md" />
        <span className="min-w-0">
          <span className="block font-bold">{row.name}</span>
          <span className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={LEVELS[row.skill ?? 0] ?? LEVELS[0]} size="sm" />
            {idle ? (
              <span className="text-xs font-semibold text-ink/45">
                Didn&apos;t play
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/55">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/10">
                  <span
                    className="block h-full rounded-full bg-lime-500"
                    style={{ width: `${winRate}%` }}
                  />
                </span>
                {row.wins}–{row.losses}
                <span
                  className={
                    row.pointDiff > 0
                      ? "text-lime-700"
                      : row.pointDiff < 0
                        ? "text-rose-600"
                        : ""
                  }
                >
                  {row.pointDiff > 0 ? "+" : ""}
                  {row.pointDiff}
                </span>
              </span>
            )}
          </span>
        </span>
      </span>
      <span
        className={`rounded-full px-3 py-1 font-display font-bold tabular-nums ${idle ? "text-ink/30" : "bg-fuchsia-100 text-fuchsia-700"}`}
        title="Rating: points per game"
      >
        {idle ? "—" : row.rating.toFixed(2)}
      </span>
    </li>
  );
}

/** One game as a table row: both pairs and the score, winner in bold. */
function Game({ match, n }: { match: RecordedMatch; n: number }) {
  const side = (s: "A" | "B") =>
    match.players
      .filter((p) => p.side === s)
      .map((p) => p.name)
      .join(" & ");
  const aWon = match.scoreA > match.scoreB;
  const pair = (name: string, won: boolean, end: boolean) => (
    <span
      className={`flex items-center gap-2 ${end ? "justify-end" : ""} ${won ? "font-bold" : "text-ink/50"}`}
    >
      {end && won && <span aria-hidden>🏆</span>}
      {!end && <Duo pair={name} size="sm" />}
      <span>{name}</span>
      {end && <Duo pair={name} size="sm" />}
      {!end && won && <span aria-hidden>🏆</span>}
    </span>
  );
  return (
    <tr className="border-t border-ink/5 odd:bg-white even:bg-sky-50/40">
      <td className="px-3 py-2 font-display font-bold text-ink/50 tabular-nums">
        {n}
      </td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
          {match.courtLabel}
        </span>
      </td>
      <td className="px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap text-ink/60 tabular-nums">
        <span aria-hidden>⏱ </span>
        {formatClock(match.endedAt - match.startedAt)}
      </td>
      <td className="px-3 py-2">{pair(side("A"), aWon, true)}</td>
      <td className="px-3 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-0.5 font-display text-base font-black tabular-nums">
          <span className={aWon ? "text-lime-700" : "text-ink/40"}>
            {match.scoreA}
          </span>
          <span className="text-ink/30">–</span>
          <span className={aWon ? "text-ink/40" : "text-lime-700"}>
            {match.scoreB}
          </span>
        </span>
      </td>
      <td className="px-3 py-2">{pair(side("B"), !aWon, false)}</td>
    </tr>
  );
}
