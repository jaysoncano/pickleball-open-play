import { describe, expect, it } from "vitest";
import {
  gamePoints,
  POINTS,
  predictionStatus,
  standings,
  topStandings,
  type StandingUnit,
  type UnitGame,
} from "./standings";

const unit = (id: string, skill?: number): StandingUnit => ({
  id,
  name: id.toUpperCase(),
  skill,
});
let n = 0;
const game = (a: string, b: string, scoreA: number, scoreB: number) =>
  ({
    id: `g${++n}`,
    sideA: [a],
    sideB: [b],
    scoreA,
    scoreB,
  }) satisfies UnitGame;

describe("gamePoints", () => {
  it("adds the result and the margin", () => {
    expect(gamePoints({ pointsFor: 11, pointsAgainst: 0 })).toBe(
      POINTS.win + POINTS.margin,
    );
    expect(gamePoints({ pointsFor: 0, pointsAgainst: 11 })).toBe(
      -POINTS.margin,
    );
    expect(gamePoints({ pointsFor: 11, pointsAgainst: 9 })).toBeCloseTo(
      3 + 2 / 11,
    );
  });

  it("caps the margin at a full game", () => {
    expect(gamePoints({ pointsFor: 21, pointsAgainst: 0 })).toBe(
      POINTS.win + POINTS.margin,
    );
  });

  it("rewards beating a stronger pair and punishes losing to a weaker one", () => {
    const even = gamePoints({ pointsFor: 11, pointsAgainst: 9 }, 1, 1);
    expect(gamePoints({ pointsFor: 11, pointsAgainst: 9 }, 1, 3)).toBe(
      even + 2 * POINTS.perRank,
    );
    // Beating a weaker pair is no bonus; losing to a stronger one no penalty.
    expect(gamePoints({ pointsFor: 11, pointsAgainst: 9 }, 3, 1)).toBe(even);
    const loss = gamePoints({ pointsFor: 9, pointsAgainst: 11 }, 1, 1);
    expect(gamePoints({ pointsFor: 9, pointsAgainst: 11 }, 1, 3)).toBe(loss);
    expect(gamePoints({ pointsFor: 9, pointsAgainst: 11 }, 3, 2)).toBe(
      loss - POINTS.perRank,
    );
  });
});

describe("standings", () => {
  it("ranks by points, so margins count, not just wins", () => {
    const rows = standings(
      [unit("a"), unit("b"), unit("c"), unit("d")],
      [game("a", "b", 11, 0), game("c", "d", 11, 9)],
    );
    expect(rows.map((r) => [r.id, r.rank, r.wins, r.losses])).toEqual([
      ["a", 1, 1, 0],
      ["c", 2, 1, 0],
      ["d", 3, 0, 1],
      ["b", 4, 0, 1],
    ]);
    expect(rows[0]).toMatchObject({
      name: "A",
      games: 1,
      pointsFor: 11,
      pointsAgainst: 0,
      pointDiff: 11,
      points: 4,
    });
  });

  it("doesn't let one lucky game beat a steady record", () => {
    const rows = standings(
      [unit("lucky"), unit("steady"), unit("x"), unit("y")],
      [
        game("lucky", "x", 11, 0),
        game("steady", "x", 11, 2),
        game("steady", "y", 11, 3),
        game("steady", "x", 11, 1),
        game("y", "x", 11, 5),
      ],
    );
    expect(rows[0].id).toBe("steady");
    expect(rows[1].id).toBe("lucky");
    expect(rows[1].rating).toBeLessThan(rows[1].points);
  });

  it("counts every unit on a side and the opponents' rank", () => {
    const rows = standings(
      [unit("a", 1), unit("b", 1), unit("c", 2), unit("d", 2)],
      [
        {
          id: "g",
          sideA: ["a", "b"],
          sideB: ["c", "d"],
          scoreA: 11,
          scoreB: 9,
        },
      ],
    );
    const a = rows.find((r) => r.id === "a")!;
    expect(a.points).toBe(
      Math.round((3 + 2 / 11 + POINTS.perRank) * 100) / 100,
    );
    expect(rows.find((r) => r.id === "b")!.points).toBe(a.points);
    expect(a.rank).toBe(rows.find((r) => r.id === "b")!.rank);
  });

  it("keeps units that left, and is empty with no games", () => {
    const rows = standings([unit("a")], [game("a", "gone", 11, 4)]);
    expect(rows.find((r) => r.id === "gone")?.name).toBe("Left the session");
    expect(standings([unit("a")], [])).toEqual([]);
  });

  it("breaks rating ties by name when everything else is equal", () => {
    const rows = standings(
      [unit("b"), unit("a"), unit("c"), unit("d")],
      [game("b", "c", 11, 5), game("a", "d", 11, 5)],
    );
    expect(rows.map((r) => [r.id, r.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", 3],
    ]);
  });
});

describe("predictionStatus", () => {
  it("waits until every unit has a scored game", () => {
    const units = [unit("a"), unit("b"), unit("c")];
    const first = predictionStatus(units, [game("a", "b", 11, 3)]);
    expect(first.ready).toBe(false);
    expect(first.waiting.map((u) => u.id)).toEqual(["c"]);
    expect(
      predictionStatus(units, [game("a", "b", 11, 3), game("c", "a", 11, 8)])
        .ready,
    ).toBe(true);
    expect(predictionStatus([], []).ready).toBe(false);
  });
});

describe("topStandings", () => {
  const units = [unit("a", 1), unit("b", 1), unit("c", 2), unit("d", 2)];
  const rows = standings(units, [
    game("a", "b", 11, 2),
    game("c", "d", 11, 9),
    game("d", "c", 11, 1),
  ]);

  it("cuts to the top count, keeping ties at the cut", () => {
    expect(topStandings(rows, 1).map((r) => r.id)).toEqual(["a"]);
    expect(topStandings(rows, 10)).toHaveLength(4);
    const tied = standings(
      [unit("a"), unit("b"), unit("c"), unit("d")],
      [game("a", "c", 11, 5), game("b", "d", 11, 5)],
    );
    expect(topStandings(tied, 1).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("filters to one rank and renumbers", () => {
    const top = topStandings(rows, 3, 2);
    expect(top.map((r) => [r.id, r.rank])).toEqual([
      ["d", 1],
      ["c", 2],
    ]);
    const tied = standings(
      [unit("a", 0), unit("b", 0), unit("c", 0), unit("d", 0), unit("z", 1)],
      [game("z", "z2", 11, 0), game("a", "c", 11, 5), game("b", "d", 11, 5)],
    );
    expect(topStandings(tied, 1, 0).map((r) => [r.id, r.rank])).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });
});
