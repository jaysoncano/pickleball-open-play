import type { Match, QueueState } from "./schema";

/** Side A and side B names for a finished game. */
export function matchSides(match: Match): [string[], string[]] {
  const half = Math.ceil(match.playerNames.length / 2);
  return [match.playerNames.slice(0, half), match.playerNames.slice(half)];
}

/** Whole minutes played, never shown as zero. */
export function matchMinutes(match: Match): number {
  return Math.max(1, Math.round((match.endedAt - match.startedAt) / 60_000));
}

/** "Ana & Ben vs Cy & Dee" */
export function matchup(match: Match): string {
  return matchSides(match)
    .map((side) => side.join(" & "))
    .join(" vs ");
}

/** Court number from a label like "Court 3", used to pick its color. */
export function courtNumber(label: string): number {
  const match = /(\d+)\s*$/.exec(label);
  return match ? Number(match[1]) : 1;
}

/** Newest first, with average game length in minutes. */
export function historySummary(matches: Match[]) {
  const recent = [...matches].reverse();
  const total = matches.reduce((sum, m) => sum + matchMinutes(m), 0);
  return {
    recent,
    averageMinutes: matches.length ? Math.round(total / matches.length) : 0,
  };
}

export type CourtTotal = { courtLabel: string; games: number; minutes: number };

/** Games and minutes played on each court, in court-number order. */
export function courtSummary(matches: Match[]): CourtTotal[] {
  const totals = new Map<string, CourtTotal>();
  for (const match of matches) {
    const row = totals.get(match.courtLabel) ?? {
      courtLabel: match.courtLabel,
      games: 0,
      minutes: 0,
    };
    row.games += 1;
    row.minutes += matchMinutes(match);
    totals.set(match.courtLabel, row);
  }
  return [...totals.values()].sort(
    (a, b) => courtNumber(a.courtLabel) - courtNumber(b.courtLabel),
  );
}

export type PlayerStatus = "playing" | "ready" | "waiting" | "left";

export type PlayerStat = {
  id: string;
  name: string;
  games: number;
  minutes: number;
  status: PlayerStatus;
  /** Finished games, newest first. */
  played: PlayedGame[];
};

export type PlayedGame = {
  courtLabel: string;
  minutes: number;
  endedAt: number;
};

export type PlayerSort = "most" | "fewest" | "name";

/**
 * One row per player who is here or has played: games, minutes on court,
 * and where they are now. Players who left keep their finished games.
 */
export function playerStats(
  state: QueueState,
  sort: PlayerSort = "most",
): PlayerStat[] {
  const rows: Record<string, PlayerStat> = {};
  for (const p of Object.values(state.players)) {
    rows[p.id] = {
      id: p.id,
      name: p.name,
      games: p.gamesPlayed,
      minutes: 0,
      status: "waiting",
      played: [],
    };
  }
  for (const match of state.matches) {
    match.playerIds.forEach((id, i) => {
      rows[id] ??= {
        id,
        name: match.playerNames[i],
        games: 0,
        minutes: 0,
        status: "left",
        played: [],
      };
      const minutes = matchMinutes(match);
      rows[id].minutes += minutes;
      rows[id].played.unshift({
        courtLabel: match.courtLabel,
        minutes,
        endedAt: match.endedAt,
      });
      if (rows[id].status === "left") rows[id].games += 1;
    });
  }
  for (const court of state.courts) {
    for (const id of court.playerIds) {
      rows[id].status = court.startedAt === null ? "ready" : "playing";
    }
  }

  const byName = (a: PlayerStat, b: PlayerStat) => a.name.localeCompare(b.name);
  const compare = {
    most: (a: PlayerStat, b: PlayerStat) => b.games - a.games || byName(a, b),
    fewest: (a: PlayerStat, b: PlayerStat) => a.games - b.games || byName(a, b),
    name: byName,
  }[sort];
  return Object.values(rows).sort(compare);
}
