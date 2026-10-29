import { PGlite } from "@electric-sql/pglite";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { createSession, finishGame, startGame } from "@/lib/queue/engine";
import type { QueueState } from "@/lib/queue/schema";
import { PairRegistrationSchema } from "@/lib/registration/forms";
import {
  createAdmin,
  createOpenPlay,
  createProtest,
  protestPlayerId,
  removeProtest,
  playerByEmail,
  registerPair,
  sharedOpenPlay,
  endSession,
  ensurePlayers,
  getLiveSession,
  listLiveSessions,
  getPlayer,
  levelHistory,
  listPlayers,
  listProtests,
  pendingProtestCount,
  playerMatches,
  recentMatches,
  recordMatch,
  renamePlayer,
  resolveProtest,
  saveSession,
  setLevel,
  startSession,
  type Db,
  type PlayerRow,
} from "./queries";
import * as schema from "./schema";
import { LEVELS, type Level } from "@/lib/ranking/levels";

/** Every level from `a` to `b`, like a ticked run of ranks. */
const levelsBetween = (a: Level, b: Level) =>
  LEVELS.slice(LEVELS.indexOf(a), LEVELS.indexOf(b) + 1);

const NOW = new Date(2026, 9, 27, 18, 0).getTime();
const MIN = 60_000;
const zero = () => 0;

let db: Db;
/** The open play the sessions in these tests run. */
let op: string;

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  op = await createOpenPlay(db, {
    venue: "Club",
    location: "Town",
    playDate: "2026-10-27",
    startTime: "18:00",
    endTime: "21:00",
    levels: levelsBetween("beginner", "pro"),
    maxPairs: null,
    feeCents: 0,
  });
});

function newSession(people: PlayerRow[]): QueueState {
  return createSession(
    { startTime: "18:00", endTime: "21:00", courtCount: 1, playersPerCourt: 4 },
    people,
    NOW,
    undefined,
    zero,
  );
}

/** Start a session, play one game, and record it as 11–7. */
async function playOne() {
  const people = await ensurePlayers(db, ["Ana", "Ben", "Cy", "Dee", "Eve"]);
  let state = newSession(people);
  await startSession(db, op, state);
  const court = state.courts[0].id;
  state = finishGame(startGame(state, court, NOW), court, NOW + 12 * MIN, zero);
  const game = state.matches.at(-1)!;
  await recordMatch(db, op, state, game, { scoreA: 11, scoreB: 7 });
  return { people, state, game };
}

describe("players", () => {
  it("creates new players once and reuses existing ones, any case", async () => {
    const first = await ensurePlayers(db, ["Ana", " ben ", "ANA", ""]);
    expect(first.map((p) => [p.name, p.level])).toEqual([
      ["Ana", "beginner"],
      ["ben", "beginner"],
    ]);
    const again = await ensurePlayers(db, ["BEN", "Cy"]);
    expect(again[0].id).toBe(first[1].id);
    expect(again.map((p) => p.name)).toEqual(["ben", "Cy"]);
    expect(await ensurePlayers(db, ["  "])).toEqual([]);
  });

  it("finds a player by id", async () => {
    const [ana] = await ensurePlayers(db, ["Ana"]);
    expect((await getPlayer(db, ana.id))?.name).toBe("Ana");
    expect(
      await getPlayer(db, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("renames players, refusing names someone else has", async () => {
    const [ana, ben] = await ensurePlayers(db, ["Ana", "Ben"]);
    expect(await renamePlayer(db, ana.id, " Anna ")).toBeNull();
    expect((await getPlayer(db, ana.id))?.name).toBe("Anna");
    expect(await renamePlayer(db, ana.id, "anna")).toBeNull();
    expect(await renamePlayer(db, ben.id, "ANNA")).toMatch(/already/);
    expect(
      await renamePlayer(db, "00000000-0000-0000-0000-000000000000", "Zed"),
    ).toMatch(/not found/);
  });

  it("changes levels and keeps a history", async () => {
    const [ana] = await ensurePlayers(db, ["Ana"]);
    expect(await setLevel(db, ana.id, "novice", "Moved up")).toBe(true);
    expect(await setLevel(db, ana.id, "novice")).toBe(true);
    expect(
      await setLevel(db, "00000000-0000-0000-0000-000000000000", "pro"),
    ).toBe(false);
    expect((await getPlayer(db, ana.id))?.level).toBe("novice");
    const history = await levelHistory(db, ana.id);
    expect(history.map((h) => [h.fromLevel, h.toLevel, h.note])).toEqual([
      ["beginner", "novice", "Moved up"],
    ]);
  });
});

describe("sessions", () => {
  it("starts, saves, and ends one session per open play", async () => {
    const people = await ensurePlayers(db, ["Ana", "Ben", "Cy", "Dee"]);
    const state = newSession(people);
    expect(await getLiveSession(db, op)).toBeNull();
    expect(await saveSession(db, op, state)).toBe(false);
    expect(await startSession(db, op, state)).toBe(true);
    expect(await startSession(db, op, state)).toBe(false);

    const later = { ...state, endsAt: state.endsAt + 30 * MIN };
    expect(await saveSession(db, op, later)).toBe(true);
    expect((await getLiveSession(db, op))?.endsAt).toBe(later.endsAt);

    await endSession(db, op);
    expect(await getLiveSession(db, op)).toBeNull();
    // Can run again after ending.
    expect(await startSession(db, op, state)).toBe(true);
  });

  it("runs open plays side by side", async () => {
    const other = await createOpenPlay(db, {
      venue: "Club",
      location: "Town",
      playDate: "2026-10-27",
      startTime: "18:00",
      endTime: "21:00",
      levels: levelsBetween("advanced", "pro"),
      maxPairs: 8,
      feeCents: 50000,
    });
    const state = newSession(await ensurePlayers(db, ["Ana", "Ben"]));
    expect(await startSession(db, op, state)).toBe(true);
    expect(await startSession(db, other, state)).toBe(true);
    expect(
      (await listLiveSessions(db)).map((s) => s.openPlayId).sort(),
    ).toEqual([op, other].sort());
    await endSession(db, other);
    expect(await getLiveSession(db, op)).not.toBeNull();
    expect(await getLiveSession(db, other)).toBeNull();
  });
});

describe("matches", () => {
  it("records the score, sides, and levels at the time", async () => {
    const { people, state } = await playOne();
    const [ana] = people;
    await setLevel(db, ana.id, "advanced");

    const [match] = await playerMatches(db, ana.id);
    expect(match).toMatchObject({
      courtLabel: "Court 1",
      scoreA: 11,
      scoreB: 7,
      startedAt: NOW,
      endedAt: NOW + 12 * MIN,
    });
    expect(match.players.map((p) => [p.name, p.side, p.level])).toEqual([
      ["Ana", "A", "beginner"],
      ["Ben", "A", "beginner"],
      ["Cy", "B", "beginner"],
      ["Dee", "B", "beginner"],
    ]);
    expect(await getLiveSession(db, op)).toEqual(state);
    expect(await recentMatches(db)).toEqual([match]);
    expect(await playerMatches(db, people[4].id)).toEqual([]);
  });

  it("counts games and wins per player", async () => {
    await playOne();
    const rows = await listPlayers(db);
    expect(rows.map((r) => [r.name, r.games, r.wins])).toEqual([
      ["Ana", 1, 1],
      ["Ben", 1, 1],
      ["Cy", 1, 0],
      ["Dee", 1, 0],
      ["Eve", 0, 0],
    ]);
  });

  it("won't record without a running session", async () => {
    const { state, game } = await playOne();
    await endSession(db, op);
    expect(
      await recordMatch(db, op, state, game, { scoreA: 2, scoreB: 11 }),
    ).toBe(false);
  });
});

describe("protests", () => {
  /** Ana & Ben paid for the open play `op`; Ben files about Ana. */
  async function pairUp(names: [string, string], openPlayId = op) {
    const person = (n: string) => ({
      name: n,
      firstName: n,
      lastName: "T",
      email: `${n.toLowerCase()}@x.co`,
    });
    const r = await registerPair(
      db,
      PairRegistrationSchema.parse({
        openPlayId,
        amount: "300",
        method: "cash",
        a: person(names[0]),
        b: person(names[1]),
      }),
    );
    if ("error" in r) throw new Error(r.error);
    return r.players;
  }

  async function file(reason = "I keep beating novice players.") {
    const existing = await ensurePlayers(db, ["Ana"]);
    let [ana] = existing;
    let ben = (await ensurePlayers(db, ["Ben"]))[0];
    if (!(await sharedOpenPlay(db, ben.id, ana.id))) {
      await db
        .delete(schema.players)
        .where(inArray(schema.players.id, [ana.id, ben.id]));
      const [a, b] = await pairUp(["Ana", "Ben"]);
      ana = { id: a.id, name: a.name, level: "beginner" };
      ben = { id: b.id, name: b.name, level: "beginner" };
    }
    const error = await createProtest(
      db,
      {
        playerId: ana.id,
        currentLevel: "beginner",
        requestedLevel: "novice",
        reason,
      },
      ben.id,
    );
    return { ana, ben, error };
  }

  it("needs a filer who shared a confirmed open play", async () => {
    const [ana, ben] = await pairUp(["Ana", "Ben"]);
    const [cy] = await pairUp(["Cy", "Dee"]);
    const [zed] = await ensurePlayers(db, ["Zed"]);
    const input = {
      playerId: ana.id,
      currentLevel: "beginner" as const,
      requestedLevel: "novice" as const,
      reason: "Long enough reason",
    };
    // Zed never had a confirmed spot.
    expect(await createProtest(db, input, zed.id)).toBe(
      "Only players with a confirmed open play spot can file a protest",
    );
    // Cy played in `op` too: same open play counts.
    expect(await sharedOpenPlay(db, cy.id, ana.id)).toMatchObject({ id: op });
    // Someone only in another open play can't.
    const other = await createOpenPlay(db, {
      venue: "Club",
      location: "Town",
      playDate: "2026-10-28",
      startTime: "18:00",
      endTime: "20:00",
      levels: levelsBetween("beginner", "pro"),
      maxPairs: null,
      feeCents: 0,
    });
    const [eve] = await pairUp(["Eve", "Fin"], other);
    expect(await createProtest(db, input, eve.id)).toBe(
      "You can only protest players you've been in an open play with",
    );
    expect(await createProtest(db, input, ben.id)).toBeNull();
    const [filed] = await listProtests(db, { playerId: ana.id });
    expect(filed).toMatchObject({
      filedById: ben.id,
      filedByName: "Ben",
      filedByEmail: "ben@x.co",
    });
    expect(await playerByEmail(db, "ben@x.co")).toEqual({
      id: ben.id,
      name: "Ben",
    });
    expect(await playerByEmail(db, "nobody@x.co")).toBeNull();
  });

  it("files one pending protest per player", async () => {
    const { ana, error } = await file();
    expect(error).toBeNull();
    expect(await pendingProtestCount(db)).toBe(1);
    expect((await file()).error).toMatch(/already/);
    const [protest] = await listProtests(db, { playerId: ana.id });
    expect(protest).toMatchObject({
      playerName: "Ana",
      requestedLevel: "novice",
      status: "pending",
    });
  });

  it("refuses unknown players and stale levels", async () => {
    const [ana, ben] = await pairUp(["Ana", "Ben"]);
    expect(
      await createProtest(
        db,
        {
          playerId: "00000000-0000-0000-0000-000000000000",
          currentLevel: "beginner",
          requestedLevel: "novice",
          reason: "Long enough reason",
        },
        ben.id,
      ),
    ).toMatch(/not found/);
    await setLevel(db, ana.id, "novice");
    expect(
      await createProtest(
        db,
        {
          playerId: ana.id,
          currentLevel: "beginner",
          requestedLevel: "intermediate",
          reason: "Long enough reason",
        },
        ben.id,
      ),
    ).toMatch(/changed/);
  });

  it("approving moves the player and logs the change", async () => {
    const { ana } = await file();
    const [protest] = await listProtests(db, { status: "pending" });
    expect(await resolveProtest(db, protest.id, true, "")).toBe(true);
    expect(await resolveProtest(db, protest.id, false, "again")).toBe(false);
    expect((await getPlayer(db, ana.id))?.level).toBe("novice");
    const [change] = await levelHistory(db, ana.id);
    expect(change).toMatchObject({
      note: "Protest approved",
      protestId: protest.id,
    });
    expect(await pendingProtestCount(db)).toBe(0);
  });

  it("rejecting keeps the level and the admin's note", async () => {
    const { ana } = await file();
    const [protest] = await listProtests(db);
    await resolveProtest(db, protest.id, false, "Record doesn't show it yet");
    expect((await getPlayer(db, ana.id))?.level).toBe("beginner");
    const [after] = await listProtests(db, { status: "rejected" });
    expect(after.adminNote).toBe("Record doesn't show it yet");
    expect(after.resolvedAt).toBeInstanceOf(Date);
  });

  it("records who decided, scopes to a host's players, and can be removed", async () => {
    const { ana } = await file();
    const host = await createAdmin(db, "hana", "h", "host");
    if ("error" in host) throw new Error(host.error);
    const [protest] = await listProtests(db);
    expect(await protestPlayerId(db, protest.id)).toBe(ana.id);
    expect(await protestPlayerId(db, "junk")).toBeNull();

    // A host sees protests about their players only.
    expect(await listProtests(db, { playerIds: [ana.id] })).toHaveLength(1);
    expect(await listProtests(db, { playerIds: [] })).toEqual([]);
    expect(await pendingProtestCount(db, [ana.id])).toBe(1);
    expect(await pendingProtestCount(db, [])).toBe(0);

    await resolveProtest(db, protest.id, true, "", host.id);
    const [decided] = await listProtests(db, { status: "approved" });
    expect(decided.resolvedByName).toBe("hana");

    // Removing keeps the level it set, and its history entry.
    expect(await removeProtest(db, protest.id)).toBe(true);
    expect(await listProtests(db)).toEqual([]);
    expect((await getPlayer(db, ana.id))?.level).toBe("novice");
    expect((await levelHistory(db, ana.id))[0].protestId).toBeNull();
    expect(await removeProtest(db, protest.id)).toBe(false);
    expect(await removeProtest(db, "junk")).toBe(false);
  });
});
