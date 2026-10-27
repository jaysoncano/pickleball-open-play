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
          Finished games show up here: court, minutes played, and who played
          who. 🏆
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

  return (
    <li
      className={`animate-pop-in flex flex-col gap-2 rounded-3xl p-3 ring-2 motion-reduce:animate-none ${theme.card}`}
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
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Side names={sideA} />
        <span className="rounded-full bg-ink px-2 py-0.5 font-display text-xs font-bold tracking-wider text-white">
          VS
        </span>
        <Side names={sideB} alignEnd />
      </div>
    </li>
  );
}

function Side({
  names,
  alignEnd = false,
}: {
  names: string[];
  alignEnd?: boolean;
}) {
  return (
    <ul
      className={`flex min-w-0 flex-col gap-1 ${alignEnd ? "items-end" : "items-start"}`}
    >
      {names.map((name) => (
        <li
          key={name}
          className={`flex max-w-full min-w-0 items-center gap-1.5 ${alignEnd ? "flex-row-reverse" : ""}`}
        >
          <Avatar name={name} size="sm" />
          <span className="truncate text-sm font-bold">{name}</span>
        </li>
      ))}
    </ul>
  );
}
