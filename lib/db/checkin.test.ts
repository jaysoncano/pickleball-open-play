import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import {
  PairRegistrationSchema,
  PublicSignupSchema,
  UnpaidPairSchema,
} from "@/lib/registration/forms";
import type { OpenPlayInput } from "@/lib/registration/open-play";
import {
  confirmPairPayment,
  createAdmin,
  createOpenPlay,
  listRegistrations,
  managedPlayerIds,
  paidPairs,
  registerPair,
  rosterPairs,
  setCheckIn,
  signUpPair,
  type Db,
} from "./queries";
import * as schema from "./schema";

let db: Db;
let host: string;
let op: string;

const play = (over: Partial<OpenPlayInput> = {}): OpenPlayInput => ({
  venue: "Sunrise Courts",
  location: "Makati",
  playDate: "2026-10-27",
  startTime: "18:00",
  endTime: "20:00",
  levels: ["beginner", "novice"],
  maxPairs: null,
  feeCents: 30000,
  ...over,
});

const person = (name: string, email = `${name.toLowerCase()}@x.co`) => ({
  name,
  firstName: name,
  lastName: "Full",
  email,
});

const unpaid = (a: object, b: object, openPlayId = op) =>
  UnpaidPairSchema.parse({ openPlayId, a, b });

async function ok<T>(p: Promise<T | { error: string }>): Promise<T> {
  const r = await p;
  if (r && typeof r === "object" && "error" in r) throw new Error(r.error);
  return r as T;
}

beforeEach(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: "supabase/migrations" });
  db = pg;
  const made = await createAdmin(db, "hana", "h", "host");
  host = "id" in made ? made.id : "";
  op = await createOpenPlay(db, play(), host);
});

describe("unpaid pairs and check-in", () => {
  it("registers a pair to pay later, then checks them in", async () => {
    const r = await ok(registerPair(db, unpaid(person("Ana"), person("Ben"))));
    const [ana, ben] = r.players;
    const day = await listRegistrations(db, op);
    expect(day.pairs).toEqual([]);
    expect(day.pending[0].members.map((m) => m.checkedIn)).toEqual([
      false,
      false,
    ]);
    expect(await paidPairs(db, op)).toEqual([]);

    expect(await setCheckIn(db, op, ana.id, true)).toBe(true);
    expect(await rosterPairs(db, op)).toEqual([
      {
        id: r.pairId,
        name: "Ana & Ben",
        skill: 0,
        blocked: null,
        paid: false,
        members: [
          { id: ana.id, name: "Ana", checkedIn: true },
          { id: ben.id, name: "Ben", checkedIn: false },
        ],
      },
    ]);

    await ok(
      confirmPairPayment(db, {
        pairId: r.pairId!,
        amountCents: 30000,
        method: "cash",
        reference: "",
      }),
    );
    await setCheckIn(db, op, ben.id, true);
    expect(await paidPairs(db, op)).toMatchObject([
      {
        paid: true,
        members: [{ checkedIn: true }, { checkedIn: true }],
      },
    ]);
    // Undo, and unknown players.
    await setCheckIn(db, op, ben.id, false);
    expect((await paidPairs(db, op))[0].members[1].checkedIn).toBe(false);
    expect(await setCheckIn(db, op, "junk", true)).toBe(false);
    expect(
      await setCheckIn(db, op, "00000000-0000-4000-8000-000000000000", true),
    ).toBe(false);
  });

  it("refuses an unpaid pair the same way as a paid one", async () => {
    await ok(registerPair(db, unpaid(person("Ana"), person("Ben"))));
    expect(await registerPair(db, unpaid(person("Ana"), person("Cy")))).toEqual(
      { error: "Ana is already signed up for this open play" },
    );
  });
});

describe("players shared across open plays", () => {
  it("links a returning player by email, at the desk and online", async () => {
    const first = await ok(
      registerPair(
        db,
        PairRegistrationSchema.parse({
          openPlayId: op,
          amount: "300",
          method: "cash",
          a: person("Ana"),
          b: person("Ben"),
        }),
      ),
    );
    const other = await createOpenPlay(
      db,
      play({ startTime: "06:00", endTime: "08:00" }),
    );
    // At another open play, typed with another name: same player.
    const desk = await ok(
      registerPair(
        db,
        unpaid(person("Annie", "ana@x.co"), person("Cy"), other),
      ),
    );
    expect(desk.players[0]).toMatchObject({
      id: first.players[0].id,
      name: "Ana",
    });
    const third = await createOpenPlay(
      db,
      play({ startTime: "09:00", endTime: "11:00" }),
    );
    const online = await ok(
      signUpPair(
        db,
        PublicSignupSchema.parse({
          openPlayId: third,
          rank: "beginner",
          a: person("Benjamin", "ben@x.co"),
          b: person("Dee"),
        }),
      ),
    );
    expect(online.names).toEqual(["Ben", "Dee"]);
    expect(
      (await listRegistrations(db, third)).pending[0].members[0].playerId,
    ).toBe(first.players[1].id);
  });

  it("lists the players of a host's open plays", async () => {
    const r = await ok(registerPair(db, unpaid(person("Ana"), person("Ben"))));
    const elsewhere = await createOpenPlay(
      db,
      play({ startTime: "06:00", endTime: "08:00" }),
    );
    await ok(registerPair(db, unpaid(person("Cy"), person("Dee"), elsewhere)));
    expect((await managedPlayerIds(db, host)).sort()).toEqual(
      r.players.map((p) => p.id).sort(),
    );
  });
});
