import { describe, expect, it, vi } from "vitest";
import { parseAddress, sendEmail } from "@/lib/email";
import { verificationEmail } from "@/lib/email-templates";
import { rankPlayers } from "@/lib/ranking/rank";
import {
  CodeSchema,
  EmailSchema,
  fullName,
  maskEmail,
  photoError,
  photoUrl,
  ProfileSchema,
} from "./forms";
import { missingSteps, profileStatus } from "./status";
import {
  safeNext,
  hashCode,
  newCode,
  playerToken,
  readPlayerToken,
  sameHash,
} from "./verify";

const base = {
  firstName: " Ana  Marie ",
  lastName: "Cruz",
  email: "Ana@Example.com ",
};

describe("ProfileSchema", () => {
  it("trims, lowercases the email, and defaults the optional fields", () => {
    expect(ProfileSchema.parse(base)).toEqual({
      firstName: "Ana Marie",
      lastName: "Cruz",
      email: "ana@example.com",
      phone: "",
      homeClub: "",
      bio: "",
      hand: null,
    });
  });

  it("keeps a hand and a valid phone", () => {
    const p = ProfileSchema.parse({
      ...base,
      hand: "left",
      phone: "+63 917 123 4567",
    });
    expect(p.hand).toBe("left");
    expect(p.phone).toBe("+63 917 123 4567");
  });

  it.each([
    [{ ...base, firstName: " " }, "Enter the first name"],
    [{ ...base, lastName: "" }, "Enter the last name"],
    [{ ...base, lastName: "x".repeat(41) }, "Last name is too long"],
    [{ ...base, email: "nope" }, "Enter a valid email"],
    [{ ...base, phone: "call me" }, "Enter a valid phone number"],
    [{ ...base, bio: "x".repeat(281) }, "Bio: up to 280 characters"],
    [{ firstName: "Ana", lastName: "Cruz" }, "Enter your email"],
  ])("rejects %j", (input, message) => {
    const r = ProfileSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe(message);
  });
});

describe("EmailSchema and CodeSchema", () => {
  it("normalizes emails", () => {
    expect(EmailSchema.parse("  X@Y.CO ")).toBe("x@y.co");
  });

  it("accepts six digits only", () => {
    expect(CodeSchema.parse(" 012345 ")).toBe("012345");
    expect(CodeSchema.safeParse("12345").success).toBe(false);
    expect(CodeSchema.safeParse("12a456").success).toBe(false);
  });
});

describe("photoError", () => {
  it("accepts small images", () => {
    expect(photoError("image/webp", 50_000)).toBeNull();
  });

  it("rejects other types, empty files, and big files", () => {
    expect(photoError("image/gif", 10)).toMatch(/JPEG/);
    expect(photoError("image/jpeg", 0)).toBe("Pick a photo first");
    expect(photoError("image/png", 400 * 1024)).toMatch(/too big/);
  });
});

describe("photoUrl", () => {
  it("versions the URL by upload time", () => {
    expect(photoUrl("p1", new Date(5))).toBe("/players/p1/photo?v=5");
    expect(photoUrl("p1", null)).toBeNull();
  });
});

describe("maskEmail", () => {
  it("shows only the first letter", () => {
    expect(maskEmail("jayson@example.com")).toBe("j•••••");
    expect(maskEmail("jo@x.io")).toBe("j•••••");
    expect(maskEmail("@broken")).toBe("•••••");
    expect(maskEmail("")).toBe("•••••");
  });
});

describe("codes", () => {
  it("makes zero-padded six-digit codes", () => {
    expect(newCode(() => 0)).toBe("000000");
    expect(newCode(() => 0.123456)).toBe("123456");
    expect(newCode(() => 0.9999999)).toBe("999999");
    expect(newCode()).toMatch(/^\d{6}$/);
  });

  it("binds the hash to the player and email", () => {
    const h = hashCode("s", "p1", "a@b.co", "123456");
    expect(sameHash(h, hashCode("s", "p1", "a@b.co", "123456"))).toBe(true);
    expect(sameHash(h, hashCode("s", "p2", "a@b.co", "123456"))).toBe(false);
    expect(sameHash(h, hashCode("s", "p1", "c@b.co", "123456"))).toBe(false);
    expect(sameHash(h, "short")).toBe(false);
  });
});

describe("player token", () => {
  const session = { playerId: "p1", email: "a@b.co", exp: 1000 };

  it("round-trips before it expires", () => {
    const t = playerToken("s", session);
    expect(readPlayerToken("s", t, 999)).toEqual(session);
    expect(readPlayerToken("s", t, 1000)).toBeNull();
  });

  it("rejects forged, broken, or unsigned tokens", () => {
    const t = playerToken("s", session);
    expect(readPlayerToken("other", t, 0)).toBeNull();
    expect(readPlayerToken(undefined, t, 0)).toBeNull();
    expect(readPlayerToken("s", undefined, 0)).toBeNull();
    expect(readPlayerToken("s", "nodot", 0)).toBeNull();
    const [, sig] = t.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...session, playerId: "p2" }),
    ).toString("base64url");
    expect(readPlayerToken("s", `${tampered}.${sig}`, 0)).toBeNull();
  });

  it("rejects a signed body with the wrong shape", () => {
    const bad = playerToken("s", { playerId: 1 } as never);
    expect(readPlayerToken("s", bad, 0)).toBeNull();
  });

  it("rejects a signed body that isn't JSON", async () => {
    const { createHmac } = await import("node:crypto");
    const body = Buffer.from("{oops").toString("base64url");
    const sig = createHmac("sha256", "s")
      .update(`player:${body}`)
      .digest("hex");
    expect(readPlayerToken("s", `${body}.${sig}`, 0)).toBeNull();
  });
});

describe("sendEmail", () => {
  const email = verificationEmail("a@b.co", "Ana <3", "123456", 10);

  it("escapes the name in HTML and puts the code in the subject", () => {
    expect(email.subject).toBe("123456 is your POP verification code");
    expect(email.html).toContain("Ana &lt;3");
    expect(email.text).toContain("Ana <3");
  });

  it("delivers to the local Mailpit inbox without an API key", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const r = await sendEmail(
      email,
      { mailpitUrl: "http://127.0.0.1:54324/", from: "POP <pop@x.co>" },
      fetcher,
    );
    expect(r).toEqual({ sent: true });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(JSON.parse(init.body)).toMatchObject({
      From: { Name: "POP", Email: "pop@x.co" },
      To: [{ Email: "a@b.co" }],
      Subject: "123456 is your POP verification code",
    });
  });

  it("uses a local sender for Mailpit by default", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendEmail(email, { mailpitUrl: "http://x" }, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).From).toEqual({
      Name: "POP",
      Email: "pop@localhost",
    });
  });

  it("logs the email when Mailpit is down, and reports it", async () => {
    const log = vi.fn();
    const down = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await sendEmail(email, { mailpitUrl: "http://x" }, down, log);
    expect(r).toEqual({
      sent: false,
      error: "Local inbox (Mailpit) is down. Run `npm run db:start`.",
    });
    expect(log.mock.calls[0][0]).toContain("123456");
  });

  it("parses sender addresses", () => {
    expect(parseAddress("POP <pop@x.co>")).toEqual({
      Name: "POP",
      Email: "pop@x.co",
    });
    expect(parseAddress(" pop@x.co ")).toEqual({ Name: "", Email: "pop@x.co" });
  });

  it("logs instead of sending without an API key", async () => {
    const log = vi.fn();
    const fetcher = vi.fn();
    expect(await sendEmail(email, {}, fetcher, log)).toEqual({ sent: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toContain("123456");
  });

  it("posts to Resend with the key and sender", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const r = await sendEmail(
      email,
      { apiKey: "k", from: "POP <pop@x.co>" },
      fetcher,
    );
    expect(r).toEqual({ sent: true });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body)).toMatchObject({
      from: "POP <pop@x.co>",
      to: ["a@b.co"],
    });
  });

  it("uses a default sender and reports failures", async () => {
    const rejected = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    expect(await sendEmail(email, { apiKey: "k" }, rejected)).toEqual({
      sent: false,
      error: "Email failed (422)",
    });
    expect(JSON.parse(rejected.mock.calls[0][1].body).from).toContain(
      "resend.dev",
    );
    const offline = vi.fn().mockRejectedValue(new Error("down"));
    expect(await sendEmail(email, { apiKey: "k" }, offline)).toEqual({
      sent: false,
      error: "Email failed. Try again.",
    });
  });
});

describe("rankPlayers", () => {
  it("ranks by wins, then win rate, skipping players with no games", () => {
    const ranks = rankPlayers([
      { id: "a", name: "A", games: 10, wins: 6 },
      { id: "b", name: "B", games: 8, wins: 6 },
      { id: "c", name: "C", games: 3, wins: 3 },
      { id: "d", name: "D", games: 0, wins: 0 },
      { id: "e", name: "E", games: 8, wins: 6 },
    ]);
    expect(ranks.get("b")).toEqual({ rank: 1, of: 4 });
    expect(ranks.get("e")).toEqual({ rank: 1, of: 4 });
    expect(ranks.get("a")).toEqual({ rank: 3, of: 4 });
    expect(ranks.get("c")).toEqual({ rank: 4, of: 4 });
    expect(ranks.has("d")).toBe(false);
  });
});

describe("profileStatus", () => {
  const done = {
    hasEmail: true,
    firstName: "Ana",
    lastName: "Cruz",
    hasPhoto: true,
  };

  it("moves from new to verified to complete", () => {
    expect(profileStatus({ ...done, hasEmail: false })).toBe("new");
    expect(profileStatus({ ...done, hasPhoto: false })).toBe("verified");
    expect(profileStatus({ ...done, lastName: " " })).toBe("verified");
    expect(profileStatus(done)).toBe("complete");
  });

  it("lists missing steps in order", () => {
    expect(
      missingSteps({
        hasEmail: false,
        firstName: "",
        lastName: "",
        hasPhoto: false,
      }),
    ).toEqual(["Add email", "Add first & last name", "Add a photo"]);
    expect(fullName({ firstName: "Ana", lastName: "" })).toBe("Ana");
    expect(missingSteps(done)).toEqual([]);
  });
});

describe("safeNext", () => {
  it("allows only paths on this site", () => {
    expect(safeNext("/players/1", "/")).toBe("/players/1");
    expect(safeNext("//evil.com", "/")).toBe("/");
    expect(safeNext("https://evil.com", "/")).toBe("/");
    expect(safeNext("/\\evil.com", "/")).toBe("/");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});
