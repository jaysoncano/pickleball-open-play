import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { SoloRegistrationSchema } from "@/lib/registration/forms";
import type { OpenPlayInput } from "@/lib/registration/open-play";
import {
  createAdmin,
  createOpenPlay,
  ensurePlayers,
  inviteHost,
  listOpenPlayHosts,
  listOpenPlays,
  openPlayManagers,
  pairOpenPlayId,
  playerInManagedOpenPlay,
  registerSolo,
  removeAdmin,
  removeHost,
  venueSuggestions,
  type Db,
} from "./queries";
import * as schema from "./schema";

const MISSING = "00000000-0000-4000-8000-000000000000";
let db: Db;
let boss: string;
let hana: string;
let ivan: string;

const play = (over: Partial<OpenPlayInput> = {}): OpenPlayInput => ({
  kind: "ranked",
  venue: "Sunrise Courts",
  location: "Makati",
  playDate: "2026-10-27",
  startTime: "18:00",
  endTime: "20:00",
  levels: ["beginner"],
  maxPairs: null,
  feeCents: 0,
  ...over,
});

async function account(name: string, role: "admin" | "host") {
  const made = await createAdmin(db, name, "h", role);
  if ("error" in made) throw new Error(made.error);
  return made.id;
}

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  boss = await account("boss", "admin");
  hana = await account("hana", "host");
  ivan = await account("ivan", "host");
});

describe("open play hosts", () => {
  it("lists only the open plays an account created or was invited to", async () => {
    const mine = await createOpenPlay(db, play(), hana);
    const theirs = await createOpenPlay(db, play({ startTime: "06:00" }), ivan);
    const ids = async (adminId?: string) =>
      (await listOpenPlays(db, { managedBy: adminId })).map((p) => p.id);

    expect(await ids(hana)).toEqual([mine]);
    expect(await ids(ivan)).toEqual([theirs]);
    expect(await ids(boss)).toEqual([]);
    expect(await ids()).toEqual([theirs, mine]);

    expect(await inviteHost(db, mine, "ivan")).toEqual({ added: "ivan" });
    expect(await ids(ivan)).toEqual([theirs, mine]);
    expect((await listOpenPlays(db, {}))[1]).toMatchObject({
      venue: "Sunrise Courts",
      location: "Makati",
      createdBy: hana,
    });
  });

  it("invites by username, once, and removes invited hosts", async () => {
    const id = await createOpenPlay(db, play(), hana);
    expect(await inviteHost(db, id, "nobody")).toEqual({
      error: "No account is named nobody",
    });
    expect(await inviteHost(db, id, "hana")).toEqual({
      error: "hana already hosts this open play",
    });
    expect(await inviteHost(db, MISSING, "ivan")).toEqual({
      error: "Open play not found",
    });
    expect(await inviteHost(db, id, "ivan")).toEqual({ added: "ivan" });
    expect(await inviteHost(db, id, "ivan")).toEqual({
      error: "ivan already hosts this open play",
    });
    expect(await inviteHost(db, id, "boss")).toEqual({ added: "boss" });

    expect(await listOpenPlayHosts(db, id)).toEqual([
      { id: hana, username: "hana", role: "host", owner: true },
      { id: boss, username: "boss", role: "admin", owner: false },
      { id: ivan, username: "ivan", role: "host", owner: false },
    ]);
    expect(await openPlayManagers(db, id)).toEqual({
      createdBy: hana,
      hostIds: expect.arrayContaining([boss, ivan]),
    });

    await removeHost(db, id, ivan);
    expect((await listOpenPlayHosts(db, id)).map((h) => h.username)).toEqual([
      "hana",
      "boss",
    ]);
    expect(await listOpenPlayHosts(db, "junk")).toEqual([]);
    expect(await openPlayManagers(db, "junk")).toBeNull();
    expect(await openPlayManagers(db, MISSING)).toBeNull();
  });

  it("keeps the open play when its creator's account is removed", async () => {
    const id = await createOpenPlay(db, play(), hana);
    await inviteHost(db, id, "ivan");
    expect(await removeAdmin(db, hana)).toBeNull();
    expect(await openPlayManagers(db, id)).toEqual({
      createdBy: null,
      hostIds: [ivan],
    });
    expect(await listOpenPlayHosts(db, id)).toEqual([
      { id: ivan, username: "ivan", role: "host", owner: false },
    ]);
  });

  it("finds a pair's open play and the hosts a player signed up with", async () => {
    const id = await createOpenPlay(db, play(), hana);
    const [ana] = await ensurePlayers(db, ["Ana"]);
    expect(await playerInManagedOpenPlay(db, ana.id, hana)).toBe(false);
    const solo = await registerSolo(
      db,
      SoloRegistrationSchema.parse({
        openPlayId: id,
        a: {
          playerId: ana.id,
          firstName: "Ana",
          lastName: "Cruz",
          email: "ana@x.co",
        },
      }),
    );
    if ("error" in solo) throw new Error(solo.error);
    expect(await playerInManagedOpenPlay(db, ana.id, hana)).toBe(true);
    expect(await playerInManagedOpenPlay(db, ana.id, ivan)).toBe(false);
    await inviteHost(db, id, "ivan");
    expect(await playerInManagedOpenPlay(db, ana.id, ivan)).toBe(true);
    expect(await playerInManagedOpenPlay(db, "junk", ivan)).toBe(false);
    expect(await pairOpenPlayId(db, MISSING)).toBeNull();
    expect(await pairOpenPlayId(db, "junk")).toBeNull();
  });
});

/** Let the clock move so each open play gets a later `created_at`. */
const later = () => new Promise((r) => setTimeout(r, 5));

describe("venue suggestions", () => {
  it("offers each venue once, newest first, scoped to the account", async () => {
    const made: [string, string, string | null][] = [
      ["Old Gym", "Pasig", hana],
      ["sunrise courts", "BGC", hana],
      ["Sunrise Courts", "Makati", hana],
      ["Ivan's Club", "QC", ivan],
      ["", "", null],
    ];
    for (const [venue, location, by] of made) {
      await later();
      await createOpenPlay(db, play({ venue, location }), by);
    }

    expect(await venueSuggestions(db, { managedBy: hana })).toEqual([
      { venue: "Sunrise Courts", location: "Makati" },
      { venue: "Old Gym", location: "Pasig" },
    ]);
    expect((await venueSuggestions(db)).map((v) => v.venue)).toEqual([
      "Ivan's Club",
      "Sunrise Courts",
      "Old Gym",
    ]);
  });
});
