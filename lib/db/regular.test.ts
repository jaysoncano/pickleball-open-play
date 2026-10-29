import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession } from "@/lib/queue/engine";
import {
  GuestPairSchema,
  GuestSoloSchema,
  UnpaidPairSchema,
} from "@/lib/registration/forms";
import type { OpenPlayInput } from "@/lib/registration/open-play";
import {
  confirmPairPayment,
  createOpenPlay,
  endSession,
  ensurePlayers,
  getLiveSession,
  getOpenPlay,
  getPlayer,
  listClaimTokens,
  listPlayers,
  listRegistrations,
  markPairUnpaid,
  paidPairs,
  registerGuestPair,
  registerGuestSolo,
  pairGuestSolos,
  removeGuestSolo,
  renameGuestSolo,
  soloGuest,
  splitGuestPair,
  registerPair,
  renameGuestPair,
  rosterPairs,
  startSession,
  type Db,
} from "./queries";
import * as schema from "./schema";

let db: Db;
let regular: string;
let ranked: string;

const play = (over: Partial<OpenPlayInput> = {}): OpenPlayInput => ({
  kind: "regular",
  venue: "Sunrise Courts",
  location: "Makati",
  playDate: "2026-10-27",
  startTime: "18:00",
  endTime: "20:00",
  levels: ["novice", "intermediate"],
  maxPairs: null,
  feeCents: 30000,
  ...over,
});

const guest = (names: string, extra: object = {}, openPlayId = regular) =>
  GuestPairSchema.parse({ openPlayId, names, ...extra });

async function ok<T>(p: Promise<T | { error: string }>): Promise<T> {
  const r = await p;
  if (r && typeof r === "object" && "error" in r) throw new Error(r.error);
  return r as T;
}

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  regular = await createOpenPlay(db, play());
  ranked = await createOpenPlay(
    db,
    play({ kind: "ranked", levels: ["beginner", "novice"] }),
  );
});

describe("Regular open plays", () => {
  it("keeps the kind it was scheduled with", async () => {
    expect((await getOpenPlay(db, regular))?.kind).toBe("regular");
    expect((await getOpenPlay(db, ranked))?.kind).toBe("ranked");
  });

  it("adds a pair by name, unpaid until marked paid", async () => {
    const { pairId } = await ok(
      registerGuestPair(db, guest("gel/son", { notes: "late" })),
    );
    const day = await listRegistrations(db, regular);
    expect(day.pending).toEqual([
      expect.objectContaining({
        id: pairId,
        notes: "late",
        members: [
          expect.objectContaining({ name: "gel", level: "novice" }),
          expect.objectContaining({ name: "son", level: "novice" }),
        ],
      }),
    ]);
    // Paid at the booth: the entry fee, cash.
    await ok(
      confirmPairPayment(db, {
        pairId,
        amountCents: 30000,
        method: "cash",
        notes: "",
      }),
    );
    expect((await rosterPairs(db, regular))[0]).toMatchObject({
      name: "gel & son",
      paid: true,
    });
    expect((await listRegistrations(db, regular)).pairs[0].notes).toBe("late");
  });

  it("adds a pair already paid, at the fee", async () => {
    await ok(registerGuestPair(db, guest("gel/son", { paid: true })));
    expect((await listRegistrations(db, regular)).pairs[0]).toMatchObject({
      amountCents: 30000,
      method: "cash",
    });
    expect((await getOpenPlay(db, regular))?.pairCount).toBe(1);
  });

  it("keeps names unique within an open play, not across them", async () => {
    await ok(registerGuestPair(db, guest("gel/son")));
    const taken = { error: "Gel is already in this open play" };
    expect(await registerGuestPair(db, guest("Gel/ivan"))).toEqual(taken);
    expect(
      await registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "Gel" }),
      ),
    ).toEqual(taken);
    // Another open play can have its own Gel, and so can a real player.
    const other = await createOpenPlay(db, play());
    await ok(registerGuestPair(db, guest("gel/son", {}, other)));
    expect(await ensurePlayers(db, ["Gel"])).toEqual([
      expect.objectContaining({ name: "Gel" }),
    ]);
  });

  it("won't rename or split into a name already taken", async () => {
    const { pairId } = await ok(registerGuestPair(db, guest("gel/son")));
    await ok(registerGuestPair(db, guest("ivan/jed")));
    const { playerId } = await ok(
      registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "ivy" }),
      ),
    );
    expect(await renameGuestPair(db, pairId, ["gel", "Ivan"])).toBe(
      "Ivan is already in this open play",
    );
    // Swapping their own names around is fine.
    expect(await renameGuestPair(db, pairId, ["Son", "Gel"])).toBeNull();
    expect(await renameGuestSolo(db, playerId, "JED")).toBe(
      "JED is already in this open play",
    );
    expect(await splitGuestPair(db, pairId, "ivy")).toBe(
      "ivy is already in this open play",
    );
  });

  it("keeps guests out of the directory, profiles, and QR lists", async () => {
    await ok(registerGuestPair(db, guest("gel/son")));
    const [gel] = (await listRegistrations(db, regular)).pending[0].members;
    expect(await listPlayers(db)).toEqual([]);
    expect(await listClaimTokens(db)).toEqual([]);
    expect(await getPlayer(db, gel.playerId)).toBeNull();
  });

  it("turns away a paid pair when full, and Ranked open plays", async () => {
    const small = await createOpenPlay(db, play({ maxPairs: 2 }));
    const paid = { paid: true };
    await ok(registerGuestPair(db, guest("a/b", paid, small)));
    await ok(registerGuestPair(db, guest("c/d", paid, small)));
    expect(await registerGuestPair(db, guest("e/f", paid, small))).toEqual({
      error: "This open play is full",
    });
    // Unpaid still fits: it waits to be marked paid.
    await ok(registerGuestPair(db, guest("e/f", {}, small)));
    expect(await registerGuestPair(db, guest("a/b", {}, ranked))).toEqual({
      error: "Ranked open plays need each player's details",
    });
    expect(
      await registerGuestPair(
        db,
        guest("a/b", {}, "00000000-0000-4000-8000-000000000000"),
      ),
    ).toEqual({ error: "Open play not found" });
  });

  it("refuses email sign-ups, which are for Ranked", async () => {
    const person = (name: string) => ({
      name,
      firstName: name,
      lastName: "Full",
      email: `${name.toLowerCase()}@x.co`,
    });
    expect(
      await registerPair(
        db,
        UnpaidPairSchema.parse({
          openPlayId: regular,
          a: person("Ana"),
          b: person("Ben"),
        }),
      ),
    ).toEqual({
      error: "This is a Regular open play: add pairs by name at the booth",
    });
  });

  it("marks a Regular pair unpaid again, but not a Ranked one", async () => {
    const { pairId } = await ok(
      registerGuestPair(db, guest("gel/son", { paid: true })),
    );
    expect(await markPairUnpaid(db, pairId)).toBeNull();
    const day = await listRegistrations(db, regular);
    expect(day.pairs).toEqual([]);
    expect(day.pending).toHaveLength(1);
    expect(await markPairUnpaid(db, "junk")).toBe("Pair not found");
    expect(
      await markPairUnpaid(db, "00000000-0000-4000-8000-000000000000"),
    ).toBe("Pair not found");

    const person = (name: string) => ({
      name,
      firstName: name,
      lastName: "Full",
      email: `${name.toLowerCase()}@x.co`,
    });
    const r = await ok(
      registerPair(
        db,
        UnpaidPairSchema.parse({
          openPlayId: ranked,
          a: person("Ana"),
          b: person("Ben"),
        }),
      ),
    );
    expect(await markPairUnpaid(db, r.pairId!)).toBe(
      "Only Regular open plays can do that",
    );
  });

  it("renames a Regular pair, but not a Ranked one", async () => {
    const { pairId } = await ok(registerGuestPair(db, guest("gel/son")));
    expect(await renameGuestPair(db, pairId, ["Gel", "Sonny"])).toBeNull();
    const names = (await listRegistrations(db, regular)).pending[0].members
      .map((m) => m.name)
      .sort();
    expect(names).toEqual(["Gel", "Sonny"]);
    expect(await renameGuestPair(db, "junk", ["a", "b"])).toBe(
      "Pair not found",
    );
    expect(
      await renameGuestPair(db, "00000000-0000-4000-8000-000000000000", [
        "a",
        "b",
      ]),
    ).toBe("Pair not found");

    const person = (name: string) => ({
      name,
      firstName: name,
      lastName: "Full",
      email: `${name.toLowerCase()}@x.co`,
    });
    const r = await ok(
      registerPair(
        db,
        UnpaidPairSchema.parse({
          openPlayId: ranked,
          a: person("Ana"),
          b: person("Ben"),
        }),
      ),
    );
    expect(await renameGuestPair(db, r.pairId!, ["x", "y"])).toBe(
      "Only Regular pairs are renamed here",
    );
  });

  it("shows the new names in a running queue", async () => {
    const { pairId } = await ok(
      registerGuestPair(db, guest("gel/son", { paid: true })),
    );
    await ok(registerGuestPair(db, guest("ivan/jed", { paid: true })));
    const state = createSession(
      {
        startTime: "18:00",
        endTime: "20:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      await paidPairs(db, regular),
      0,
      undefined,
      () => 0,
    );
    await startSession(db, regular, state);
    await renameGuestPair(db, pairId, ["Gel", "Sonny"]);
    const name = (await getLiveSession(db, regular))?.players[pairId]?.name;
    expect(name?.split(" & ").sort()).toEqual(["Gel", "Sonny"]);
  });

  it("adds solos by name and pairs two, paid or not", async () => {
    const solo = (name: string, openPlayId = regular) =>
      ok(registerGuestSolo(db, GuestSoloSchema.parse({ openPlayId, name })));
    const { playerId: gel } = await solo("gel");
    const { playerId: son } = await solo("son");
    const { playerId: ivan } = await solo("ivan");
    const { playerId: jed } = await solo("jed");
    let day = await listRegistrations(db, regular);
    expect(day.solos.map((m) => m.name).sort()).toEqual([
      "gel",
      "ivan",
      "jed",
      "son",
    ]);
    expect(await soloGuest(db, gel)).toBe(regular);

    await ok(
      pairGuestSolos(db, { openPlayId: regular, a: gel, b: son, paid: true }),
    );
    await ok(
      pairGuestSolos(db, { openPlayId: regular, a: ivan, b: jed, paid: false }),
    );
    day = await listRegistrations(db, regular);
    expect(day.solos).toEqual([]);
    expect(day.pairs).toEqual([
      expect.objectContaining({ amountCents: 30000, method: "cash" }),
    ]);
    expect(day.pending).toHaveLength(1);
    // Paired already: not a solo anymore.
    expect(await soloGuest(db, gel)).toBeNull();
    expect(
      await pairGuestSolos(db, {
        openPlayId: regular,
        a: gel,
        b: son,
        paid: false,
      }),
    ).toEqual({
      error: "Both players must be signed up alone for this open play",
    });
  });

  it("refuses pairing the same player, junk ids, a full or Ranked play", async () => {
    const { playerId: a } = await ok(
      registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "a" }),
      ),
    );
    const pair = (over: object) =>
      pairGuestSolos(db, {
        openPlayId: regular,
        a,
        b: a,
        paid: false,
        ...over,
      });
    expect(await pair({})).toEqual({ error: "Pick two different players" });
    expect(await pair({ b: "junk" })).toEqual({
      error: "Pick two different players",
    });
    expect(await pair({ openPlayId: ranked })).toEqual({
      error: "Only Regular open plays",
    });
    expect(
      await pair({ openPlayId: "00000000-0000-4000-8000-000000000000" }),
    ).toEqual({ error: "Open play not found" });

    const small = await createOpenPlay(db, play({ maxPairs: 2 }));
    await ok(registerGuestPair(db, guest("c/d", { paid: true }, small)));
    await ok(registerGuestPair(db, guest("e/f", { paid: true }, small)));
    const ids = [];
    for (const name of ["x", "y"]) {
      const r = await ok(
        registerGuestSolo(
          db,
          GuestSoloSchema.parse({ openPlayId: small, name }),
        ),
      );
      ids.push(r.playerId);
    }
    expect(
      await pairGuestSolos(db, {
        openPlayId: small,
        a: ids[0],
        b: ids[1],
        paid: true,
      }),
    ).toEqual({ error: "This open play is full" });
    expect(
      await registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: ranked, name: "z" }),
      ),
    ).toEqual({ error: "Ranked open plays need each player's details" });
    expect(
      await registerGuestSolo(
        db,
        GuestSoloSchema.parse({
          openPlayId: "00000000-0000-4000-8000-000000000000",
          name: "z",
        }),
      ),
    ).toEqual({ error: "Open play not found" });
  });

  it("renames and removes a solo before pairing", async () => {
    const { playerId } = await ok(
      registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "gel" }),
      ),
    );
    expect(await renameGuestSolo(db, playerId, "Gelo")).toBeNull();
    expect((await listRegistrations(db, regular)).solos[0].name).toBe("Gelo");
    expect(await removeGuestSolo(db, playerId)).toBeNull();
    expect((await listRegistrations(db, regular)).solos).toEqual([]);
    expect(await renameGuestSolo(db, playerId, "x")).toBe("Player not found");
    expect(await removeGuestSolo(db, "junk")).toBe("Player not found");
  });

  it("takes no more sign-ups once ended", async () => {
    await ok(registerGuestPair(db, guest("gel/son", { paid: true })));
    await ok(registerGuestPair(db, guest("ivan/jed", { paid: true })));
    const state = createSession(
      {
        startTime: "18:00",
        endTime: "20:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      await paidPairs(db, regular),
      0,
      undefined,
      () => 0,
    );
    await startSession(db, regular, state);
    await endSession(db, regular);
    const ended = { error: "This open play has ended" };
    expect(await registerGuestPair(db, guest("a/b"))).toEqual(ended);
    expect(
      await registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "c" }),
      ),
    ).toEqual(ended);
  });

  it("splits a pair to a solo when one name is typed", async () => {
    const { pairId } = await ok(
      registerGuestPair(db, guest("gel/son", { paid: true })),
    );
    // "Son" matches a player: they stay (renamed as typed), gel leaves.
    expect(await splitGuestPair(db, pairId, "Son")).toBeNull();
    const day = await listRegistrations(db, regular);
    expect(day.pairs).toEqual([]);
    expect(day.solos.map((m) => m.name)).toEqual(["Son"]);
    expect((await getOpenPlay(db, regular))?.pairCount).toBe(0);

    // No match: the first player stays, renamed.
    const other = await ok(registerGuestPair(db, guest("ivan/jed")));
    expect(await splitGuestPair(db, other.pairId, "Ivy")).toBeNull();
    expect(
      (await listRegistrations(db, regular)).solos.map((m) => m.name).sort(),
    ).toHaveLength(2);
    expect(await splitGuestPair(db, "junk", "x")).toBe("Pair not found");
    expect(await splitGuestPair(db, other.pairId, "x")).toBe("Pair not found");
  });

  it("won't split a Ranked pair or one in a running queue", async () => {
    const person = (name: string) => ({
      name,
      firstName: name,
      lastName: "Full",
      email: `${name.toLowerCase()}@x.co`,
    });
    const r = await ok(
      registerPair(
        db,
        UnpaidPairSchema.parse({
          openPlayId: ranked,
          a: person("Ana"),
          b: person("Ben"),
        }),
      ),
    );
    expect(await splitGuestPair(db, r.pairId!, "Ana")).toBe(
      "Only Regular pairs are changed here",
    );

    const { pairId } = await ok(
      registerGuestPair(db, guest("gel/son", { paid: true })),
    );
    await ok(registerGuestPair(db, guest("ivan/jed", { paid: true })));
    const state = createSession(
      {
        startTime: "18:00",
        endTime: "20:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      await paidPairs(db, regular),
      0,
      undefined,
      () => 0,
    );
    await startSession(db, regular, state);
    expect(await splitGuestPair(db, pairId, "gel")).toBe(
      "They're in the queue. Remove them there first.",
    );
  });

  it("puts a pair or solo in the rank the host picked", async () => {
    await ok(registerGuestPair(db, guest("gel/son", { rank: "intermediate" })));
    await ok(
      registerGuestSolo(
        db,
        GuestSoloSchema.parse({
          openPlayId: regular,
          name: "ivy",
          rank: "intermediate",
        }),
      ),
    );
    const day = await listRegistrations(db, regular);
    expect(day.pending[0].members.map((m) => m.level)).toEqual([
      "intermediate",
      "intermediate",
    ]);
    expect(day.solos[0].level).toBe("intermediate");
    // Not one of this open play's ranks (Novice & Intermediate).
    const wrong = { error: "Pick one of this open play's ranks" };
    expect(await registerGuestPair(db, guest("a/b", { rank: "pro" }))).toEqual(
      wrong,
    );
    expect(
      await registerGuestSolo(
        db,
        GuestSoloSchema.parse({ openPlayId: regular, name: "z", rank: "pro" }),
      ),
    ).toEqual(wrong);
  });
});
