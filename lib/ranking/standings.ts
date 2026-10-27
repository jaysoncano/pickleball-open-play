/**
 * Open play standings by points, not just wins and losses. Each scored
 * game earns a pair points for the result, the margin, and beating (or
 * losing to) a pair of another rank. Pairs play different numbers of
 * games, so they're ranked by points per game, pulled toward the field's
 * average until they've played more (one lucky game can't top the list).
 */

/** A scored game between queue units (pairs, or players). */
export type UnitGame = {
  id: string;
  sideA: string[];
  sideB: string[];
  scoreA: number;
  scoreB: number;
};

/** A unit in the session: its id, name, and rank (0 = lowest level). */
export type StandingUnit = { id: string; name: string; skill?: number };

export const POINTS = {
  /** For winning a game. */
  win: 3,
  /** Up to this for the margin, from -margin (lost 0-11) to +margin. */
  margin: 1,
  /** Points that make a full margin (an 11-0 game). */
  fullMargin: 11,
  /** Per rank between you: beating a stronger pair, or losing to a weaker one. */
  perRank: 0.5,
  /** Average games added to each pair's record (shrinks small samples). */
  prior: 1,
} as const;

/** How many top pairs the host can show. */
export const TOP_OPTIONS = [3, 5, 10] as const;

export type Standing = {
  id: string;
  name: string;
  skill?: number;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /** Points earned over all games. */
  points: number;
  /** Points per game, pulled toward the field average: what ranks them. */
  rating: number;
  /** 1 for the leader; ties share a rank. */
  rank: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Points one game is worth to a side. */
export function gamePoints(
  game: { pointsFor: number; pointsAgainst: number },
  mySkill = 0,
  theirSkill = 0,
): number {
  const won = game.pointsFor > game.pointsAgainst;
  const diff = Math.max(
    -POINTS.fullMargin,
    Math.min(POINTS.fullMargin, game.pointsFor - game.pointsAgainst),
  );
  const gap = theirSkill - mySkill;
  const upset = won ? Math.max(0, gap) : Math.min(0, gap);
  return (
    (won ? POINTS.win : 0) +
    (POINTS.margin * diff) / POINTS.fullMargin +
    POINTS.perRank * upset
  );
}

/** A side's rank: its strongest unit. */
function sideSkill(ids: string[], skill: Map<string, number>): number {
  return Math.max(0, ...ids.map((id) => skill.get(id) ?? 0));
}

/**
 * Standings for every unit with at least one scored game, best first:
 * rating, then wins, point difference, points scored, and name.
 */
export function standings(
  units: StandingUnit[],
  games: UnitGame[],
): Standing[] {
  const known = new Map(units.map((u) => [u.id, u]));
  const skill = new Map(
    units.flatMap((u) => (u.skill === undefined ? [] : [[u.id, u.skill]])),
  );
  const rows = new Map<string, Omit<Standing, "rating" | "rank">>();
  const row = (id: string) => {
    const unit = known.get(id);
    const existing = rows.get(id);
    if (existing) return existing;
    const fresh = {
      id,
      name: unit?.name ?? "Left the session",
      skill: unit?.skill,
      games: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      points: 0,
    };
    rows.set(id, fresh);
    return fresh;
  };

  for (const g of games) {
    const sides = [
      { ids: g.sideA, them: g.sideB, pf: g.scoreA, pa: g.scoreB },
      { ids: g.sideB, them: g.sideA, pf: g.scoreB, pa: g.scoreA },
    ];
    for (const side of sides) {
      const earned = gamePoints(
        { pointsFor: side.pf, pointsAgainst: side.pa },
        sideSkill(side.ids, skill),
        sideSkill(side.them, skill),
      );
      for (const id of side.ids) {
        const r = row(id);
        r.games += 1;
        r[side.pf > side.pa ? "wins" : "losses"] += 1;
        r.pointsFor += side.pf;
        r.pointsAgainst += side.pa;
        r.pointDiff += side.pf - side.pa;
        r.points += earned;
      }
    }
  }

  const all = [...rows.values()];
  const totalGames = all.reduce((n, r) => n + r.games, 0);
  const average = totalGames
    ? all.reduce((n, r) => n + r.points, 0) / totalGames
    : 0;
  const rated = all
    .map((r) => ({
      ...r,
      points: round2(r.points),
      rating: round2(
        (r.points + POINTS.prior * average) / (r.games + POINTS.prior),
      ),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.wins - a.wins ||
        b.pointDiff - a.pointDiff ||
        b.pointsFor - a.pointsFor ||
        a.name.localeCompare(b.name),
    );

  const ranked: Standing[] = [];
  rated.forEach((r, i) => {
    const prev = ranked[i - 1];
    const tied =
      prev &&
      prev.rating === r.rating &&
      prev.wins === r.wins &&
      prev.pointDiff === r.pointDiff &&
      prev.pointsFor === r.pointsFor;
    ranked.push({ ...r, rank: tied ? prev.rank : i + 1 });
  });
  return ranked;
}

/**
 * The prediction starts once every unit in the session has a scored
 * game. Until then, who's still waiting for their first one.
 */
export function predictionStatus(
  units: StandingUnit[],
  games: UnitGame[],
): { ready: boolean; waiting: StandingUnit[] } {
  const played = new Set(games.flatMap((g) => [...g.sideA, ...g.sideB]));
  const waiting = units.filter((u) => !played.has(u.id));
  return { ready: units.length > 0 && waiting.length === 0, waiting };
}

/**
 * The top `count` of the standings, optionally within one rank (ranks
 * renumbered from 1). Ties at the cut stay in, so nobody tied for 3rd is
 * left out of a top 3.
 */
export function topStandings(
  rows: Standing[],
  count: number,
  skill?: number,
): Standing[] {
  const pool =
    skill === undefined
      ? rows
      : standingsWithin(rows.filter((r) => r.skill === skill));
  return pool.filter((r) => r.rank <= count);
}

function standingsWithin(rows: Standing[]): Standing[] {
  const out: Standing[] = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied = prev && prev.rank === r.rank;
    out.push({ ...r, rank: tied ? out[i - 1].rank : i + 1 });
  });
  return out;
}
