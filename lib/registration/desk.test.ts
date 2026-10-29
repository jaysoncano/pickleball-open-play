import { describe, expect, it } from "vitest";
import type { DayMember, DayPair, PendingPair } from "@/lib/db/queries";
import {
  deskRows,
  filterCounts,
  filterRows,
  randomPartner,
  rowMembers,
  shufflePairs,
  splitName,
} from "./desk";

const member = (name: string, fullName = ""): DayMember => ({
  playerId: `id-${name}`,
  name,
  fullName,
  level: "beginner",
  photoUpdatedAt: null,
  requestedLevel: null,
  checkedIn: false,
});
const at = new Date("2026-10-30T10:00:00Z");
const paid = (id: string, names: string[], notes = ""): DayPair => ({
  id,
  amountCents: 30000,
  method: "cash",
  notes,
  createdAt: at,
  members: names.map((n) => member(n)),
});
const pending = (id: string, names: string[], notes = ""): PendingPair => ({
  id,
  requestedLevel: null,
  notes,
  createdAt: at,
  members: names.map((n) => member(n)),
});

const day = {
  pairs: [paid("p1", ["Ana", "Ben"], "own paddles"), paid("p2", ["Cy", "Di"])],
  pending: [pending("u1", ["Eve", "Fay"], "pays at 7")],
  solos: [member("Gus", "Gus Tan")],
};

describe("deskRows", () => {
  it("lists unpaid pairs, then paid pairs, then solos", () => {
    expect(deskRows(day).map((r) => [r.kind, r.id])).toEqual([
      ["unpaid", "u1"],
      ["paid", "p1"],
      ["paid", "p2"],
      ["solo", "id-Gus"],
    ]);
  });

  it("gives each row its people", () => {
    const rows = deskRows(day);
    expect(rowMembers(rows[0]).map((m) => m.name)).toEqual(["Eve", "Fay"]);
    expect(rowMembers(rows[3]).map((m) => m.name)).toEqual(["Gus"]);
  });
});

describe("filterCounts", () => {
  it("counts rows per filter", () => {
    expect(filterCounts(deskRows(day))).toEqual({
      all: 4,
      paid: 2,
      unpaid: 1,
      notes: 2,
      solo: 1,
    });
  });

  it("doesn't count blank notes", () => {
    const rows = deskRows({
      ...day,
      pairs: [paid("p3", ["Hal", "Ivy"], "  ")],
    });
    expect(filterCounts(rows).notes).toBe(1);
  });
});

describe("filterRows", () => {
  const rows = deskRows(day);
  const ids = (filter: Parameters<typeof filterRows>[1], q = "") =>
    filterRows(rows, filter, q).map((r) => r.id);

  it("keeps the rows a filter picks", () => {
    expect(ids("all")).toEqual(["u1", "p1", "p2", "id-Gus"]);
    expect(ids("paid")).toEqual(["p1", "p2"]);
    expect(ids("unpaid")).toEqual(["u1"]);
    expect(ids("notes")).toEqual(["u1", "p1"]);
    expect(ids("solo")).toEqual(["id-Gus"]);
  });

  it("searches names, full names, and notes", () => {
    expect(ids("all", "ben")).toEqual(["p1"]);
    expect(ids("all", "tan")).toEqual(["id-Gus"]);
    expect(ids("all", "paddles")).toEqual(["p1"]);
    expect(ids("paid", "eve")).toEqual([]);
    expect(ids("all", "  ")).toEqual(["u1", "p1", "p2", "id-Gus"]);
  });
});

describe("splitName", () => {
  it.each([
    ["Ana Maria Cruz", "Ana Maria", "Cruz"],
    ["  Ben   Uy ", "Ben", "Uy"],
    ["Kim", "Kim", ""],
    ["", "", ""],
  ])("%j → %j %j", (name, firstName, lastName) => {
    expect(splitName(name)).toEqual({ firstName, lastName });
  });
});

describe("randomPartner", () => {
  const solos = [member("Gus"), member("Hal"), member("Ivy")];

  it("picks one of the other solos", () => {
    expect(randomPartner(solos, "id-Gus", () => 0)?.name).toBe("Hal");
    expect(randomPartner(solos, "id-Gus", () => 0.99)?.name).toBe("Ivy");
    expect(randomPartner(solos, "id-Hal", () => 0.5)?.name).toBe("Ivy");
    // Never past the end, even at 1.
    expect(randomPartner(solos, "id-Gus", () => 1)?.name).toBe("Ivy");
  });

  it("has no one when they're the only solo", () => {
    expect(randomPartner([member("Gus")], "id-Gus", () => 0)).toBeNull();
  });
});

describe("shufflePairs", () => {
  it("pairs everyone two by two, keeping each player once", () => {
    const { pairs, left } = shufflePairs(["a", "b", "c", "d"], Math.random);
    expect(pairs).toHaveLength(2);
    expect(pairs.flat().sort()).toEqual(["a", "b", "c", "d"]);
    expect(left).toBeNull();
  });

  it("shuffles with the rng it's given", () => {
    // rng 0 swaps each card with the first: [a,b,c,d] → [b,c,d,a].
    expect(shufflePairs(["a", "b", "c", "d"], () => 0).pairs).toEqual([
      ["b", "c"],
      ["d", "a"],
    ]);
    // Never past the end, even at 1: no swaps.
    expect(shufflePairs(["a", "b"], () => 1).pairs).toEqual([["a", "b"]]);
  });

  it("leaves one waiting when the count is odd, and none for no one", () => {
    const odd = shufflePairs(["a", "b", "c"], () => 0.5);
    expect(odd.pairs).toHaveLength(1);
    expect(odd.left).not.toBeNull();
    expect(shufflePairs([], Math.random)).toEqual({ pairs: [], left: null });
  });
});
