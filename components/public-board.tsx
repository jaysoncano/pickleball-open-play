import Link from "next/link";
import { TAB, TAB_BAR, TAB_EMOJI, TAB_OFF, TAB_ON } from "@/components/ui/tabs";
import { MatchHistory } from "@/components/dashboard/match-history";
import { PlayerStatsTable } from "@/components/dashboard/player-stats-table";
import { RankingList } from "@/components/dashboard/ranking-list";
import { StatsRow } from "@/components/dashboard/stats-row";
import { stats } from "@/lib/queue/engine";
import type { QueueState } from "@/lib/queue/schema";
import { formatTimeLabel } from "@/lib/queue/time";
import {
  predictionStatus,
  standings,
  type UnitGame,
} from "@/lib/ranking/standings";
import { AutoRefresh } from "./auto-refresh";
import { PublicCourts } from "./public-courts";

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

/** The public board's tabs, in order. */
export const BOARD_TABS = [
  { id: "courts", label: "Courts", emoji: "🎾" },
  { id: "rankings", label: "Rankings", emoji: "📊" },
  { id: "games", label: "Games", emoji: "🔢" },
  { id: "history", label: "History", emoji: "🏆" },
] as const;
export type BoardTab = (typeof BOARD_TABS)[number]["id"];

/** `?tab=` from the URL, or Courts. */
export function boardTab(raw: unknown): BoardTab {
  return BOARD_TABS.find((t) => t.id === raw)?.id ?? "courts";
}

/** Each pair unit's players, so names link to real profiles. */
export type UnitMembers = Record<string, { id: string; name: string }[]>;

/**
 * Read-only view of a running open play for players and anyone watching:
 * who's on court and up next, rankings, games each pair has played, and
 * every finished game with its score. Nothing private: no payments,
 * notes, check-in, emails, phones, or QR codes. Refreshes itself.
 */
export function PublicBoard({
  session,
  members = {},
  heading,
  tab = "courts",
  games = [],
  baseHref,
  linkProfiles = true,
}: {
  session: QueueState | null;
  members?: UnitMembers;
  /** Which open play this is, e.g. "Novice – Intermediate · Tue, Oct 27…". */
  heading?: string;
  tab?: BoardTab;
  /** Scored games by pair, for the rankings. */
  games?: UnitGame[];
  /** This board's URL without `tab`, e.g. "/open-plays/…?view=courts". */
  baseHref?: string;
  /** Ranked players have profile pages; Regular guests don't. */
  linkProfiles?: boolean;
}) {
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <AutoRefresh seconds={30} />
        <span aria-hidden className="text-6xl">
          🏓
        </span>
        <h1 className="font-display text-3xl font-bold">
          No open play running
        </h1>
        <p className="text-ink/60">
          This page updates by itself when the host starts a session. Meanwhile,
          check out the{" "}
          <Link href="/players" className="font-bold text-fuchsia-600">
            players and their records
          </Link>
          .
        </p>
      </main>
    );
  }

  const summary = stats(session);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <AutoRefresh />
      {heading && (
        <p className="self-start rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-ink/70 ring-2 ring-white">
          <Link href="/" className="hover:text-fuchsia-600">
            ← Open plays
          </Link>{" "}
          · {heading}
        </p>
      )}
      <header className={`${CARD} flex flex-wrap items-baseline gap-x-3`}>
        <h1 className="font-display text-2xl font-bold">
          <span aria-hidden>🏓</span> Open play
        </h1>
        <span className="font-semibold text-ink/50">
          {formatTimeLabel(session.config.startTime)} –{" "}
          {formatTimeLabel(session.config.endTime)} · live, updates every 15s
        </span>
      </header>

      <StatsRow {...summary} courts={session.courts.length} />

      {baseHref && (
        <nav aria-label="Board" className={`sticky top-2 z-30 ${TAB_BAR}`}>
          {BOARD_TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Link
                key={t.id}
                href={`${baseHref}&tab=${t.id}`}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={`${TAB} ${on ? TAB_ON : TAB_OFF}`}
              >
                <span aria-hidden className={TAB_EMOJI}>
                  {t.emoji}
                </span>
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}

      {tab === "courts" && (
        <PublicCourts session={session} teams={members} link={linkProfiles} />
      )}
      {tab === "rankings" && <RankingsView session={session} games={games} />}
      {tab === "games" && <PlayerStatsTable session={session} />}
      {tab === "history" && <MatchHistory matches={session.matches} />}
    </main>
  );
}

/** Rankings so far, once every pair has a scored game. */
function RankingsView({
  session,
  games,
}: {
  session: QueueState;
  games: UnitGame[];
}) {
  const units = Object.values(session.players).map(({ id, name, skill }) => ({
    id,
    name,
    skill,
  }));
  if (!predictionStatus(units, games).ready) {
    return (
      <p className="rounded-[2rem] border-2 border-dashed border-ink/15 bg-white/60 p-6 text-center text-ink/55">
        🏆 Rankings show here once every pair has played a scored game.
      </p>
    );
  }
  return (
    <section aria-labelledby="rankings-title" className={CARD}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rankings-title" className="font-display text-2xl font-bold">
          🏆 Rankings so far
        </h2>
        <span className="text-sm font-semibold text-ink/50">
          Points per game · W–L · point difference
        </span>
      </div>
      <RankingList rows={standings(units, games)} />
    </section>
  );
}
