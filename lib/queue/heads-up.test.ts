import { describe, expect, it } from "vitest";
import { createSession, pauseGame, startGame } from "./engine";
import { startWarning, unpaidOnCourtAlerts } from "./heads-up";
import type { QueueState } from "./schema";

const MIN = 60_000;
const NOW = new Date(2026, 9, 23, 18, 0).getTime();
const zero = () => 0;

/** One court of two (pair vs pair), 18:00–19:00: A and B seated, C waits. */
function session(): QueueState {
  let n = 0;
  return createSession(
    { startTime: "18:00", endTime: "19:00", courtCount: 1, playersPerCourt: 2 },
    ["A", "B", "C"],
    NOW,
    () => `id${++n}`,
    zero,
  );
}

const court = (s: QueueState) => s.courts[0];

function withGames(s: QueueState, games: Record<string, number>): QueueState {
  const players = { ...s.players };
  for (const [id, gamesPlayed] of Object.entries(games)) {
    players[id] = { ...players[id], gamesPlayed };
  }
  return { ...s, players };
}

describe("unpaidOnCourtAlerts", () => {
  it("warns about unpaid pairs once their game is running", () => {
    const s = session();
    const [a, b] = court(s).playerIds;
    expect(unpaidOnCourtAlerts(s, new Set([a]))).toEqual([]);
    const live = startGame(s, court(s).id, NOW);
    expect(unpaidOnCourtAlerts(live, new Set([a]))).toEqual([
      {
        key: `unpaid:${court(s).id}:${NOW}:${a}`,
        courtId: court(s).id,
        courtLabel: "Court 1",
        pairId: a,
        pairName: live.players[a].name,
      },
    ]);
    expect(unpaidOnCourtAlerts(live, new Set([b]))[0].pairId).toBe(b);
  });

  it("keeps warning while the game is paused", () => {
    const s = session();
    const [a] = court(s).playerIds;
    const paused = pauseGame(startGame(s, court(s).id, NOW), court(s).id, NOW);
    expect(unpaidOnCourtAlerts(paused, new Set([a]))).toHaveLength(1);
  });

  it("is quiet when everyone on court has paid", () => {
    const s = startGame(session(), court(session()).id, NOW);
    expect(unpaidOnCourtAlerts(s, new Set(["someone-else"]))).toEqual([]);
  });
});

describe("startWarning", () => {
  it("is quiet with time for a typical game", () => {
    const s = session();
    expect(startWarning(s, court(s).id, NOW)).toBeNull();
  });

  it("warns when the session ends before a typical game would", () => {
    const s = session();
    expect(startWarning(s, court(s).id, NOW + 50 * MIN)).toEqual({
      minutesLeft: 10,
      gameMinutes: 15,
      behind: [],
    });
    expect(startWarning(s, court(s).id, NOW + 70 * MIN)?.minutesLeft).toBe(0);
  });

  it("names waiting players with fewer games than the court", () => {
    const s = session();
    const [a, b] = court(s).playerIds;
    const ahead = withGames(s, { [a]: 2, [b]: 1 });
    const waiting = ahead.queue[0];
    expect(startWarning(ahead, court(s).id, NOW + 55 * MIN)?.behind).toEqual([
      ahead.players[waiting].name,
    ]);
  });

  it("ignores unknown or empty courts", () => {
    const s = session();
    expect(startWarning(s, "nope", NOW + 55 * MIN)).toBeNull();
    const empty = {
      ...s,
      courts: [{ ...court(s), playerIds: [] }],
    };
    expect(startWarning(empty, court(s).id, NOW + 55 * MIN)).toBeNull();
  });
});
