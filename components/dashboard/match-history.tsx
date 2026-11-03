"use client";

import { useState } from "react";
import { courtTheme } from "@/components/court-theme";
import { Avatar } from "@/components/ui/avatar";
import {
  courtNumber,
  courtSummary,
  historySummary,
  matchMinutes,
  matchSides,
  matchWinner,
} from "@/lib/queue/history";
import type { Match } from "@/lib/queue/schema";
import { formatMinutes } from "@/lib/queue/time";

const COLLAPSED_COUNT = 5;

const timeLabel = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function MatchHistory({ matches }: { matches: Match[] }) {
  const [expanded, setExpanded] = useState(false);
  const { recent, averageMinutes } = historySummary(matches);
  const shown = expanded ? recent : recent.slice(0, COLLAPSED_COUNT);

  return (
    <section
      aria-labelledby="history-title"
      className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="history-title" className="font-display text-2xl font-bold">
          Game history
        </h2>
        {matches.length > 0 && (
          <span className="text-sm font-semibold text-ink/50">
            {matches.length} game{matches.length === 1 ? "" : "s"} · avg{" "}
            {averageMinutes} min
          </span>
        )}
      </div>

      {matches.length > 0 && <CourtTotals matches={matches} />}

      {matches.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-5 text-center text-ink/50">
          Finished games show up here: court, minutes played, the score, and who
          won. 🏆
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {shown.map((match) => (
            <MatchRow
              key={`${match.courtLabel}-${match.endedAt}`}
              match={match}
            />
          ))}
        </ol>
      )}

      {recent.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 min-h-11 w-full rounded-2xl font-display font-semibold text-sky-600 hover:bg-sky-50"
        >
          {expanded ? "Show less" : `Show all ${recent.length} games`}
        </button>
      )}
    </section>
  );
}

/** Games and total play time on each court. */
function CourtTotals({ matches }: { matches: Match[] }) {
  return (
    <ul aria-label="Time per court" className="mb-3 flex flex-wrap gap-1.5">
      {courtSummary(matches).map((court) => {
        const theme = courtTheme(courtNumber(court.courtLabel) - 1);
        return (
          <li
            key={court.courtLabel}
            className={`flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-ink/70 ring-2 ${theme.card}`}
          >
            <span
              className={`rounded-full px-2 py-0.5 font-display font-bold ${theme.badge}`}
            >
              {court.courtLabel}
            </span>
            {court.games} game{court.games === 1 ? "" : "s"} · ⏱{" "}
            {formatMinutes(court.minutes)}
          </li>
        );
      })}
    </ul>
  );
}

function MatchRow({ match }: { match: Match }) {
  const theme = courtTheme(courtNumber(match.courtLabel) - 1);
  const [sideA, sideB] = matchSides(match);
  const winner = matchWinner(match);
  const score = match.score;

  return (
    <li
      aria-label={
        score
          ? `${match.courtLabel}: ${sideA.join(" & ")} ${score.scoreA}, ${sideB.join(" & ")} ${score.scoreB}`
          : undefined
      }
      className={`animate-pop-in flex flex-col gap-3 rounded-3xl p-3 ring-2 motion-reduce:animate-none sm:p-4 ${theme.card}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-xl px-2.5 py-0.5 font-display text-sm font-bold ${theme.badge}`}
        >
          {match.courtLabel}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink/60">
          <span className="rounded-full bg-white px-2.5 py-0.5 font-display font-bold text-ink">
            ⏱ {formatMinutes(matchMinutes(match))}
          </span>
          <span>
            {timeLabel.format(match.startedAt)}–
            {timeLabel.format(match.endedAt)}
          </span>
        </span>
      </div>
      {/* Phones: side A over side B. From sm up: side by side. */}
      <div className="grid gap-2 pt-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch sm:gap-3">
        <Side
          names={sideA}
          points={score?.scoreA}
          result={result(winner, "a")}
        />
        <span
          aria-hidden
          className="flex items-center justify-center gap-2 sm:flex-col"
        >
          <span className="h-0.5 flex-1 rounded-full bg-white sm:h-auto sm:w-0.5" />
          <span className="rounded-full bg-ink px-2.5 py-0.5 font-display text-xs font-black tracking-wider text-white">
            VS
          </span>
          <span className="h-0.5 flex-1 rounded-full bg-white sm:h-auto sm:w-0.5" />
        </span>
        <Side
          names={sideB}
          points={score?.scoreB}
          result={result(winner, "b")}
          alignEnd
        />
      </div>
    </li>
  );
}

type Result = "win" | "loss" | null;

/** A side's result: null when the game has no score. */
function result(winner: "a" | "b" | null, side: "a" | "b"): Result {
  if (!winner) return null;
  return winner === side ? "win" : "loss";
}

const PANEL: Record<"win" | "loss" | "none", string> = {
  win: "bg-white ring-amber-300 shadow-[0_10px_25px_-12px_rgba(180,83,9,0.55)]",
  loss: "bg-white/45 ring-ink/5",
  none: "bg-white/80 ring-white",
};

/**
 * One side as a scoreboard panel: players and their points. The winner
 * gets a gold sticker slapped on its corner; the loser a faded stamp.
 */
function Side({
  names,
  points,
  result,
  alignEnd = false,
}: {
  names: string[];
  points?: number;
  result: Result;
  alignEnd?: boolean;
}) {
  const win = result === "win";
  const loss = result === "loss";
  return (
    <div
      className={`relative flex min-h-20 items-center gap-3 rounded-2xl p-3 ring-2 ${PANEL[result ?? "none"]} ${alignEnd ? "sm:flex-row-reverse" : ""}`}
    >
      {win && <WinSticker alignEnd={alignEnd} />}
      {loss && <LostStamp alignEnd={alignEnd} />}

      <ul
        className={`flex min-w-0 flex-1 flex-col gap-1.5 ${alignEnd ? "sm:items-end" : ""} ${loss ? "opacity-55 grayscale" : ""}`}
      >
        {names.map((name) => (
          <li
            key={name}
            className={`flex max-w-full min-w-0 items-center gap-2 ${alignEnd ? "sm:flex-row-reverse" : ""}`}
          >
            <Avatar name={name} size="sm" />
            <span
              className={`truncate font-display text-base ${win ? "font-bold text-ink" : "font-semibold text-ink/80"}`}
              title={name}
            >
              {name}
            </span>
          </li>
        ))}
      </ul>

      {points !== undefined && (
        <span
          className={`shrink-0 font-display text-4xl leading-none font-black tabular-nums ${win ? "text-emerald-600" : "text-ink/25"}`}
        >
          {points}
        </span>
      )}
    </div>
  );
}

/** Die-cut gold sticker: white border, drop shadow, a little tilted. */
function WinSticker({ alignEnd }: { alignEnd: boolean }) {
  return (
    <span
      className={`animate-sticker absolute -top-3.5 z-10 inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-300 to-amber-500 px-2.5 py-1 font-display text-sm font-black tracking-wide text-amber-950 uppercase shadow-[0_6px_14px_-4px_rgba(120,53,15,0.55)] ring-[3px] ring-white motion-reduce:animate-none ${alignEnd ? "right-3 rotate-6 sm:right-auto sm:left-3 sm:-rotate-6" : "right-3 rotate-6"}`}
    >
      <span aria-hidden className="text-base">
        🏆
      </span>
      Winner
    </span>
  );
}

/** Rubber stamp: outlined, faded ink, tilted the other way. */
function LostStamp({ alignEnd }: { alignEnd: boolean }) {
  return (
    <span
      className={`animate-sticker absolute -top-3 z-10 rounded-lg border-[3px] border-double border-rose-400/80 bg-white/90 px-2 py-0.5 font-display text-xs font-black tracking-[0.25em] text-rose-500/85 uppercase motion-reduce:animate-none ${alignEnd ? "right-3 -rotate-6 sm:right-auto sm:left-3 sm:rotate-6" : "right-3 -rotate-6"}`}
    >
      Lost
    </span>
  );
}
