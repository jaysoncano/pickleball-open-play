import { describe, expect, it } from "vitest";
import {
  addCourt,
  createSession,
  finishGame,
  setCourtRank,
  startGame,
  upNext,
} from "./engine";
import { emptyHistory } from "./matchmaking";
import {
  lineOf,
  nextPerLine,
  planByLine,
  queueGroups,
  suggestCourtRanks,
  takeGroup,
  takeOne,
} from "./ranks";

const zero = () => 0;
const NOW = new Date(2026, 9, 27, 17, 0).getTime();
// Beginner pairs b1..b4 (skill 0), novice pairs n1..n4 (skill 1).
const skill = { b1: 0, b2: 0, b3: 0, b4: 0, n1: 1, n2: 1, n3: 1, n4: 1 };

describe("rank lines", () => {
  it("knows each unit's line", () => {
    expect(lineOf(skill, "n1")).toBe(1);
    expect(lineOf(skill, "x")).toBe(-1);
  });

  it("takes a court's game from its own line", () => {
    const queue = ["b1", "n1", "b2", "n2"];
    expect(takeGroup(queue, 2, skill, 1)).toEqual({
      group: ["n1", "n2"],
      rest: ["b1", "b2"],
    });
    // No rank: follow whoever is first.
    expect(takeGroup(queue, 2, skill, null)?.group).toEqual(["b1", "b2"]);
    expect(takeGroup(["b1", "n1"], 2, skill, 0)).toBeNull();
    expect(takeGroup([], 2, skill, 0)).toBeNull();
    expect(takeOne(queue, skill, 1)).toEqual({
      id: "n1",
      rest: ["b1", "b2", "n2"],
    });
    expect(takeOne(["b1"], skill, 1)).toBeNull();
  });

  it("groups the queue into games per line", () => {
    expect(queueGroups(["b1", "n1", "b2", "n2", "b3"], 2, skill)).toEqual({
      groups: [
        ["b1", "b2"],
        ["n1", "n2"],
      ],
      remainder: ["b3"],
    });
    expect(nextPerLine(["b1", "n1", "b2", "b3", "b4", "n2"], 2, skill)).toEqual(
      ["b1", "n1", "b2", "n2"],
    );
  });

  it("plans each line on its own and keeps the slots", () => {
    const plan = planByLine(
      ["b1", "n1", "b2", "n2"],
      2,
      emptyHistory(),
      zero,
      { b1: 1 },
      skill,
    );
    // Beginner slots (0, 2) and novice slots (1, 3) stay put; b2 has
    // fewer games than b1 so goes first in its line.
    expect(plan).toEqual(["b2", "n1", "b1", "n2"]);
    // One line plans like a normal queue.
    expect(planByLine(["a", "b"], 2, emptyHistory(), zero, {}, {})).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("ranked open play in the engine", () => {
  const pairs = [
    { id: "b1", name: "B1", skill: 0 },
    { id: "n1", name: "N1", skill: 1 },
    { id: "b2", name: "B2", skill: 0 },
    { id: "n2", name: "N2", skill: 1 },
    { id: "b3", name: "B3", skill: 0 },
    { id: "n3", name: "N3", skill: 1 },
    { id: "n4", name: "N4", skill: 1 },
  ];
  let n = 0;
  const ids = () => `c${++n}`;
  const session = (courtRanks: (number | null)[]) =>
    createSession(
      {
        startTime: "18:00",
        endTime: "22:00",
        courtCount: courtRanks.length,
        playersPerCourt: 2,
        courtRanks,
      },
      pairs,
      NOW,
      ids,
      zero,
    );

  it("seats each court from its rank and never mixes ranks", () => {
    const s = session([0, 1, 1]);
    expect(s.courts.map((c) => [c.rank, c.playerIds])).toEqual([
      [0, ["b1", "b2"]],
      [1, ["n1", "n2"]],
      [1, ["n3", "n4"]],
    ]);
    expect(s.queue).toEqual(["b3"]);
    expect(upNext(s).next).toEqual([]);
  });

  it("refills a finished court from the same rank", () => {
    let s = session([0, 1]);
    const novice = s.courts[1].id;
    s = finishGame(startGame(s, novice, NOW), novice, NOW + 600_000, zero);
    const court = s.courts[1];
    expect(court.rank).toBe(1);
    expect(court.playerIds.every((id) => id.startsWith("n"))).toBe(true);
    expect(s.queue.some((id) => id.startsWith("n"))).toBe(true);
  });

  it("switches an idle court's rank and gives its group back", () => {
    let s = session([0, 0]);
    // Court 2 holds no game (only one beginner left after court 1).
    expect(s.courts[1].playerIds).toEqual([]);
    s = setCourtRank(s, s.courts[1].id, 1, zero);
    expect(s.courts[1].playerIds).toEqual(["n1", "n2"]);
    // Switching back releases the novices to the front of the line.
    s = setCourtRank(s, s.courts[1].id, 0, zero);
    expect(s.courts[1].playerIds).toEqual([]);
    expect(s.queue.slice(0, 2)).toEqual(["n1", "n2"]);
    expect(setCourtRank(s, "nope", 1)).toBe(s);
    expect(setCourtRank(s, s.courts[1].id, 0)).toBe(s);
  });

  it("lets a game in progress finish before the switch", () => {
    let s = session([0, 1]);
    const court = s.courts[0].id;
    s = startGame(s, court, NOW);
    s = setCourtRank(s, court, 1, zero);
    expect(s.courts[0].playerIds).toEqual(["b1", "b2"]);
    s = finishGame(s, court, NOW + 600_000, zero);
    expect(s.courts[0].playerIds.every((id) => id.startsWith("n"))).toBe(true);
  });

  it("fills a gap from the seated rank, and adds ranked courts", () => {
    let s = session([1]);
    s = addCourt(s, ids, zero, 0);
    expect(s.courts[1]).toMatchObject({ rank: 0, playerIds: ["b1", "b2"] });
  });
});

describe("suggestCourtRanks", () => {
  it("shares courts by how many pairs each rank has", () => {
    // 4 courts, 6 beginner pairs and 10 novice pairs → 2 and 2 → 1.5/2.5 → 2/2
    expect(
      suggestCourtRanks(
        4,
        new Map([
          [0, 6],
          [1, 10],
        ]),
        2,
      ),
    ).toEqual([0, 0, 1, 1]);
    expect(
      suggestCourtRanks(
        4,
        new Map([
          [0, 2],
          [1, 14],
        ]),
        2,
      ),
    ).toEqual([0, 1, 1, 1]);
    expect(suggestCourtRanks(3, new Map([[1, 8]]), 2)).toEqual([1, 1, 1]);
  });

  it("skips ranks that can't fill a court and handles few courts", () => {
    expect(
      suggestCourtRanks(
        2,
        new Map([
          [0, 1],
          [1, 4],
        ]),
        2,
      ),
    ).toEqual([1, 1]);
    expect(
      suggestCourtRanks(
        1,
        new Map([
          [0, 4],
          [1, 4],
        ]),
        2,
      ),
    ).toEqual([0]);
    expect(suggestCourtRanks(2, new Map(), 2)).toEqual([]);
    expect(suggestCourtRanks(0, new Map([[0, 4]]), 2)).toEqual([]);
  });
});
