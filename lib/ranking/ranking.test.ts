import { describe, expect, it } from "vitest";
import { firstError } from "../queue/schema";
import { ProtestSchema, ResolutionSchema, ScoreSchema } from "./forms";
import { LEVEL_INFO, LEVELS, LevelSchema, levelRank } from "./levels";
import {
  playerGame,
  playerGames,
  playerRecord,
  winner,
  type MatchPlayer,
  type RecordedMatch,
} from "./record";

const MIN = 60_000;

function p(
  id: string,
  side: "A" | "B",
  level: MatchPlayer["level"] = "novice",
): MatchPlayer {
  return { playerId: id, name: id.toUpperCase(), level, side };
}

function match(
  id: string,
  scoreA: number,
  scoreB: number,
  players: MatchPlayer[],
  endedAt = 20 * MIN,
  minutes = 12,
): RecordedMatch {
  return {
    id,
    courtLabel: "Court 1",
    startedAt: endedAt - minutes * MIN,
    endedAt,
    scoreA,
    scoreB,
    players,
  };
}

const doubles = (scoreA: number, scoreB: number, endedAt?: number) =>
  match(
    `m${endedAt ?? 0}`,
    scoreA,
    scoreB,
    [p("ana", "A"), p("ben", "A"), p("cy", "B", "advanced"), p("dee", "B")],
    endedAt,
  );

describe("levels", () => {
  it("orders levels and labels each one", () => {
    expect(levelRank("beginner")).toBe(0);
    expect(levelRank("pro")).toBe(LEVELS.length - 1);
    expect(LEVELS.every((l) => LEVEL_INFO[l].label)).toBe(true);
    expect(firstError(LevelSchema.safeParse("legend"))).toBe("Pick a level");
  });
});

describe("playerGame", () => {
  it("reads a game from side A", () => {
    const g = playerGame("ana", doubles(11, 7))!;
    expect(winner(g.match)).toBe("A");
    expect(g.won).toBe(true);
    expect([g.pointsFor, g.pointsAgainst]).toEqual([11, 7]);
    expect(g.partners.map((x) => x.playerId)).toEqual(["ben"]);
    expect(g.opponents.map((x) => x.playerId)).toEqual(["cy", "dee"]);
    expect(g.opponentLevel).toBe("advanced");
  });

  it("reads a game from side B", () => {
    const g = playerGame("dee", doubles(11, 7))!;
    expect(g.won).toBe(false);
    expect([g.pointsFor, g.pointsAgainst]).toEqual([7, 11]);
    expect(g.opponentLevel).toBe("novice");
  });

  it("ignores games the player wasn't in", () => {
    expect(playerGame("zed", doubles(11, 7))).toBeNull();
  });
});

describe("playerRecord", () => {
  it("totals wins, points, minutes, and results by opponent level", () => {
    const games = playerGames("ana", [
      doubles(11, 7, 20 * MIN),
      doubles(5, 11, 40 * MIN),
      match("singles", 11, 2, [p("ana", "A"), p("eve", "B", "beginner")]),
      match("other", 11, 2, [p("cy", "A"), p("dee", "B")]),
    ]);
    expect(games.map((g) => g.match.id)).toEqual([
      "m2400000",
      "m1200000",
      "singles",
    ]);
    expect(playerRecord(games)).toEqual({
      games: 3,
      wins: 2,
      losses: 1,
      winRate: 67,
      pointDiff: 4 - 6 + 9,
      minutes: 36,
      byOpponentLevel: [
        { level: "beginner", wins: 1, losses: 0 },
        { level: "advanced", wins: 1, losses: 1 },
      ],
    });
  });

  it("is empty with no games", () => {
    expect(playerRecord([])).toEqual({
      games: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      pointDiff: 0,
      minutes: 0,
      byOpponentLevel: [],
    });
  });

  it("counts a very short game as one minute", () => {
    const quick = match("q", 11, 0, [p("ana", "A"), p("ben", "B")], MIN, 0);
    expect(playerRecord(playerGames("ana", [quick])).minutes).toBe(1);
  });
});

describe("forms", () => {
  it("validates scores", () => {
    expect(ScoreSchema.safeParse({ scoreA: 11, scoreB: 9 }).success).toBe(true);
    expect(firstError(ScoreSchema.safeParse({ scoreA: 9, scoreB: 9 }))).toMatch(
      /tied/,
    );
    expect(
      firstError(ScoreSchema.safeParse({ scoreA: -1, scoreB: 9 })),
    ).toMatch(/negative/);
    expect(
      firstError(ScoreSchema.safeParse({ scoreA: 100, scoreB: 9 })),
    ).toMatch(/99/);
    expect(
      firstError(ScoreSchema.safeParse({ scoreA: 1.5, scoreB: 9 })),
    ).toMatch(/whole/);
  });

  it("validates protests", () => {
    const base = {
      playerId: "ana",
      currentLevel: "novice",
      requestedLevel: "intermediate",
      reason: "  I beat intermediate players most nights.  ",
    };
    const ok = ProtestSchema.safeParse(base);
    expect(ok.success && ok.data.reason).toBe(
      "I beat intermediate players most nights.",
    );
    expect(
      firstError(
        ProtestSchema.safeParse({ ...base, requestedLevel: "novice" }),
      ),
    ).toMatch(/different/);
    expect(
      firstError(ProtestSchema.safeParse({ ...base, reason: "pls" })),
    ).toMatch(/why/);
    expect(
      firstError(ProtestSchema.safeParse({ ...base, reason: "x".repeat(501) })),
    ).toMatch(/500/);
  });

  it("defaults the resolution note", () => {
    expect(
      ResolutionSchema.parse({ protestId: "p1", approve: true }).note,
    ).toBe("");
  });
});
