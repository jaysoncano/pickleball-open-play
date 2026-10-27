import { describe, expect, it } from "vitest";
import { createSession, finishGame, removePlayer, startGame } from "./engine";
import {
  courtNumber,
  courtSummary,
  playerStats,
  historySummary,
  matchMinutes,
  matchSides,
  matchup,
} from "./history";
import type { Match } from "./schema";

const MIN = 60_000;
const zero = () => 0;

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

function game(
  names: string[],
  minutes: number,
  endedAt = 0,
  courtLabel = "Court 2",
): Match {
  return {
    courtLabel,
    playerIds: names.map((n) => `id-${n}`),
    playerNames: names,
    startedAt: endedAt - minutes * MIN,
    endedAt,
  };
}

describe("match history", () => {
  it("splits doubles and singles into sides", () => {
    expect(matchSides(game(["A", "B", "C", "D"], 10))).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(matchup(game(["A", "B", "C", "D"], 10))).toBe("A & B vs C & D");
    expect(matchup(game(["A", "B"], 10))).toBe("A vs B");
  });

  it("rounds minutes and never shows zero", () => {
    expect(matchMinutes(game(["A", "B"], 12.4))).toBe(12);
    expect(matchMinutes(game(["A", "B"], 0.1))).toBe(1);
  });

  it("reads court numbers from labels", () => {
    expect(courtNumber("Court 12")).toBe(12);
    expect(courtNumber("Center court")).toBe(1);
  });

  it("lists newest first with an average length", () => {
    const first = game(["A", "B"], 10, 1 * MIN);
    const second = game(["C", "D"], 21, 2 * MIN);
    expect(historySummary([first, second])).toEqual({
      recent: [second, first],
      averageMinutes: 16,
    });
    expect(historySummary([])).toEqual({ recent: [], averageMinutes: 0 });
  });
});

describe("courtSummary", () => {
  it("totals games and minutes per court, in court order", () => {
    expect(
      courtSummary([
        game(["A", "B"], 10, 1 * MIN, "Court 10"),
        game(["C", "D"], 20, 2 * MIN, "Court 2"),
        game(["A", "C"], 15, 3 * MIN, "Court 10"),
      ]),
    ).toEqual([
      { courtLabel: "Court 2", games: 1, minutes: 20 },
      { courtLabel: "Court 10", games: 2, minutes: 25 },
    ]);
    expect(courtSummary([])).toEqual([]);
  });
});

describe("playerStats", () => {
  function played() {
    let s = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      ["Cy", "Ana", "Ben", "Dee"],
      0,
      ids(),
      zero,
    );
    // Cy & Ana play 10 minutes; then Ben & Dee are seated and Cy leaves.
    s = finishGame(startGame(s, "id5", 0), "id5", 10 * MIN, zero);
    s = startGame(s, "id5", 11 * MIN);
    return removePlayer(s, "id1", zero);
  }

  it("counts games and minutes, and keeps players who left", () => {
    expect(playerStats(played())).toEqual([
      {
        id: "id2",
        name: "Ana",
        games: 1,
        minutes: 10,
        status: "waiting",
        played: [{ courtLabel: "Court 1", minutes: 10, endedAt: 10 * MIN }],
      },
      {
        id: "id1",
        name: "Cy",
        games: 1,
        minutes: 10,
        status: "left",
        played: [{ courtLabel: "Court 1", minutes: 10, endedAt: 10 * MIN }],
      },
      {
        id: "id3",
        name: "Ben",
        games: 0,
        minutes: 0,
        status: "playing",
        played: [],
      },
      {
        id: "id4",
        name: "Dee",
        games: 0,
        minutes: 0,
        status: "playing",
        played: [],
      },
    ]);
  });

  it("lists each player's games newest first", () => {
    let s = played();
    s = finishGame(s, "id5", 25 * MIN, zero);
    expect(
      playerStats(s, "name").find((r) => r.name === "Ben")?.played,
    ).toEqual([{ courtLabel: "Court 1", minutes: 14, endedAt: 25 * MIN }]);
    s = finishGame(startGame(s, "id5", 26 * MIN), "id5", 30 * MIN, zero);
    const ana = playerStats(s).find((r) => r.name === "Ana");
    expect(ana?.played.map((g) => g.endedAt)).toEqual([30 * MIN, 10 * MIN]);
    expect(ana?.minutes).toBe(14);
  });

  it("sorts by fewest games or by name", () => {
    const s = played();
    expect(playerStats(s, "fewest").map((r) => r.name)).toEqual([
      "Ben",
      "Dee",
      "Ana",
      "Cy",
    ]);
    expect(playerStats(s, "name").map((r) => r.name)).toEqual([
      "Ana",
      "Ben",
      "Cy",
      "Dee",
    ]);
  });

  it("marks seated players on a court that hasn't started as ready", () => {
    const s = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      ["Ana", "Ben"],
      0,
      ids(),
      zero,
    );
    expect(playerStats(s).map((r) => r.status)).toEqual(["ready", "ready"]);
  });
});
