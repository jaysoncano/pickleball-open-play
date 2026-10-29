import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession, finishGame, startGame } from "@/lib/queue/engine";
import {
  ConfirmPaymentSchema,
  PairRegistrationSchema,
  PairUpSchema,
  PublicSignupSchema,
  PublicSoloSchema,
  RegistrationNameSchema,
  SoloRegistrationSchema,
  UnpaidPairSchema,
} from "@/lib/registration/forms";
import {
  OpenPlayEditSchema,
  type OpenPlayInput,
} from "@/lib/registration/open-play";
import {
  confirmEmail,
  createOpenPlay,
  ensurePlayers,
  getOpenPlay,
  getPlayer,
  getPlayerPrivate,
  hasPaidRegistration,
  listOpenPlays,
  listRegistrations,
  liveSessionGames,
  hasEndedSession,
  openPlayGames,
  openPlayMatches,
  endSession,
  pairMembers,
  confirmPairPayment,
  pairSolos,
  paidPairs,
  removePair,
  signUpPair,
  signUpSolo,
  playerMatches,
  recordMatch,
  registerPair,
  registerSolo,
  removeOpenPlay,
  setLevel,
  setPairNotes,
  setRegistrationName,
  startSession,
  updateOpenPlay,
  updateProfile,
  type Db,
} from "./queries";
import * as schema from "./schema";
import { LEVELS, type Level } from "@/lib/ranking/levels";

/** Every level from `a` to `b`, like a ticked run of ranks. */
const levelsBetween = (a: Level, b: Level) =>
  LEVELS.slice(LEVELS.indexOf(a), LEVELS.indexOf(b) + 1);

const DAY = "2026-10-27";
const MISSING = "00000000-0000-4000-8000-000000000000";
let db: Db;
let ana: string;
let op: string;

const play = (over: Partial<OpenPlayInput> = {}): OpenPlayInput => ({
  kind: "ranked",
  venue: "Sunrise Courts",
  location: "Makati",
  playDate: DAY,
  startTime: "18:00",
  endTime: "20:00",
  levels: levelsBetween("beginner", "pro"),
  maxPairs: null,
  feeCents: 30000,
  ...over,
});

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  [{ id: ana }] = await ensurePlayers(db, ["Ana"]);
  op = await createOpenPlay(db, play());
});

const person = (name: string, extra: Record<string, string> = {}) => ({
  name,
  firstName: name,
  lastName: "Full",
  email: `${name.toLowerCase()}@x.co`,
  ...extra,
});
const anaP = () => person("Ana", { playerId: ana, name: "" });
const pair = (a: object, b: object, over: object = {}) =>
  PairRegistrationSchema.parse({
    openPlayId: op,
    amount: "300",
    method: "cash",
    a,
    b,
    ...over,
  });
const solo = (a: object, openPlayId = op) =>
  SoloRegistrationSchema.parse({ openPlayId, a });

async function okPair(a: object, b: object, over: object = {}) {
  const r = await registerPair(db, pair(a, b, over));
  if ("error" in r) throw new Error(r.error);
  return r;
}

describe("open plays", () => {
  it("lists by date and time with pair counts and live status", async () => {
    const early = await createOpenPlay(
      db,
      play({ startTime: "08:00", endTime: "10:00" }),
    );
    await createOpenPlay(db, play({ playDate: "2026-10-28" }));
    await okPair(anaP(), person("Ben"));
    const day = await listOpenPlays(db, { playDate: DAY });
    expect(day.map((o) => [o.id, o.pairCount, o.live])).toEqual([
      [early, 0, false],
      [op, 1, false],
    ]);
    expect(await listOpenPlays(db, { from: "2026-10-28" })).toHaveLength(1);
    const earlier = await createOpenPlay(db, play({ playDate: "2026-10-20" }));
    const earliest = await createOpenPlay(db, play({ playDate: "2026-10-01" }));
    expect((await listOpenPlays(db, { before: DAY })).map((o) => o.id)).toEqual(
      [earlier, earliest],
    );
    const state = createSession(
      {
        startTime: "18:00",
        endTime: "20:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      [],
      0,
    );
    await startSession(db, op, state);
    expect((await getOpenPlay(db, op))?.live).toBe(true);
    expect(await getOpenPlay(db, "junk")).toBeNull();
    expect(await getOpenPlay(db, MISSING)).toBeNull();
  });

  it("removes one only while nobody signed up or played", async () => {
    const empty = await createOpenPlay(db, play());
    expect(await removeOpenPlay(db, empty)).toBeNull();
    expect(await getOpenPlay(db, empty)).toBeNull();
    await registerSolo(db, solo(anaP()));
    expect(await removeOpenPlay(db, op)).toBe(
      "Players signed up already; it can't be removed",
    );
  });
});

describe("registerPair", () => {
  it("registers an existing and a new player with one entry", async () => {
    const r = await okPair(anaP(), person("Ben"), { notes: "R1" });
    expect(r.players.map((p) => p.name)).toEqual(["Ana", "Ben"]);
    expect(await getPlayer(db, ana)).toMatchObject({
      firstName: "Ana",
      lastName: "Full",
      fullName: "Ana Full",
    });
    expect(await getPlayerPrivate(db, ana)).toMatchObject({
      email: "ana@x.co",
      emailConfirmedAt: null,
    });
    const day = await listRegistrations(db, op);
    expect(day.solos).toEqual([]);
    expect(day.pairs).toEqual([
      expect.objectContaining({
        id: r.pairId,
        amountCents: 30000,
        method: "cash",
        notes: "R1",
        members: [
          expect.objectContaining({ name: "Ana" }),
          expect.objectContaining({ name: "Ben" }),
        ],
      }),
    ]);
    expect(await hasPaidRegistration(db, ana)).toBe(true);
    expect(await hasPaidRegistration(db, MISSING)).toBe(false);
  });

  it("refuses taken names and emails, unknowns, and double sign-ups", async () => {
    await okPair(anaP(), person("Ben"));
    // A taken name with someone else's email: pick them instead.
    expect(
      await registerPair(
        db,
        pair(person("ana", { email: "other@x.co" }), person("Cy")),
      ),
    ).toEqual({ error: "ana is already registered. Pick them instead." });
    // A known email is that player, whatever name was typed.
    expect(
      await registerPair(
        db,
        pair(person("Cy", { email: "ben@x.co" }), person("Dee")),
      ),
    ).toEqual({ error: "Ben is already signed up for this open play" });
    expect(
      await registerPair(
        db,
        pair(person("X", { playerId: MISSING, name: "" }), person("Dee")),
      ),
    ).toEqual({ error: "Player not found" });
    expect(await registerPair(db, pair(anaP(), person("Dee")))).toEqual({
      error: "Ana is already signed up for this open play",
    });
    expect(
      await registerPair(
        db,
        pair(person("Cy"), person("Dee"), { openPlayId: MISSING }),
      ),
    ).toEqual({ error: "Open play not found" });
  });

  it("refuses an open play at the same time, allows a later one", async () => {
    await okPair(anaP(), person("Ben"));
    const clash = await createOpenPlay(
      db,
      play({ startTime: "19:00", endTime: "21:00" }),
    );
    const later = await createOpenPlay(
      db,
      play({ startTime: "20:00", endTime: "22:00" }),
    );
    expect(
      await registerPair(db, pair(anaP(), person("Cy"), { openPlayId: clash })),
    ).toEqual({ error: "Ana is signed up for another open play at that time" });
    await okPair(anaP(), person("Cy"), { openPlayId: later });
  });

  it("checks the level range against the pair's stronger player", async () => {
    const mid = await createOpenPlay(
      db,
      play({
        levels: levelsBetween("novice", "intermediate"),
        startTime: "06:00",
        endTime: "08:00",
      }),
    );
    await setLevel(db, ana, "advanced");
    expect(
      await registerPair(db, pair(anaP(), person("Ben"), { openPlayId: mid })),
    ).toEqual({
      error: "Ana is Advanced, so this pair can't join Novice & Intermediate",
    });
    // Two new players are Beginners: below the range.
    expect(
      await registerPair(
        db,
        pair(person("Cy"), person("Dee"), { openPlayId: mid }),
      ),
    ).toEqual({
      error:
        "Cy is Beginner, so this pair plays Beginner; this open play is for Novice & Intermediate",
    });
    await setLevel(db, ana, "novice");
    await okPair(anaP(), person("Ben"), { openPlayId: mid });
  });

  it("stops at the open play's cap", async () => {
    const small = await createOpenPlay(
      db,
      play({ maxPairs: 2, startTime: "06:00", endTime: "08:00" }),
    );
    const at = { openPlayId: small };
    await okPair(person("A1"), person("A2"), at);
    await okPair(person("B1"), person("B2"), at);
    expect(
      await registerPair(db, pair(person("C1"), person("C2"), at)),
    ).toEqual({
      error: "This open play is full",
    });
    // Solos can still wait for a partner; pairing them hits the cap.
    await registerSolo(db, solo(person("S1"), small));
    expect((await getOpenPlay(db, small))?.pairCount).toBe(2);
  });

  it("keeps a confirmed email confirmed when it doesn't change", async () => {
    await okPair(anaP(), person("Ben"));
    expect(await confirmEmail(db, ana, "ana@x.co")).toBe(true);
    const tomorrow = await createOpenPlay(db, play({ playDate: "2026-10-28" }));
    await okPair(anaP(), person("Cy"), { openPlayId: tomorrow });
    expect((await getPlayerPrivate(db, ana))?.emailConfirmedAt).not.toBeNull();
  });
});

describe("solos and pairing up", () => {
  it("pairs two solo players and takes the full entry", async () => {
    await registerSolo(db, solo(anaP()));
    const b = await registerSolo(db, solo(person("Ben")));
    const ben = "players" in b ? b.players[0].id : "";
    expect((await listRegistrations(db, op)).solos.map((s) => s.name)).toEqual([
      "Ana",
      "Ben",
    ]);
    expect(await paidPairs(db, op)).toEqual([]);
    const up = PairUpSchema.parse({
      openPlayId: op,
      amount: "300",
      method: "cash",
      a: { playerId: ben },
      b: { playerId: ana },
    });
    const r = await pairSolos(db, up);
    expect("players" in r && r.players.map((p) => p.name)).toEqual([
      "Ben",
      "Ana",
    ]);
    const day = await listRegistrations(db, op);
    expect(day.solos).toEqual([]);
    expect(day.pairs).toHaveLength(1);
    expect(await pairSolos(db, up)).toEqual({
      error: "Both players must be signed up alone for this open play",
    });
  });

  it("checks range and cap when pairing solos", async () => {
    const pro = await createOpenPlay(
      db,
      play({
        levels: levelsBetween("advanced", "pro"),
        maxPairs: 2,
        startTime: "06:00",
        endTime: "08:00",
      }),
    );
    const [{ id: x }, { id: y }] = await ensurePlayers(db, ["X", "Y"]);
    await setLevel(db, x, "pro");
    await registerSolo(db, solo(person("X", { playerId: x, name: "" }), pro));
    await registerSolo(db, solo(person("Y", { playerId: y, name: "" }), pro));
    // A Beginner solo can join: a stronger partner lifts the pair.
    await registerSolo(db, solo(anaP(), pro));
    const up = (id1: string, id2: string) =>
      PairUpSchema.parse({
        openPlayId: pro,
        amount: "1",
        method: "cash",
        a: { playerId: id1 },
        b: { playerId: id2 },
      });
    // Two Beginners would be below the range.
    expect(await pairSolos(db, up(ana, y))).toEqual({
      error:
        "Ana is Beginner, so this pair plays Beginner; this open play is for Advanced & Pro",
    });
    // Pro + Beginner plays at Pro: in range.
    expect("pairId" in (await pairSolos(db, up(x, y)))).toBe(true);
  });

  it("refuses a solo player above the range", async () => {
    const low = await createOpenPlay(
      db,
      play({
        levels: levelsBetween("beginner", "novice"),
        startTime: "06:00",
        endTime: "08:00",
      }),
    );
    await setLevel(db, ana, "pro");
    expect(await registerSolo(db, solo(anaP(), low))).toEqual({
      error: "Ana is Pro, so they can't join Beginner & Novice",
    });
  });

  it("refuses a solo who is already signed up", async () => {
    await registerSolo(db, solo(anaP()));
    expect(await registerSolo(db, solo(anaP()))).toEqual({
      error: "Ana is already signed up for this open play",
    });
  });
});

describe("pairs as queue units", () => {
  it("names a pair and plays it at the stronger level", async () => {
    await setLevel(db, ana, "advanced");
    const r = await okPair(anaP(), person("Ben"));
    expect(await paidPairs(db, op)).toEqual([
      {
        id: r.pairId,
        name: "Ana & Ben",
        skill: 3,
        blocked: null,
        paid: true,
        members: [
          { id: ana, name: "Ana", checkedIn: false },
          { id: r.players[1].id, name: "Ben", checkedIn: false },
        ],
      },
    ]);
    const members = await pairMembers(db, [r.pairId!, "junk"]);
    expect(members.get(r.pairId!)?.map((m) => m.name)).toEqual(["Ana", "Ben"]);
    expect(await pairMembers(db, ["junk"])).toEqual(new Map());
  });

  it("blocks a paid pair once a player is promoted above the ranks", async () => {
    const beginners = await createOpenPlay(
      db,
      play({ levels: ["beginner"], startTime: "06:00", endTime: "08:00" }),
    );
    await okPair(anaP(), person("Ben"), { openPlayId: beginners });
    expect((await paidPairs(db, beginners))[0].blocked).toBeNull();
    await setLevel(db, ana, "novice");
    expect((await paidPairs(db, beginners))[0]).toMatchObject({
      skill: 1,
      blocked: "Ana is Novice, so this pair can't join Beginner",
    });
    expect(await paidPairs(db, MISSING)).toEqual([]);
  });

  it("records a pair-vs-pair game as four players", async () => {
    const p1 = await okPair(anaP(), person("Ben"));
    const p2 = await okPair(person("Cy"), person("Dee"));
    let state = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      await paidPairs(db, op),
      0,
      undefined,
      () => 0,
    );
    await startSession(db, op, state);
    const court = state.courts[0].id;
    state = finishGame(startGame(state, court, 0), court, 600_000, () => 0);
    const game = state.matches.at(-1)!;
    expect(
      await recordMatch(db, op, state, game, { scoreA: 11, scoreB: 5 }),
    ).toBe(true);
    const [match] = await playerMatches(db, ana);
    expect(match.players).toHaveLength(4);
    const sideOf = (id: string) =>
      match.players.find((p) => p.playerId === id)?.side;
    expect(sideOf(p1.players[1].id)).toBe(sideOf(ana));
    expect(sideOf(p2.players[0].id)).not.toBe(sideOf(ana));
  });

  it("lists the live session's games by pair, until it ends", async () => {
    const p1 = await okPair(anaP(), person("Ben"));
    const p2 = await okPair(person("Cy"), person("Dee"));
    let state = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      await paidPairs(db, op),
      0,
      undefined,
      () => 0,
    );
    await startSession(db, op, state);
    expect(await liveSessionGames(db, op)).toEqual([]);
    const court = state.courts[0].id;
    state = finishGame(startGame(state, court, 0), court, 600_000, () => 0);
    const game = state.matches.at(-1)!;
    await recordMatch(db, op, state, game, { scoreA: 11, scoreB: 7 });
    const [g] = await liveSessionGames(db, op);
    expect([...g.sideA, ...g.sideB].sort()).toEqual(
      [p1.pairId, p2.pairId].sort(),
    );
    expect(g.sideA).toEqual([game.playerIds[0]]);
    expect([g.scoreA, g.scoreB]).toEqual([11, 7]);
    expect(await hasEndedSession(db, op)).toBe(false);
    expect(await getOpenPlay(db, op)).toMatchObject({
      live: true,
      ended: false,
    });
    await endSession(db, op);
    expect(await getOpenPlay(db, op)).toMatchObject({
      live: false,
      ended: true,
    });
    expect(await liveSessionGames(db, op)).toEqual([]);
    expect(await liveSessionGames(db, "junk")).toEqual([]);
    // Ended: the results keep every game and match record.
    expect(await hasEndedSession(db, op)).toBe(true);
    expect(await openPlayGames(db, op)).toEqual([g]);
    const [record] = await openPlayMatches(db, op);
    expect([record.scoreA, record.scoreB]).toEqual([11, 7]);
    expect(record.players).toHaveLength(4);
    expect(await openPlayMatches(db, "junk")).toEqual([]);
    expect(await hasEndedSession(db, "junk")).toBe(false);
  });
});

describe("updateOpenPlay", () => {
  const edit = (over: Record<string, unknown> = {}) =>
    OpenPlayEditSchema.parse({
      playDate: DAY,
      startTime: "18:00",
      endTime: "20:00",
      levels: levelsBetween("beginner", "pro"),
      maxPairs: "",
      fee: "300",
      ...over,
    });

  it("saves a new date, time, ranks, cap, and entry", async () => {
    expect(
      await updateOpenPlay(
        db,
        op,
        edit({
          playDate: "2026-10-30",
          startTime: "07:00",
          endTime: "09:30",
          levels: ["novice", "advanced"],
          maxPairs: "6",
          fee: "250",
        }),
      ),
    ).toBeNull();
    expect(await getOpenPlay(db, op)).toMatchObject({
      playDate: "2026-10-30",
      startTime: "07:00",
      endTime: "09:30",
      levels: ["novice", "advanced"],
      maxPairs: 6,
      feeCents: 25000,
    });
    expect(await updateOpenPlay(db, MISSING, edit())).toBe(
      "Open play not found",
    );
  });

  it("keeps ranks that have sign-ups", async () => {
    await okPair(anaP(), person("Ben"));
    await registerSolo(db, solo(person("Cy")));
    expect(await updateOpenPlay(db, op, edit({ levels: ["novice"] }))).toBe(
      "Beginner has 2 sign-ups; keep it, or move them first",
    );
    expect(await updateOpenPlay(db, op, edit({ levels: ["beginner"] }))).toBe(
      null,
    );
  });

  it("keeps the cap at or above the paid pairs", async () => {
    await okPair(anaP(), person("Ben"));
    await okPair(person("Cy"), person("Dee"));
    await okPair(person("Eve"), person("Fay"));
    expect(await updateOpenPlay(db, op, edit({ maxPairs: "2" }))).toBe(
      "3 pairs have paid already; allow at least 3",
    );
    expect(await updateOpenPlay(db, op, edit({ maxPairs: "3" }))).toBeNull();
  });

  it("won't move it onto another open play its players joined", async () => {
    await okPair(anaP(), person("Ben"));
    const later = await createOpenPlay(
      db,
      play({ startTime: "20:00", endTime: "22:00" }),
    );
    await registerSolo(db, solo(anaP(), later));
    expect(
      await updateOpenPlay(
        db,
        op,
        edit({ startTime: "19:00", endTime: "21:00" }),
      ),
    ).toBe("Ana is in another open play at that time");
    expect(
      await updateOpenPlay(db, op, edit({ playDate: "2026-10-28" })),
    ).toBeNull();
  });

  it("only changes the cap and entry while it's running", async () => {
    await startSession(
      db,
      op,
      createSession(
        {
          startTime: "18:00",
          endTime: "20:00",
          courtCount: 1,
          playersPerCourt: 2,
        },
        [],
        0,
      ),
    );
    expect(await updateOpenPlay(db, op, edit({ endTime: "21:00" }))).toBe(
      "It's running now: end it before changing its date, time, or ranks",
    );
    expect(await updateOpenPlay(db, op, edit({ levels: ["pro"] }))).toBe(
      "It's running now: end it before changing its date, time, or ranks",
    );
    expect(
      await updateOpenPlay(db, op, edit({ maxPairs: "10", fee: "350" })),
    ).toBeNull();
    expect((await getOpenPlay(db, op))?.feeCents).toBe(35000);
  });
});

describe("confirmEmail", () => {
  it("refuses once the email changed", async () => {
    await okPair(anaP(), person("Ben"));
    await updateProfile(db, ana, {
      firstName: "Ana",
      lastName: "Cruz",
      email: "other@x.co",
      phone: "",
      homeClub: "",
      bio: "",
      hand: null,
    });
    expect(await confirmEmail(db, ana, "ana@x.co")).toBe(false);
  });
});

describe("online sign-up and payment approval", () => {
  const signup = (a: string, b: string, rank = "beginner", over = {}) =>
    PublicSignupSchema.parse({
      openPlayId: op,
      rank,
      a: {
        name: a,
        firstName: a,
        lastName: "Web",
        email: `${a.toLowerCase()}@web.co`,
      },
      b: {
        name: b,
        firstName: b,
        lastName: "Web",
        email: `${b.toLowerCase()}@web.co`,
      },
      ...over,
    });
  const confirm = (pairId: string) =>
    ConfirmPaymentSchema.parse({
      pairId,
      amount: "300",
      method: "ewallet",
      notes: "G1",
    });

  it("waits as pending, then joins the queue when the admin confirms", async () => {
    const r = await signUpPair(db, signup("Kim", "Lee"));
    if ("error" in r) throw new Error(r.error);
    expect(r.names).toEqual(["Kim", "Lee"]);
    let day = await listRegistrations(db, op);
    expect(day.pairs).toEqual([]);
    expect(day.pending).toEqual([
      expect.objectContaining({ id: r.pairId, requestedLevel: "beginner" }),
    ]);
    expect(await paidPairs(db, op)).toEqual([]);
    expect((await getOpenPlay(db, op))?.pairCount).toBe(0);
    const kim = day.pending[0].members[0].playerId;
    expect(await hasPaidRegistration(db, kim)).toBe(false);

    const done = await confirmPairPayment(db, confirm(r.pairId));
    expect(done).toMatchObject({ openPlayId: op, pairId: r.pairId });
    expect("players" in done && done.players.map((p) => p.email)).toEqual([
      "kim@web.co",
      "lee@web.co",
    ]);
    day = await listRegistrations(db, op);
    expect(day.pending).toEqual([]);
    expect(day.pairs[0]).toMatchObject({
      amountCents: 30000,
      method: "ewallet",
      notes: "G1",
    });
    expect(await paidPairs(db, op)).toHaveLength(1);
    expect(await hasPaidRegistration(db, kim)).toBe(true);
    expect(await confirmPairPayment(db, confirm(r.pairId))).toEqual({
      error: "Already paid",
    });
    expect(await confirmPairPayment(db, confirm(MISSING))).toEqual({
      error: "Sign-up not found",
    });
  });

  it("only lets a taken name sign up with the email on file", async () => {
    await okPair(anaP(), person("Ben"));
    const tomorrow = await createOpenPlay(db, play({ playDate: "2026-10-28" }));
    // Ana's email is ana@x.co, not ana@web.co.
    expect(
      await signUpPair(
        db,
        signup("Ana", "Zed", "beginner", { openPlayId: tomorrow }),
      ),
    ).toEqual({
      error:
        "Ana is already a player. Use the email on their profile, or sign up at the booth.",
    });
    const ok = await signUpPair(
      db,
      PublicSignupSchema.parse({
        openPlayId: tomorrow,
        rank: "beginner",
        a: {
          name: "ana",
          firstName: "Ana",
          lastName: "Full",
          email: "ana@x.co",
        },
        b: {
          name: "Zed",
          firstName: "Zed",
          lastName: "Web",
          email: "zed@web.co",
        },
      }),
    );
    expect("names" in ok && ok.names).toEqual(["Ana", "Zed"]);
  });

  it("checks the chosen rank against the stronger player", async () => {
    const both = await createOpenPlay(
      db,
      play({
        levels: ["beginner", "novice"],
        startTime: "06:00",
        endTime: "08:00",
      }),
    );
    await okPair(anaP(), person("Ben"));
    await setLevel(db, ana, "novice");
    const asAna = {
      name: "Ana",
      firstName: "Ana",
      lastName: "Full",
      email: "ana@x.co",
    };
    const zed = {
      name: "Zed",
      firstName: "Zed",
      lastName: "Web",
      email: "zed@web.co",
    };
    expect(
      await signUpPair(
        db,
        PublicSignupSchema.parse({
          openPlayId: both,
          rank: "beginner",
          a: asAna,
          b: zed,
        }),
      ),
    ).toEqual({ error: "Ana is Novice, so this pair can't join Beginner" });
    expect(
      await signUpPair(
        db,
        signup("Kim", "Lee", "novice", { openPlayId: both }),
      ),
    ).toEqual({ error: "This pair plays Beginner; pick the Beginner rank" });
  });

  it("re-checks the cap when confirming", async () => {
    const small = await createOpenPlay(
      db,
      play({ maxPairs: 2, startTime: "06:00", endTime: "08:00" }),
    );
    const at = { openPlayId: small };
    const pending = await signUpPair(db, signup("Kim", "Lee", "beginner", at));
    await okPair(person("A1"), person("A2"), at);
    await okPair(person("B1"), person("B2"), at);
    expect(
      await confirmPairPayment(
        db,
        confirm("pairId" in pending ? pending.pairId : ""),
      ),
    ).toEqual({
      error: "This open play is full",
    });
  });

  it("signs up a solo player for a rank, at or below it", async () => {
    const both = await createOpenPlay(
      db,
      play({
        levels: ["beginner", "novice"],
        startTime: "06:00",
        endTime: "08:00",
      }),
    );
    const solo = (name: string, rank: string) =>
      PublicSoloSchema.parse({
        openPlayId: both,
        rank,
        a: {
          name,
          firstName: name,
          lastName: "Web",
          email: `${name.toLowerCase()}@web.co`,
        },
      });
    // A Beginner can wait for a Novice partner.
    const r = await signUpSolo(db, solo("Kim", "novice"));
    expect("name" in r && r.name).toBe("Kim");
    const day = await listRegistrations(db, both);
    expect(day.solos).toEqual([
      expect.objectContaining({
        name: "Kim",
        level: "beginner",
        requestedLevel: "novice",
      }),
    ]);
    expect(day.pending).toEqual([]);
    expect(await signUpSolo(db, solo("Kim", "novice"))).toEqual({
      error: "Kim is already signed up for this open play",
    });
    // A Novice can't drop to Beginner.
    const [{ id: nia }] = await ensurePlayers(db, ["Nia"]);
    await setLevel(db, nia, "novice");
    await updateProfile(db, nia, {
      firstName: "Nia",
      lastName: "Web",
      email: "nia@web.co",
      phone: "",
      homeClub: "",
      bio: "",
      hand: null,
    });
    expect(await signUpSolo(db, solo("Nia", "beginner"))).toEqual({
      error: "Nia is Novice, so they can't join Beginner",
    });
    // Taken name with another email.
    expect(
      await signUpSolo(
        db,
        PublicSoloSchema.parse({
          openPlayId: both,
          rank: "novice",
          a: {
            name: "Nia",
            firstName: "Nia",
            lastName: "X",
            email: "fake@web.co",
          },
        }),
      ),
    ).toEqual({
      error:
        "Nia is already a player. Use the email on their profile, or sign up at the booth.",
    });
    expect(
      await signUpSolo(db, { ...solo("Zed", "novice"), openPlayId: MISSING }),
    ).toEqual({ error: "Open play not found" });
  });

  it("removes a pending sign-up, or a paid pair while not running", async () => {
    const r = await signUpPair(db, signup("Kim", "Lee"));
    const id = "pairId" in r ? r.pairId : "";
    expect(await removePair(db, id)).toBeNull();
    expect((await listRegistrations(db, op)).pending).toEqual([]);
    expect(await removePair(db, MISSING)).toBe("Pair not found");
    const paid = await okPair(anaP(), person("Ben"));
    await startSession(
      db,
      op,
      createSession(
        {
          startTime: "18:00",
          endTime: "20:00",
          courtCount: 1,
          playersPerCourt: 2,
        },
        [],
        0,
      ),
    );
    expect(await removePair(db, paid.pairId!)).toBe(
      "This open play is running; remove the pair after it ends",
    );
  });
});

describe("pair notes", () => {
  const unpaid = (notes: string) =>
    UnpaidPairSchema.parse({
      openPlayId: op,
      notes,
      a: person("Kim"),
      b: person("Lee"),
    });
  const pay = (pairId: string, notes = "") =>
    ConfirmPaymentSchema.parse({
      pairId,
      amount: "300",
      method: "cash",
      notes,
    });

  it("keeps notes on an unpaid pair, through to payment", async () => {
    const r = await registerPair(db, unpaid("pays at 7"));
    if ("error" in r) throw new Error(r.error);
    expect((await listRegistrations(db, op)).pending[0].notes).toBe(
      "pays at 7",
    );
    await confirmPairPayment(db, pay(r.pairId!));
    expect((await listRegistrations(db, op)).pairs[0].notes).toBe("pays at 7");
  });

  it("takes new notes typed when confirming the payment", async () => {
    const r = await registerPair(db, unpaid("pays at 7"));
    if ("error" in r) throw new Error(r.error);
    await confirmPairPayment(db, pay(r.pairId!, "paid by Kim"));
    expect((await listRegistrations(db, op)).pairs[0].notes).toBe(
      "paid by Kim",
    );
  });

  it("replaces a pair's notes, and says when there's no such pair", async () => {
    const r = await okPair(anaP(), person("Ben"));
    expect(await setPairNotes(db, r.pairId!, "own paddles")).toBe(true);
    expect((await listRegistrations(db, op)).pairs[0].notes).toBe(
      "own paddles",
    );
    expect(await setPairNotes(db, r.pairId!, "")).toBe(true);
    expect((await listRegistrations(db, op)).pairs[0].notes).toBe("");
    expect(await setPairNotes(db, MISSING, "x")).toBe(false);
    expect(await setPairNotes(db, "not-a-uuid", "x")).toBe(false);
  });
});

describe("setRegistrationName", () => {
  const names = (playerId: string, name: string) =>
    RegistrationNameSchema.parse({
      playerId,
      name,
      firstName: "Ana",
      lastName: "Reyes",
    });

  it("changes the queue name and first and last name", async () => {
    expect(await setRegistrationName(db, names(ana, "Ana R."))).toBeNull();
    expect(await getPlayer(db, ana)).toMatchObject({
      name: "Ana R.",
      firstName: "Ana",
      lastName: "Reyes",
    });
    // Keeping its own name (any case) is fine.
    expect(await setRegistrationName(db, names(ana, "ana r."))).toBeNull();
  });

  it("refuses a name another player has, and a missing player", async () => {
    await ensurePlayers(db, ["Ben"]);
    expect(await setRegistrationName(db, names(ana, "BEN"))).toBe(
      "BEN is already registered",
    );
    expect(await setRegistrationName(db, names(MISSING, "Zed"))).toBe(
      "Player not found",
    );
  });
});
