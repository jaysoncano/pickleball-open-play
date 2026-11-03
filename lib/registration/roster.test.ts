import { describe, expect, it } from "vitest";
import { createSession, startGame } from "@/lib/queue/engine";
import {
  filterRoster,
  isHere,
  placeOf,
  rosterCounts,
  skillsOnCourt,
  type RosterPair,
} from "./roster";

const pair = (
  id: string,
  names: [string, string],
  over: Partial<RosterPair> = {},
  here = true,
): RosterPair => ({
  id,
  name: names.join(" & "),
  paid: true,
  blocked: null,
  members: names.map((name) => ({ name, checkedIn: here })),
  ...over,
});

const roster = [
  pair("p1", ["Ana", "Ben"]),
  pair("p2", ["Cy", "Dee"], { paid: false }, false),
  pair("p3", ["Eve", "Fin"], { blocked: "Eve is Pro" }),
  {
    ...pair("p4", ["Gus", "Hal"]),
    members: [
      { name: "Gus", checkedIn: true },
      { name: "Hal", checkedIn: false },
    ],
  },
];

describe("isHere", () => {
  it("needs both players checked in", () => {
    expect(isHere(roster[0])).toBe(true);
    expect(isHere(roster[3])).toBe(false);
  });
});

describe("rosterCounts", () => {
  it("counts each filter", () => {
    expect(rosterCounts(roster)).toEqual({
      all: 4,
      away: 2,
      here: 2,
      unpaid: 1,
      blocked: 1,
    });
  });
});

describe("filterRoster", () => {
  it("lists pairs not checked in first, then by name", () => {
    expect(filterRoster(roster, "all", "").map((p) => p.id)).toEqual([
      "p2",
      "p4",
      "p1",
      "p3",
    ]);
  });

  it("filters by status", () => {
    expect(filterRoster(roster, "away", "").map((p) => p.id)).toEqual([
      "p2",
      "p4",
    ]);
    expect(filterRoster(roster, "here", "").map((p) => p.id)).toEqual([
      "p1",
      "p3",
    ]);
    expect(filterRoster(roster, "unpaid", "").map((p) => p.id)).toEqual(["p2"]);
    expect(filterRoster(roster, "blocked", "").map((p) => p.id)).toEqual([
      "p3",
    ]);
  });

  it("searches pair and player names, any case", () => {
    expect(filterRoster(roster, "all", "  DEE ").map((p) => p.id)).toEqual([
      "p2",
    ]);
    expect(filterRoster(roster, "all", "ana & b").map((p) => p.id)).toEqual([
      "p1",
    ]);
    expect(filterRoster(roster, "here", "cy")).toEqual([]);
  });
});

describe("placeOf", () => {
  const session = () => {
    let n = 0;
    return createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      [
        { id: "u1", name: "A" },
        { id: "u2", name: "B" },
        { id: "u3", name: "C" },
      ],
      0,
      () => `id${++n}`,
      () => 0,
    );
  };

  it("finds a pair on court, in the queue, or out", () => {
    const s = session();
    const court = s.courts[0];
    const seated = court.playerIds[0];
    expect(placeOf(s, seated)).toEqual({
      kind: "court",
      label: court.label,
      playing: false,
    });
    const started = startGame(s, court.id, 0);
    expect(placeOf(started, seated)).toMatchObject({ playing: true });
    expect(placeOf(s, s.queue[0])).toEqual({ kind: "queue", position: 1 });
    expect(placeOf(s, "nobody")).toEqual({ kind: "out" });
  });
});

describe("skillsOnCourt", () => {
  it("lists the ranks on court once each, lowest first", () => {
    let n = 0;
    const s = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 2,
        playersPerCourt: 2,
      },
      [
        { id: "u1", name: "A", skill: 3 },
        { id: "u2", name: "B", skill: 1 },
        { id: "u3", name: "C", skill: 3 },
        { id: "u4", name: "D" },
        { id: "u5", name: "E", skill: 0 },
      ],
      0,
      () => `id${++n}`,
      () => 0,
    );
    const seated = s.courts.flatMap((c) => c.playerIds);
    const expected = [
      ...new Set(
        seated
          .map((id) => s.players[id].skill)
          .filter((k): k is number => k !== undefined),
      ),
    ].sort((a, b) => a - b);
    expect(skillsOnCourt(s)).toEqual(expected);
    expect(skillsOnCourt({ ...s, courts: [] })).toEqual([]);
  });
});
