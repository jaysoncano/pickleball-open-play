import { levelRank, LEVELS, type Level } from "./levels";

export type Side = "A" | "B";

export type MatchPlayer = {
  playerId: string;
  name: string;
  /** Level when the match was played. */
  level: Level;
  side: Side;
};

/** A recorded match, as shown on profiles and used as protest evidence. */
export type RecordedMatch = {
  id: string;
  courtLabel: string;
  startedAt: number;
  endedAt: number;
  scoreA: number;
  scoreB: number;
  players: MatchPlayer[];
};

export function winner(match: RecordedMatch): Side {
  return match.scoreA > match.scoreB ? "A" : "B";
}

/** One match from a player's point of view. */
export type PlayerGame = {
  match: RecordedMatch;
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
  partners: MatchPlayer[];
  opponents: MatchPlayer[];
  /** The strongest opponent's level, used to group results. */
  opponentLevel: Level;
};

export function playerGame(
  playerId: string,
  match: RecordedMatch,
): PlayerGame | null {
  const me = match.players.find((p) => p.playerId === playerId);
  if (!me) return null;
  const opponents = match.players.filter((p) => p.side !== me.side);
  const [pointsFor, pointsAgainst] =
    me.side === "A"
      ? [match.scoreA, match.scoreB]
      : [match.scoreB, match.scoreA];
  return {
    match,
    won: winner(match) === me.side,
    pointsFor,
    pointsAgainst,
    partners: match.players.filter(
      (p) => p.side === me.side && p.playerId !== playerId,
    ),
    opponents,
    opponentLevel: opponents.reduce<Level>(
      (top, p) => (levelRank(p.level) > levelRank(top) ? p.level : top),
      LEVELS[0],
    ),
  };
}

export type WinLoss = { wins: number; losses: number };

export type PlayerRecord = WinLoss & {
  games: number;
  /** Whole percent; 0 with no games. */
  winRate: number;
  pointDiff: number;
  minutes: number;
  /** Results against each opponent level, lowest level first. */
  byOpponentLevel: { level: Level; wins: number; losses: number }[];
};

function rate({ wins, losses }: WinLoss) {
  const games = wins + losses;
  return games ? Math.round((wins / games) * 100) : 0;
}

/** Totals for a player's games: the evidence for a level protest. */
export function playerRecord(games: PlayerGame[]): PlayerRecord {
  const byLevel = new Map<Level, WinLoss>();
  let wins = 0;
  let pointDiff = 0;
  let minutes = 0;
  for (const g of games) {
    if (g.won) wins += 1;
    pointDiff += g.pointsFor - g.pointsAgainst;
    minutes += Math.max(
      1,
      Math.round((g.match.endedAt - g.match.startedAt) / 60_000),
    );
    const row = byLevel.get(g.opponentLevel) ?? { wins: 0, losses: 0 };
    row[g.won ? "wins" : "losses"] += 1;
    byLevel.set(g.opponentLevel, row);
  }
  const losses = games.length - wins;
  return {
    games: games.length,
    wins,
    losses,
    winRate: rate({ wins, losses }),
    pointDiff,
    minutes,
    byOpponentLevel: LEVELS.filter((l) => byLevel.has(l)).map((level) => ({
      level,
      ...byLevel.get(level)!,
    })),
  };
}

/** A player's games, newest first. */
export function playerGames(
  playerId: string,
  matches: RecordedMatch[],
): PlayerGame[] {
  return matches
    .map((m) => playerGame(playerId, m))
    .filter((g): g is PlayerGame => g !== null)
    .sort((a, b) => b.match.endedAt - a.match.endedAt);
}
