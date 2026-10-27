import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import { ProfileSchema } from "@/lib/profile/forms";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS } from "@/lib/profile/verify";
import {
  checkEmailCode,
  ensurePlayers,
  getPhoto,
  getPlayer,
  getPlayerPrivate,
  issueEmailCode,
  listClaimTokens,
  listPlayers,
  playerByClaimToken,
  regenerateClaimToken,
  removePhoto,
  savePhoto,
  updateProfile,
  type Db,
} from "./queries";
import * as schema from "./schema";

const NOW = new Date(2026, 9, 27, 18, 0);
const MIN = 60_000;
const MISSING = "00000000-0000-4000-8000-000000000000";
const at = (ms: number) => new Date(NOW.getTime() + ms);

let db: Db;
let ana: string;
let ben: string;

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  [{ id: ana }, { id: ben }] = await ensurePlayers(db, ["Ana", "Ben"]);
});

const req = (over: Partial<Parameters<typeof issueEmailCode>[1]> = {}) => ({
  playerId: ana,
  email: "ana@x.co",
  codeHash: "hash-1",
  now: NOW,
  ...over,
});

describe("claim tokens", () => {
  it("finds a player by QR token and voids it when regenerated", async () => {
    const [row] = (await listClaimTokens(db)).filter((r) => r.id === ana);
    expect(await playerByClaimToken(db, row.claimToken)).toEqual({
      id: ana,
      name: "Ana",
      email: null,
    });
    const fresh = await regenerateClaimToken(db, ana);
    expect(fresh).not.toBe(row.claimToken);
    expect(await playerByClaimToken(db, row.claimToken)).toBeNull();
    expect((await playerByClaimToken(db, fresh!))?.id).toBe(ana);
    expect(await regenerateClaimToken(db, MISSING)).toBeNull();
  });

  it("reports setup progress and filters by id", async () => {
    await issueEmailCode(db, req());
    await checkEmailCode(db, req());
    await savePhoto(db, ana, "image/png", new Uint8Array([1]));
    expect(await listClaimTokens(db, [ana])).toEqual([
      expect.objectContaining({
        id: ana,
        hasEmail: true,
        hasPhoto: true,
      }),
    ]);
    expect((await listClaimTokens(db, [ben]))[0]).toMatchObject({
      hasEmail: false,
      hasPhoto: false,
    });
    expect(await listClaimTokens(db, [])).toEqual([]);
  });

  it("gives each player a different token", async () => {
    const tokens = (await listClaimTokens(db)).map((r) => r.claimToken);
    expect(new Set(tokens).size).toBe(2);
  });
});

describe("email codes", () => {
  it("links the email the first time a code is verified", async () => {
    expect(await issueEmailCode(db, req())).toBeNull();
    expect(await checkEmailCode(db, req({ now: at(MIN) }))).toBeNull();
    expect((await getPlayerPrivate(db, ana))?.email).toBe("ana@x.co");
    // Used up.
    expect(await checkEmailCode(db, req({ now: at(MIN) }))).toMatch(/expired/);
  });

  it("refuses unknown players, other emails, and taken emails", async () => {
    expect(await issueEmailCode(db, req({ playerId: MISSING }))).toBe(
      "Player not found",
    );
    await issueEmailCode(db, req());
    await checkEmailCode(db, req());
    expect(
      await issueEmailCode(db, req({ email: "new@x.co", now: at(5 * MIN) })),
    ).toMatch(/linked to a•••••\. Use that email/);
    expect(await issueEmailCode(db, req({ playerId: ben }))).toBe(
      "That email is linked to another player",
    );
  });

  it("waits a minute between codes and keeps only the newest", async () => {
    await issueEmailCode(db, req());
    expect(await issueEmailCode(db, req({ now: at(30_000) }))).toMatch(
      /Wait a minute/,
    );
    expect(
      await issueEmailCode(db, req({ codeHash: "hash-2", now: at(MIN) })),
    ).toBeNull();
    expect(await checkEmailCode(db, req({ now: at(MIN) }))).toMatch(/Wrong/);
    expect(
      await checkEmailCode(db, req({ codeHash: "hash-2", now: at(MIN) })),
    ).toBeNull();
  });

  it("expires codes", async () => {
    await issueEmailCode(db, req());
    expect(await checkEmailCode(db, req({ now: at(CODE_TTL_MS) }))).toMatch(
      /expired/,
    );
  });

  it("counts wrong tries and locks after the limit", async () => {
    await issueEmailCode(db, req());
    const wrong = req({ codeHash: "nope" });
    expect(await checkEmailCode(db, wrong)).toBe("Wrong code. 4 tries left.");
    for (let i = 2; i < CODE_MAX_ATTEMPTS - 1; i++) {
      await checkEmailCode(db, wrong);
    }
    expect(await checkEmailCode(db, wrong)).toBe("Wrong code. 1 try left.");
    expect(await checkEmailCode(db, wrong)).toMatch(/Too many/);
    expect(await checkEmailCode(db, req())).toMatch(/Too many/);
  });

  it("refuses a code if another player took the email meanwhile", async () => {
    await issueEmailCode(db, req());
    await issueEmailCode(db, req({ playerId: ben }));
    await checkEmailCode(db, req({ playerId: ben }));
    expect(await checkEmailCode(db, req())).toBe(
      "That email is linked to another player",
    );
  });
});

describe("updateProfile", () => {
  const info = ProfileSchema.parse({
    firstName: "Ana",
    lastName: "Dela Cruz",
    email: "ana@x.co",
    homeClub: "Riverside",
    bio: "Dinks all day",
    hand: "left",
    phone: "0917 123 4567",
  });

  it("saves public info and private contact details", async () => {
    expect(await updateProfile(db, ana, info)).toBeNull();
    expect(await getPlayer(db, ana)).toMatchObject({
      firstName: "Ana",
      lastName: "Dela Cruz",
      fullName: "Ana Dela Cruz",
      homeClub: "Riverside",
      bio: "Dinks all day",
      hand: "left",
    });
    expect(await getPlayer(db, ana)).not.toHaveProperty("email");
    expect(await getPlayerPrivate(db, ana)).toMatchObject({
      email: "ana@x.co",
      phone: "0917 123 4567",
      claimToken: expect.any(String),
    });
    expect((await listPlayers(db))[0].fullName).toBe("Ana Dela Cruz");
  });

  it("refuses another player's email and unknown players", async () => {
    await updateProfile(db, ana, info);
    expect(await updateProfile(db, ben, info)).toBe(
      "That email is linked to another player",
    );
    expect(await updateProfile(db, MISSING, { ...info, email: "z@x.co" })).toBe(
      "Player not found",
    );
    expect(await getPlayerPrivate(db, MISSING)).toBeNull();
  });
});

describe("photos", () => {
  it("saves, replaces, and removes a photo", async () => {
    expect(await getPhoto(db, ana)).toBeNull();
    expect(
      await savePhoto(db, ana, "image/png", new Uint8Array([1, 2]), NOW),
    ).toBe(true);
    expect((await getPlayer(db, ana))?.photoUpdatedAt).toEqual(NOW);
    await savePhoto(db, ana, "image/webp", new Uint8Array([3]), at(MIN));
    const photo = await getPhoto(db, ana);
    expect(photo?.mime).toBe("image/webp");
    expect([...photo!.data]).toEqual([3]);
    await removePhoto(db, ana);
    expect(await getPhoto(db, ana)).toBeNull();
    expect((await getPlayer(db, ana))?.photoUpdatedAt).toBeNull();
  });

  it("refuses unknown players", async () => {
    expect(await savePhoto(db, MISSING, "image/png", new Uint8Array([1]))).toBe(
      false,
    );
  });
});

describe("email confirmation", () => {
  const info = (email: string) =>
    ProfileSchema.parse({ firstName: "Ana", lastName: "Cruz", email });

  it("is set by a code check and kept while the email stays", async () => {
    await issueEmailCode(db, req());
    await checkEmailCode(db, req({ now: at(MIN) }));
    expect((await getPlayerPrivate(db, ana))?.emailConfirmedAt).toEqual(
      at(MIN),
    );
    await updateProfile(db, ana, info("ana@x.co"));
    expect((await getPlayerPrivate(db, ana))?.emailConfirmedAt).toEqual(
      at(MIN),
    );
  });

  it("starts unconfirmed when an admin types an email, until a code", async () => {
    await updateProfile(db, ben, info("ben@x.co"));
    const [row] = await listClaimTokens(db, [ben]);
    expect(row).toMatchObject({ hasEmail: true, emailConfirmed: false });
    // Returning-player flow: the code goes to the typed email.
    const r = req({ playerId: ben, email: "ben@x.co" });
    expect(await issueEmailCode(db, r)).toBeNull();
    expect(await checkEmailCode(db, r)).toBeNull();
    expect((await listClaimTokens(db, [ben]))[0].emailConfirmed).toBe(true);
    // Changing it again clears the confirmation.
    await updateProfile(db, ben, info("ben2@x.co"));
    expect((await getPlayerPrivate(db, ben))?.emailConfirmedAt).toBeNull();
  });
});
