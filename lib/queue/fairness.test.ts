import { describe, expect, it } from "vitest";

/** A full night of regulars. */
const REGULARS = Array.from({ length: 28 }, (_, i) => `Player ${i + 1}`);
import { addPlayers, createSession, finishGame, startGame } from "./engine";
import type { QueueState } from "./schema";

const MIN = 60_000;
const NOW = new Date(2026, 9, 23, 17, 0).getTime();

/** Small seeded RNG so every run plays out the same way. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Arrival = { atMinute: number; names: string[] };

/**
 * Play a whole session: start every ready court, finish whichever game
 * ends first (games last 9–21 minutes), repeat until time is up.
 */
function simulate({
  names,
  courtCount,
  hours,
  seed,
  arrivals = [],
  cap = 4,
}: {
  cap?: 2 | 4;
  names: string[];
  courtCount: number;
  hours: number;
  seed: number;
  arrivals?: Arrival[];
}) {
  const rng = seeded(seed);
  let id = 0;
  const ids = () => `p${++id}`;
  let s: QueueState = createSession(
    {
      startTime: "17:00",
      endTime: `${String(17 + hours).padStart(2, "0")}:00`,
      courtCount,
      playersPerCourt: cap,
    },
    names,
    NOW,
    ids,
    rng,
  );
  const endsAt: Record<string, number> = {};
  let now = NOW;
  const pending = [...arrivals];

  while (now < s.endsAt) {
    for (const court of s.courts) {
      if (court.startedAt === null && court.playerIds.length === cap) {
        s = startGame(s, court.id, now);
        endsAt[court.id] = now + (9 + rng() * 12) * MIN;
      }
    }
    const next = s.courts
      .filter((c) => c.startedAt !== null)
      .sort((a, b) => endsAt[a.id] - endsAt[b.id])[0];
    const arrival = pending[0];
    const arrivalAt = arrival ? NOW + arrival.atMinute * MIN : Infinity;
    if (arrivalAt < endsAt[next.id]) {
      now = arrivalAt;
      s = addPlayers(s, arrival.names, now, ids, rng);
      pending.shift();
      continue;
    }
    now = endsAt[next.id];
    if (now >= s.endsAt) break;
    s = finishGame(s, next.id, now, rng);
  }
  // Games still going at the end time get played out; count them too.
  for (const court of s.courts) {
    if (court.startedAt !== null) {
      s = finishGame(s, court.id, endsAt[court.id], rng);
    }
  }
  return s;
}

function gamesByName(s: QueueState) {
  return Object.fromEntries(
    Object.values(s.players).map((p) => [p.name, p.gamesPlayed]),
  );
}

function spread(counts: number[]) {
  return Math.max(...counts) - Math.min(...counts);
}

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

/** Worst game gap among the given players across every seeded session. */
function worstSpread(
  options: Omit<Parameters<typeof simulate>[0], "seed">,
  players: string[] = options.names,
) {
  return Math.max(
    ...SEEDS.map((seed) => {
      const games = gamesByName(simulate({ ...options, seed }));
      return spread(players.map((n) => games[n]));
    }),
  );
}

/**
 * Whole sessions with random game lengths. Bounds are worst cases over 100
 * runs. A gap of 1 is the best possible when games don't divide evenly;
 * busy sessions (few players waiting) can drift a bit more, because only
 * the finishers of a court and the people waiting are free to rotate.
 */
describe("fairness over a whole session", () => {
  it("28 players, 3 courts: everyone within 1 game", () => {
    expect(
      worstSpread({ names: REGULARS, courtCount: 3, hours: 3 }),
    ).toBeLessThanOrEqual(1);
  });

  it("9 players, 1 court: everyone within 1 game", () => {
    expect(
      worstSpread({
        names: REGULARS.slice(0, 9),
        courtCount: 1,
        hours: 2,
      }),
    ).toBeLessThanOrEqual(1);
  });

  it("13 players, 2 courts: everyone within 2 games", () => {
    expect(
      worstSpread({
        names: REGULARS.slice(0, 13),
        courtCount: 2,
        hours: 2,
      }),
    ).toBeLessThanOrEqual(2);
  });

  it("singles, 7 players on 2 courts: everyone within 2 games", () => {
    expect(
      worstSpread({
        names: REGULARS.slice(0, 7),
        courtCount: 2,
        hours: 2,
        cap: 2,
      }),
    ).toBeLessThanOrEqual(2);
  });

  it("busy: 17 players on 4 courts (1 waiting) stays within 3 games", () => {
    expect(
      worstSpread({
        names: REGULARS.slice(0, 17),
        courtCount: 4,
        hours: 3,
      }),
    ).toBeLessThanOrEqual(3);
  });

  it("late arrivals catch up to within 2 games of on-time players", () => {
    const onTime = REGULARS.slice(0, 20);
    const late = ["late1", "late2", "late3"];
    for (const seed of SEEDS) {
      const games = gamesByName(
        simulate({
          names: onTime,
          courtCount: 3,
          hours: 3,
          seed,
          arrivals: [{ atMinute: 60, names: late }],
        }),
      );
      const fewestOnTime = Math.min(...onTime.map((n) => games[n]));
      const fewestLate = Math.min(...late.map((n) => games[n]));
      expect(fewestOnTime - fewestLate).toBeLessThanOrEqual(2);
      expect(spread(onTime.map((n) => games[n]))).toBeLessThanOrEqual(2);
    }
  });
});
