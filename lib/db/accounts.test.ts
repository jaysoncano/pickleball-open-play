import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import {
  adminByUsername,
  countAdmins,
  createAdmin,
  ensurePlayers,
  getAdmin,
  getPlayerPrivate,
  listAdmins,
  playerByUsername,
  removeAdmin,
  setAdminPassword,
  setAdminRole,
  setPlayerLogin,
  type Db,
} from "./queries";
import * as schema from "./schema";

let db: Db;

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
});

describe("admin accounts", () => {
  it("creates, finds, lists, and changes passwords", async () => {
    expect(await countAdmins(db)).toBe(0);
    const made = await createAdmin(db, "boss", "hash-1");
    if ("error" in made) throw new Error(made.error);
    expect(await createAdmin(db, "boss", "x")).toEqual({
      error: "The username boss is taken",
    });
    expect(await adminByUsername(db, "boss")).toMatchObject({
      id: made.id,
      passwordHash: "hash-1",
    });
    expect(await adminByUsername(db, "nobody")).toBeNull();
    await setAdminPassword(db, made.id, "hash-2");
    expect((await getAdmin(db, made.id))?.passwordHash).toBe("hash-2");
    expect(await getAdmin(db, "junk")).toBeNull();
    expect((await listAdmins(db)).map((a) => a.username)).toEqual(["boss"]);
  });

  it("creates hosts and changes levels, keeping one admin", async () => {
    const boss = await createAdmin(db, "boss", "h");
    const hana = await createAdmin(db, "hana", "h", "host");
    if ("error" in boss || "error" in hana) throw new Error("not made");
    expect(await getAdmin(db, hana.id)).toMatchObject({ role: "host" });
    expect((await listAdmins(db)).map((a) => [a.username, a.role])).toEqual([
      ["boss", "admin"],
      ["hana", "host"],
    ]);
    expect(await setAdminRole(db, boss.id, "host")).toBe(
      "Keep at least one admin",
    );
    expect(await removeAdmin(db, boss.id)).toBe("Keep at least one admin");
    expect(await setAdminRole(db, hana.id, "admin")).toBeNull();
    expect(await setAdminRole(db, boss.id, "host")).toBeNull();
    expect(await adminByUsername(db, "boss")).toMatchObject({ role: "host" });
    // Hosts can always go; they never count toward the last admin.
    expect(await removeAdmin(db, boss.id)).toBeNull();
  });

  it("keeps at least one admin", async () => {
    const a = await createAdmin(db, "a1", "h");
    await createAdmin(db, "a2", "h");
    const id = "id" in a ? a.id : "";
    expect(await removeAdmin(db, id)).toBeNull();
    const [last] = await listAdmins(db);
    expect(await removeAdmin(db, last.id)).toBe("Keep at least one admin");
  });
});

describe("player sign-in", () => {
  it("sets a username and password, unique across players", async () => {
    const [ana, ben] = await ensurePlayers(db, ["Ana", "Ben"]);
    expect(await setPlayerLogin(db, ana.id, "ana", "hash")).toBeNull();
    expect(await playerByUsername(db, "ana")).toMatchObject({
      id: ana.id,
      passwordHash: "hash",
    });
    expect(await getPlayerPrivate(db, ana.id)).toMatchObject({
      username: "ana",
      hasPassword: true,
    });
    expect(await setPlayerLogin(db, ben.id, "ana", "h")).toBe(
      "The username ana is taken",
    );
    // Rename without changing the password.
    expect(await setPlayerLogin(db, ana.id, "ana2", null)).toBeNull();
    expect((await playerByUsername(db, "ana2"))?.passwordHash).toBe("hash");
    expect(await playerByUsername(db, "ana")).toBeNull();
    expect(
      await setPlayerLogin(
        db,
        "00000000-0000-4000-8000-000000000000",
        "zed",
        "h",
      ),
    ).toBe("Player not found");
  });
});
