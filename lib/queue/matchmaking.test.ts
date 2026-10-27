import { describe, expect, it } from "vitest";
import {
  arrangeTeams,
  combinations,
  emptyHistory,
  groupRepeats,
  pairKey,
  planQueue,
  recordGame,
  shuffle,
  timesMet,
} from "./matchmaking";

const zero = () => 0;

/** Cycles through fixed values to drive tie-breaks. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("pair history", () => {
  it("keys pairs regardless of order", () => {
    expect(pairKey("b", "a")).toBe("a|b");
    expect(pairKey("a", "b")).toBe("a|b");
  });

  it("records teammates and opponents for doubles", () => {
    const h = recordGame(emptyHistory(), ["a", "b", "c", "d"]);
    expect(h.teammates).toEqual({ "a|b": 1, "c|d": 1 });
    expect(h.opponents).toEqual({ "a|c": 1, "a|d": 1, "b|c": 1, "b|d": 1 });
    expect(timesMet(h, "b", "a")).toBe(1);
    expect(timesMet(h, "a", "z")).toBe(0);
  });

  it("records singles as opponents only, without mutating input", () => {
    const start = emptyHistory();
    const h = recordGame(recordGame(start, ["a", "b"]), ["b", "a"]);
    expect(h).toEqual({ teammates: {}, opponents: { "a|b": 2 } });
    expect(start).toEqual(emptyHistory());
  });

  it("counts repeats within a group", () => {
    const h = recordGame(emptyHistory(), ["a", "b", "c", "d"]);
    expect(groupRepeats(h, ["a", "b", "e", "f"])).toBe(1);
    expect(groupRepeats(h, ["a", "b", "c", "d"])).toBe(6);
    expect(groupRepeats(h, ["e", "f"])).toBe(0);
  });
});

describe("helpers", () => {
  it("lists combinations", () => {
    expect(combinations([1, 2, 3], 2)).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
    expect(combinations([1, 2], 0)).toEqual([[]]);
    expect(combinations([1], 2)).toEqual([]);
  });

  it("shuffles without losing anyone", () => {
    expect(shuffle(["a", "b", "c", "d"], zero)).toEqual(["b", "c", "d", "a"]);
    const mixed = shuffle(["a", "b", "c", "d"], Math.random);
    expect([...mixed].sort()).toEqual(["a", "b", "c", "d"]);
  });
});

describe("planQueue", () => {
  it("keeps line order when nobody has met", () => {
    expect(
      planQueue(["a", "b", "c", "d", "e"], 4, emptyHistory(), zero),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("breaks up players who just played together", () => {
    // a–d just played; e–h are fresh. Two of a–d per group is the best
    // possible split: one unavoidable repeat in each.
    const h = recordGame(emptyHistory(), ["a", "b", "c", "d"]);
    const plan = planQueue(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      4,
      h,
      zero,
    );
    const first = plan.slice(0, 4);
    const second = plan.slice(4);
    expect(first[0]).toBe("a");
    expect(groupRepeats(h, first)).toBe(1);
    expect(groupRepeats(h, second)).toBe(1);
  });

  it("always includes the longest-waiting player", () => {
    const h = recordGame(emptyHistory(), ["a", "b", "c", "d"]);
    const plan = planQueue(["b", "a", "c", "d", "e"], 4, h, zero);
    expect(plan[0]).toBe("b");
  });

  it("only looks a short way down the line", () => {
    const h = recordGame(emptyHistory(), ["a", "b"]);
    // Singles: window is the next 3 behind "a". "z" is too far back.
    const plan = planQueue(["a", "b", "c", "d", "z"], 2, h, zero);
    expect(plan.slice(0, 2)).toEqual(["a", "c"]);
  });

  it("keeps line order when nothing else differs", () => {
    const plan = planQueue(
      ["a", "b", "c", "d", "e", "f"],
      2,
      emptyHistory(),
      sequence(0.9, 0.1, 0.9),
    );
    expect(plan).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("puts players with fewer games first, keeping line order on ties", () => {
    const games = { a: 2, b: 1, c: 2, d: 0, e: 1 };
    const plan = planQueue(
      ["a", "b", "c", "d", "e"],
      2,
      emptyHistory(),
      zero,
      games,
    );
    expect(plan).toEqual(["d", "b", "e", "a", "c"]);
  });

  it("values balanced games over avoiding a rematch", () => {
    // a and b just played each other, but c already has 2 more games.
    const h = recordGame(emptyHistory(), ["a", "b"]);
    const plan = planQueue(["a", "b", "c"], 2, h, zero, { c: 2 });
    expect(plan.slice(0, 2)).toEqual(["a", "b"]);
  });
});

describe("arrangeTeams", () => {
  it("avoids repeat partners", () => {
    const h = recordGame(emptyHistory(), ["a", "b", "x", "y"]);
    expect(arrangeTeams(["a", "b", "c", "d"], h, zero)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("then avoids repeat opponents", () => {
    let h = emptyHistory();
    h = recordGame(h, ["a", "x", "c", "y"]);
    h = recordGame(h, ["b", "x", "d", "y"]);
    // a met c and b met d as opponents, so team them up.
    expect(arrangeTeams(["a", "b", "c", "d"], h, zero)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("breaks exact ties at random", () => {
    // Nobody has met: all three splits tie, so the random draw decides.
    expect(
      arrangeTeams(
        ["a", "b", "c", "d"],
        emptyHistory(),
        sequence(0.9, 0.1, 0.9),
      ),
    ).toEqual(["a", "c", "b", "d"]);
  });

  it("leaves singles and partial groups alone", () => {
    expect(arrangeTeams(["a", "b"], emptyHistory(), zero)).toEqual(["a", "b"]);
  });
});
