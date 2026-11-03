import { describe, expect, it } from "vitest";
import { createSession, extendSession, pauseGame, startGame } from "./engine";
import {
  averageGameMs,
  DEFAULT_GAME_MS,
  forecast,
  gamesLeft,
} from "./forecast";
import type { Match, SessionConfig } from "./schema";

const MIN = 60_000;
const NOW = new Date(2026, 9, 23, 18, 0).getTime();
const zero = () => 0;
const letters = "ABCDEFGHIJKLMNOPQRSTUVWX".split("");

function session(count: number, overrides: Partial<SessionConfig> = {}) {
  let n = 0;
  return createSession(
    {
      startTime: "18:00",
      endTime: "19:00",
      courtCount: 1,
      playersPerCourt: 4,
      ...overrides,
    },
    letters.slice(0, count),
    NOW,
    () => `id${++n}`,
    zero,
  );
}

function game(minutes: number): Match {
  return {
    courtLabel: "Court 1",
    playerIds: [],
    playerNames: [],
    startedAt: 0,
    endedAt: minutes * MIN,
  };
}

describe("averageGameMs", () => {
  it("uses a default until games finish, then the real average", () => {
    expect(averageGameMs([])).toBe(DEFAULT_GAME_MS);
    expect(averageGameMs([game(10), game(20)])).toBe(15 * MIN);
    expect(averageGameMs([game(0)])).toBe(MIN);
  });
});

describe("forecast", () => {
  it("estimates waits group by group as courts free up", () => {
    // 1 court, 12 players: 4 seated, groups of 4 wait 15 and 30 minutes.
    const f = forecast(session(12), NOW);
    expect(f.gameMs).toBe(DEFAULT_GAME_MS);
    expect(f.startsIn.id5).toBe(15 * MIN);
    expect(f.startsIn.id9).toBe(30 * MIN);
    expect(f.atRisk).toEqual([]);
  });

  it("accounts for time already played and paused games", () => {
    const playing = startGame(session(8), "id9", NOW);
    expect(forecast(playing, NOW + 10 * MIN).startsIn.id5).toBe(5 * MIN);
    // A game running past the average could end any moment.
    expect(forecast(playing, NOW + 20 * MIN).startsIn.id5).toBe(0);
    const paused = pauseGame(playing, "id9", NOW + 6 * MIN);
    expect(forecast(paused, NOW + 6 * MIN).startsIn.id5).toBe(9 * MIN);
  });

  it("flags players who likely won't start before the end", () => {
    // 1 hour, 1 court, 20 players: the 5th group would start at 60 min.
    const s = session(20);
    const f = forecast(s, NOW);
    expect(f.startsIn.id17).toBe(60 * MIN);
    expect(f.atRisk).toEqual(["id17", "id18", "id19", "id20"]);
    // More time clears the warning.
    expect(forecast(extendSession(s, 30), NOW).atRisk).toEqual([]);
  });

  it("covers players still short of a full group, and open courts", () => {
    const f = forecast(session(6, { courtCount: 2 }), NOW);
    expect(f.startsIn.id5).toBe(0);
  });

  it("stops warning once the session is over", () => {
    expect(forecast(session(20), NOW + 2 * 60 * MIN).atRisk).toEqual([]);
  });
});

describe("gamesLeft", () => {
  it("fits average games on each court until the end", () => {
    // One court, 60 minutes, 15-minute games: 4 more, 2 each for 8 players.
    expect(gamesLeft(session(8), NOW)).toEqual({ games: 4, each: 2 });
  });

  it("counts the game on court, then what fits after it", () => {
    const playing = startGame(session(8), "id9", NOW);
    expect(gamesLeft(playing, NOW + 5 * MIN)).toEqual({ games: 4, each: 2 });
    const paused = pauseGame(playing, "id9", NOW + 6 * MIN);
    expect(gamesLeft(paused, NOW + 6 * MIN)).toEqual({ games: 4, each: 2 });
  });

  it("rounds each player's share down to a tenth", () => {
    // 4 games × 4 seats over 12 players: 1.33… → 1.3.
    expect(gamesLeft(session(12), NOW).each).toBe(1.3);
  });

  it("is zero once time is up or with no one playing", () => {
    expect(gamesLeft(session(8), NOW + 2 * 60 * MIN)).toEqual({
      games: 0,
      each: 0,
    });
    expect(gamesLeft({ ...session(8), players: {} }, NOW).each).toBe(0);
  });
});
