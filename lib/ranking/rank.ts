export type RankInput = {
  id: string;
  name: string;
  games: number;
  wins: number;
};

export type Rank = { rank: number; of: number };

/**
 * Leaderboard positions for players with at least one game: most wins
 * first, then higher win rate, then fewer games. Ties share a rank.
 */
export function rankPlayers(players: RankInput[]): Map<string, Rank> {
  const ranked = players
    .filter((p) => p.games > 0)
    .map((p) => ({ ...p, rate: p.wins / p.games }))
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.rate - a.rate ||
        a.games - b.games ||
        a.name.localeCompare(b.name),
    );
  const result = new Map<string, Rank>();
  ranked.forEach((p, i) => {
    const prev = ranked[i - 1];
    const tied =
      prev && prev.wins === p.wins && prev.games === p.games
        ? result.get(prev.id)!.rank
        : i + 1;
    result.set(p.id, { rank: tied, of: ranked.length });
  });
  return result;
}
