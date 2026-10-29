import { describe, expect, it } from "vitest";
import {
  emailLinkToken,
  playerToken,
  readEmailLinkToken,
  readPlayerToken,
} from "@/lib/profile/verify";
import {
  ConfirmPaymentSchema,
  feeCents,
  formatMoney,
  nestForm,
  openPlayFee,
  pairLevel,
  pairName,
  GuestPairSchema,
  PairRegistrationSchema,
  RegistrationNameSchema,
  PairUpSchema,
  PublicSignupSchema,
  PublicSoloSchema,
} from "./forms";
import { notReady, pickRegistered } from "./gate";

const a = {
  name: " Ana   C. ",
  firstName: "Ana",
  lastName: "Cruz",
  email: "Ana@X.co",
};
const b = {
  playerId: "p2",
  firstName: "Ben",
  lastName: "Uy",
  email: "ben@x.co",
};
const OP = "6d2f4a8e-9c1b-4e7a-8b3d-2f1e0c9a7b65";
const day = { openPlayId: OP, a, b };
const entry = { amount: "300", method: "cash" };

describe("PairRegistrationSchema", () => {
  it("takes one entry for both, normalizing names and emails", () => {
    expect(
      PairRegistrationSchema.parse({ ...day, ...entry, notes: "R1" }),
    ).toEqual({
      openPlayId: OP,
      a: {
        playerId: "",
        name: "Ana C.",
        firstName: "Ana",
        lastName: "Cruz",
        email: "ana@x.co",
      },
      b: {
        playerId: "p2",
        name: "",
        firstName: "Ben",
        lastName: "Uy",
        email: "ben@x.co",
      },
      amountCents: 30000,
      method: "cash",
      notes: "R1",
    });
  });

  it.each([
    [
      { ...day, ...entry, a: { ...a, name: "" } },
      "Pick a player or enter a new name",
    ],
    [
      { ...day, ...entry, b: { ...b, email: "ana@x.co" } },
      "Pick two different players with different emails",
    ],
    [{ ...day, ...entry, openPlayId: "soon" }, "Pick an open play"],
    [{ ...day, method: "cash" }, "Enter the amount paid"],
    [{ ...day, ...entry, amount: "-1" }, "Amount can't be negative"],
    [{ ...day, ...entry, method: "iou" }, "Pick how they paid"],
    [{ ...day, ...entry, amount: "999999" }, "That amount looks too high"],
  ])("rejects %j", (input, message) => {
    const r = PairRegistrationSchema.safeParse(input);
    expect(r.error?.issues[0].message).toBe(message);
  });
});

describe("PairUpSchema and helpers", () => {
  const up = { openPlayId: OP, ...entry };

  it("pairs two different solo players with the full entry", () => {
    expect(
      PairUpSchema.parse({
        ...up,
        a: { playerId: "p1" },
        b: { playerId: "p2" },
      }),
    ).toMatchObject({ amountCents: 30000, a: { playerId: "p1" } });
    expect(
      PairUpSchema.safeParse({
        ...up,
        a: { playerId: "p1" },
        b: { playerId: "p1" },
      }).error?.issues[0].message,
    ).toBe("Pick two different players");
  });

  it("nests a_/b_ form fields and names pairs", () => {
    expect(
      nestForm([
        ["a_name", "Ana"],
        ["b_email", "b@x.co"],
        ["playDate", "d"],
      ]),
    ).toEqual({ a: { name: "Ana" }, b: { email: "b@x.co" }, playDate: "d" });
    expect(pairName(["Ana", "Ben"])).toBe("Ana & Ben");
    expect(pairLevel(["novice", "advanced"])).toBe("advanced");
    expect(pairLevel([])).toBe("beginner");
  });
});

describe("money", () => {
  it("formats minor units in the currency", () => {
    expect(formatMoney(15000, "PHP")).toBe("₱150.00");
    expect(formatMoney(250, "USD")).toBe("$2.50");
    expect(formatMoney(100, "nope!")).toBe("nope! 1.00");
  });

  it("reads fee and currency from env", () => {
    expect(openPlayFee({ OPEN_PLAY_FEE: "200", CURRENCY: "USD" })).toEqual({
      cents: 20000,
      currency: "USD",
    });
    expect(openPlayFee({})).toEqual({ cents: 0, currency: "PHP" });
  });

  it("reads the default fee", () => {
    expect(feeCents("150")).toBe(15000);
    expect(feeCents(undefined)).toBe(0);
    expect(feeCents("-5")).toBe(0);
    expect(feeCents("abc")).toBe(0);
  });
});

describe("email link tokens", () => {
  const s = { playerId: "p1", email: "a@x.co", exp: 100 };

  it("round-trips and can't be used as a cookie (or the other way)", () => {
    const link = emailLinkToken("k", s);
    expect(readEmailLinkToken("k", link, 99)).toEqual(s);
    expect(readEmailLinkToken("k", link, 100)).toBeNull();
    expect(readPlayerToken("k", link, 0)).toBeNull();
    expect(readEmailLinkToken("k", playerToken("k", s), 0)).toBeNull();
  });
});

describe("pickRegistered", () => {
  const day = [
    { id: "a", name: "Ana" },
    { id: "b", name: "Ben" },
  ];

  it("keeps request order, drops repeats, counts the unregistered", () => {
    expect(pickRegistered(day, ["b", "x", "a", "b"])).toEqual({
      players: [day[1], day[0]],
      unregistered: 1,
    });
    expect(pickRegistered(day, [])).toEqual({ players: [], unregistered: 0 });
  });
});

describe("online sign-up and confirmation forms", () => {
  const p = (name: string, email: string) => ({
    name: ` ${name}  X `,
    firstName: name,
    lastName: "Web",
    email,
  });

  it("parses a public pair sign-up for a rank", () => {
    const r = PublicSignupSchema.parse({
      openPlayId: OP,
      rank: "novice",
      a: p("Kim", "Kim@Web.co"),
      b: p("Lee", "lee@web.co"),
    });
    expect(r.rank).toBe("novice");
    expect(r.a).toEqual({
      name: "Kim X",
      firstName: "Kim",
      lastName: "Web",
      email: "kim@web.co",
      playerId: "",
    });
  });

  it.each([
    [{ rank: "legend" }, "Pick a level"],
    [
      { b: p("Lee", "kim@web.co") },
      "Enter two different players with different emails",
    ],
    [{ a: { ...p("Kim", "kim@web.co"), name: "" } }, "Enter a name"],
  ])("rejects %j", (over, message) => {
    const r = PublicSignupSchema.safeParse({
      openPlayId: OP,
      rank: "novice",
      a: p("Kim", "kim@web.co"),
      b: p("Lee", "lee@web.co"),
      ...over,
    });
    expect(r.error?.issues[0].message).toBe(message);
  });

  it("parses a solo sign-up", () => {
    expect(
      PublicSoloSchema.parse({
        openPlayId: OP,
        rank: "beginner",
        a: p("Kim", "kim@web.co"),
      }).a.name,
    ).toBe("Kim X");
  });

  it("parses the admin's payment confirmation", () => {
    expect(
      ConfirmPaymentSchema.parse({ pairId: OP, amount: "300", method: "card" }),
    ).toEqual({
      pairId: OP,
      amountCents: 30000,
      method: "card",
      notes: "",
    });
    expect(
      ConfirmPaymentSchema.safeParse({
        pairId: "x",
        amount: "1",
        method: "cash",
      }).success,
    ).toBe(false);
  });
});

describe("notReady", () => {
  const pair = (over: object = {}) => ({
    paid: true,
    blocked: null,
    members: [
      { name: "Ana", checkedIn: true },
      { name: "Ben", checkedIn: true },
    ],
    ...over,
  });

  it("is ready once paid, the right rank, and both checked in", () => {
    expect(notReady(pair())).toBeNull();
  });

  it("asks for payment first, then rank, then check-in", () => {
    expect(notReady(pair({ paid: false, blocked: "x" }))).toBe(
      "Not paid yet. Confirm the payment at the desk.",
    );
    expect(notReady(pair({ blocked: "Ana is Pro" }))).toBe("Ana is Pro");
    expect(
      notReady(
        pair({
          members: [
            { name: "Ana", checkedIn: false },
            { name: "Ben", checkedIn: false },
          ],
        }),
      ),
    ).toBe("Check in Ana & Ben first");
  });

  it("needs no check-in once the open play is live", () => {
    const away = pair({
      members: [
        { name: "Ana", checkedIn: false },
        { name: "Ben", checkedIn: false },
      ],
    });
    expect(notReady(away, { live: true })).toBeNull();
    expect(notReady(pair({ paid: false }), { live: true })).toBe(
      "Not paid yet. Confirm the payment at the desk.",
    );
    expect(notReady(pair({ blocked: "Ana is Pro" }), { live: true })).toBe(
      "Ana is Pro",
    );
  });
});

describe("RegistrationNameSchema", () => {
  it("takes the queue name and first and last name, tidied", () => {
    expect(
      RegistrationNameSchema.parse({
        playerId: OP,
        name: "  Ana   C. ",
        firstName: " Ana  Maria ",
        lastName: "Cruz",
      }),
    ).toEqual({
      playerId: OP,
      name: "Ana C.",
      firstName: "Ana Maria",
      lastName: "Cruz",
    });
  });

  it.each([
    [{ playerId: "x", name: "Ana", firstName: "Ana", lastName: "C" }],
    [{ playerId: OP, name: " ", firstName: "Ana", lastName: "C" }],
    [{ playerId: OP, name: "Ana", firstName: "", lastName: "C" }],
  ])("refuses %j", (input) => {
    expect(RegistrationNameSchema.safeParse(input).success).toBe(false);
  });
});

describe("GuestPairSchema", () => {
  const guest = (names: string, extra: object = {}) =>
    GuestPairSchema.safeParse({ openPlayId: OP, names, ...extra });

  it.each([
    ["gel/son", ["gel", "son"]],
    ["  Gel   Cruz / son ", ["Gel Cruz", "son"]],
    ["gel & son", ["gel", "son"]],
    ["gel, son", ["gel", "son"]],
  ])("reads %j as two names", (names, expected) => {
    expect(guest(names).data).toEqual({
      openPlayId: OP,
      names: expected,
      paid: false,
      notes: "",
    });
  });

  it("takes paid and notes", () => {
    expect(
      guest("gel/son", { paid: "1", notes: " own paddles " }).data,
    ).toMatchObject({ paid: true, notes: "own paddles" });
    expect(guest("gel/son", { paid: true }).data?.paid).toBe(true);
    expect(guest("gel/son", { paid: "" }).data?.paid).toBe(false);
  });

  it.each([
    ["gel", "Type two names, e.g. gel/son"],
    ["gel/son/ivan", "Type two names, e.g. gel/son"],
    ["", "Type two names, e.g. gel/son"],
    ["Gel/gel", "Type two different names"],
    [`${"x".repeat(40)}/son`, "Keep names under 30 characters"],
  ])("refuses %j", (names, message) => {
    expect(guest(names).error?.issues[0].message).toBe(message);
  });
});
