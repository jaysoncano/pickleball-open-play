import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { OpenPlayInput } from "@/lib/registration/open-play";
import {
  adminByEmail,
  checkAccountCode,
  createAdmin,
  createHostSignup,
  createOpenPlay,
  getAdmin,
  getBanner,
  getGroup,
  getGroupLogo,
  getOpenPlay,
  inviteHost,
  issueAccountCode,
  listAdmins,
  listOpenPlayInvites,
  listOpenPlays,
  openPlayManagers,
  removeBanner,
  removeGroupLogo,
  removeInvite,
  saveBanner,
  saveGroupLogo,
  setGroupName,
  setVenue,
  type Db,
} from "./queries";
import * as schema from "./schema";

let db: Db;
let boss: string;

const play: OpenPlayInput = {
  kind: "ranked",
  venue: "Sunrise Courts",
  location: "Makati",
  playDate: "2026-10-27",
  startTime: "18:00",
  endTime: "20:00",
  levels: ["beginner"],
  maxPairs: null,
  feeCents: 0,
};

const signup = (over: Partial<Parameters<typeof createHostSignup>[1]> = {}) =>
  createHostSignup(db, {
    email: "hana@x.co",
    username: "hana",
    passwordHash: "h",
    groupName: "Makati Dinkers",
    ...over,
  });

async function made(p: Promise<{ id: string } | { error: string }>) {
  const r = await p;
  if ("error" in r) throw new Error(r.error);
  return r.id;
}

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  boss = await made(createAdmin(db, "boss", "h"));
});

const T0 = new Date("2026-10-27T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("host sign-up", () => {
  it("creates an unverified host until the emailed code checks out", async () => {
    const id = await made(signup());
    expect(await getAdmin(db, id)).toMatchObject({
      role: "host",
      email: "hana@x.co",
      verified: false,
      groupName: "Makati Dinkers",
    });
    expect(await getAdmin(db, boss)).toMatchObject({ verified: true });

    expect(await checkAccountCode(db, { adminId: id, codeHash: "c1" })).toBe(
      "That code expired. Send a new one.",
    );
    expect(
      await issueAccountCode(db, { adminId: id, codeHash: "c1", now: T0 }),
    ).toBeNull();
    expect(
      await issueAccountCode(db, { adminId: id, codeHash: "c2", now: at(5) }),
    ).toBe("A code was just sent. Wait a minute before asking again.");
    expect(
      await checkAccountCode(db, { adminId: id, codeHash: "x", now: at(10) }),
    ).toBe("Wrong code. 4 tries left.");
    expect(
      await checkAccountCode(db, { adminId: id, codeHash: "c1", now: at(20) }),
    ).toBeNull();
    expect((await adminByEmail(db, "hana@x.co"))?.verified).toBe(true);
    expect(
      (await listAdmins(db)).find((a) => a.username === "hana"),
    ).toMatchObject({ verified: true, groupName: "Makati Dinkers" });
  });

  it("expires codes and stops after too many tries", async () => {
    const id = await made(signup());
    await issueAccountCode(db, { adminId: id, codeHash: "c", now: T0 });
    expect(
      await checkAccountCode(db, {
        adminId: id,
        codeHash: "c",
        now: at(11 * 60_000),
      }),
    ).toBe("That code expired. Send a new one.");
    await issueAccountCode(db, { adminId: id, codeHash: "c", now: at(2e5) });
    for (let i = 0; i < 4; i++) {
      await checkAccountCode(db, { adminId: id, codeHash: "x", now: at(2e5) });
    }
    expect(
      await checkAccountCode(db, { adminId: id, codeHash: "x", now: at(2e5) }),
    ).toBe("Too many tries. Send a new code.");
    expect(
      await checkAccountCode(db, { adminId: id, codeHash: "c", now: at(2e5) }),
    ).toBe("Too many tries. Send a new code.");
  });

  it("replaces an unverified sign-up, refuses a verified email or taken name", async () => {
    const first = await made(signup());
    const again = await made(signup({ username: "hana2" }));
    expect(again).not.toBe(first);
    expect(await getAdmin(db, first)).toBeNull();
    expect(await signup({ email: "new@x.co", username: "boss" })).toEqual({
      error: "The username boss is taken",
    });
    await issueAccountCode(db, { adminId: again, codeHash: "c", now: T0 });
    await checkAccountCode(db, { adminId: again, codeHash: "c", now: T0 });
    expect(await signup({ username: "hana3" })).toEqual({
      error: "That email already has an account. Sign in instead.",
    });
  });
});

describe("email invitations", () => {
  it("invites an email, then makes them a host when they verify", async () => {
    const id = await createOpenPlay(db, play, boss);
    expect(await inviteHost(db, id, "hana@x.co", boss)).toEqual({
      invited: "hana@x.co",
    });
    expect(await inviteHost(db, id, "cy@x.co", boss)).toEqual({
      invited: "cy@x.co",
    });
    expect(await listOpenPlayInvites(db, id)).toEqual(["cy@x.co", "hana@x.co"]);
    await removeInvite(db, id, "cy@x.co");
    expect(await listOpenPlayInvites(db, id)).toEqual(["hana@x.co"]);
    expect(await listOpenPlayInvites(db, "junk")).toEqual([]);

    const hana = await made(signup());
    // Unverified accounts don't join by email yet; the invite waits.
    expect(await inviteHost(db, id, "hana@x.co", boss)).toEqual({
      invited: "hana@x.co",
    });
    await issueAccountCode(db, { adminId: hana, codeHash: "c", now: T0 });
    await checkAccountCode(db, { adminId: hana, codeHash: "c", now: T0 });
    expect((await openPlayManagers(db, id))?.hostIds).toEqual([hana]);
    expect(await listOpenPlayInvites(db, id)).toEqual([]);
    // Once verified, inviting by email adds the account directly.
    const other = await createOpenPlay(
      db,
      { ...play, startTime: "06:00" },
      boss,
    );
    expect(await inviteHost(db, other, "hana@x.co", boss)).toEqual({
      added: "hana",
    });
  });
});

describe("host groups", () => {
  it("names the group and stores its logo, shown on its open plays", async () => {
    const id = await createOpenPlay(db, play, boss);
    expect(await getOpenPlay(db, id)).toMatchObject({
      groupName: "",
      groupLogoUpdatedAt: null,
    });
    await setGroupName(db, boss, "POP Club");
    await saveGroupLogo(db, boss, "image/png", new Uint8Array([1, 2]), T0);
    await saveGroupLogo(db, boss, "image/webp", new Uint8Array([3]), T0);
    expect(await getOpenPlay(db, id)).toMatchObject({
      groupName: "POP Club",
      groupLogoUpdatedAt: T0,
    });
    expect(await getGroupLogo(db, boss)).toEqual({
      mime: "image/webp",
      data: new Uint8Array([3]),
    });
    await removeGroupLogo(db, boss);
    expect(await getGroupLogo(db, boss)).toBeNull();
    expect(await getGroupLogo(db, "junk")).toBeNull();
    expect((await getAdmin(db, boss))?.logoUpdatedAt).toBeNull();
    expect((await getOpenPlay(db, id))?.groupLogoUpdatedAt).toBeNull();
  });

  it("has a public profile listing only the open plays it scheduled", async () => {
    const other = await createAdmin(db, "ivan", "h", "host");
    if ("error" in other) throw new Error(other.error);
    const mine = await createOpenPlay(db, play, boss);
    await createOpenPlay(db, play, other.id);
    await setGroupName(db, boss, "POP Club");
    expect(await getGroup(db, boss)).toEqual({
      id: boss,
      name: "POP Club",
      logoUpdatedAt: null,
    });
    expect(await getGroup(db, "junk")).toBeNull();
    expect(
      await getGroup(db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    const hosted = await listOpenPlays(db, { hostedBy: boss });
    expect(hosted.map((p) => p.id)).toEqual([mine]);
  });

  it("stores an open play's banner until removed", async () => {
    const id = await createOpenPlay(db, play, boss);
    expect((await getOpenPlay(db, id))?.bannerUpdatedAt).toBeNull();
    await saveBanner(db, id, "image/png", new Uint8Array([1]), T0);
    await saveBanner(db, id, "image/webp", new Uint8Array([2]), T0);
    expect((await getOpenPlay(db, id))?.bannerUpdatedAt).toEqual(T0);
    expect(await getBanner(db, id)).toEqual({
      mime: "image/webp",
      data: new Uint8Array([2]),
    });
    await removeBanner(db, id);
    expect(await getBanner(db, id)).toBeNull();
    expect(await getBanner(db, "junk")).toBeNull();
    expect((await getOpenPlay(db, id))?.bannerUpdatedAt).toBeNull();
  });

  it("changes an open play's venue and location", async () => {
    const id = await createOpenPlay(db, { ...play, venue: "", location: "" });
    await setVenue(db, id, { venue: "Dink Hub", location: "Pasig" });
    expect(await getOpenPlay(db, id)).toMatchObject({
      venue: "Dink Hub",
      location: "Pasig",
    });
  });
});
