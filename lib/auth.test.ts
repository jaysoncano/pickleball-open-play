import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  adminToken,
  hashPassword,
  isBootstrapLogin,
  openPassword,
  NewPasswordSchema,
  PasswordSchema,
  passwordVersion,
  readAdminToken,
  sealPassword,
  UsernameSchema,
  verifyPassword,
  HostSignupSchema,
} from "./auth";

describe("passwords", () => {
  it("hashes with a salt and verifies", () => {
    const stored = hashPassword("dink-responsibly");
    expect(stored).toMatch(/^scrypt\$[\w-]+\$[\w-]+$/);
    expect(verifyPassword("dink-responsibly", stored)).toBe(true);
    expect(verifyPassword("dink", stored)).toBe(false);
    // Same password, different salt, different hash.
    expect(hashPassword("dink-responsibly")).not.toBe(stored);
    expect(
      hashPassword("x", Buffer.alloc(16)) ===
        hashPassword("x", Buffer.alloc(16)),
    ).toBe(true);
  });

  it("rejects missing or malformed hashes", () => {
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "md5$a$b")).toBe(false);
    expect(verifyPassword("x", "scrypt$onlysalt")).toBe(false);
  });

  it("changes the version when the password changes", () => {
    const a = hashPassword("one-password");
    const b = hashPassword("two-password");
    expect(passwordVersion("s", a)).toHaveLength(16);
    expect(passwordVersion("s", a)).toBe(passwordVersion("s", a));
    expect(passwordVersion("s", a)).not.toBe(passwordVersion("s", b));
  });

  it("validates usernames and new passwords", () => {
    expect(UsernameSchema.parse("  Ana.Cruz_1 ")).toBe("ana.cruz_1");
    expect(UsernameSchema.safeParse("ab").error?.issues[0].message).toBe(
      "Usernames are at least 3 characters",
    );
    expect(UsernameSchema.safeParse("ana cruz").error?.issues[0].message).toBe(
      "Use letters, numbers, dots, dashes, underscores",
    );
    expect(PasswordSchema.safeParse("short").success).toBe(false);
    expect(
      NewPasswordSchema.safeParse({ password: "long-enough", confirm: "nope" })
        .error?.issues[0].message,
    ).toBe("The passwords don't match");
    expect(
      NewPasswordSchema.safeParse({
        password: "long-enough",
        confirm: "long-enough",
      }).success,
    ).toBe(true);
  });
});

describe("admin sessions", () => {
  const session = { adminId: "a1", v: "v1", exp: 100 };

  it("round-trips until it expires", () => {
    const t = adminToken("s", session);
    expect(readAdminToken("s", t, 99)).toEqual(session);
    expect(readAdminToken("s", t, 100)).toBeNull();
  });

  it("rejects forged, broken, or wrong-shaped tokens", () => {
    const t = adminToken("s", session);
    expect(readAdminToken("other", t, 0)).toBeNull();
    expect(readAdminToken(undefined, t, 0)).toBeNull();
    expect(readAdminToken("s", undefined, 0)).toBeNull();
    expect(readAdminToken("s", "nodot", 0)).toBeNull();
    expect(
      readAdminToken("s", adminToken("s", { adminId: 1 } as never), 0),
    ).toBeNull();
    const body = Buffer.from("{oops").toString("base64url");
    const sig = createHmac("sha256", "s").update(`admin:${body}`).digest("hex");
    expect(readAdminToken("s", `${body}.${sig}`, 0)).toBeNull();
  });
});

describe("first admin from the environment", () => {
  it("matches ADMIN_USERNAME (default admin) and ADMIN_PASSWORD", () => {
    expect(isBootstrapLogin("admin", "pw", { password: "pw" })).toBe(true);
    expect(
      isBootstrapLogin("boss", "pw", { username: "Boss", password: "pw" }),
    ).toBe(true);
    expect(isBootstrapLogin("admin", "nope", { password: "pw" })).toBe(false);
    expect(isBootstrapLogin("admin", "pw", {})).toBe(false);
  });
});

describe("HostSignupSchema", () => {
  const base = {
    email: " Hana@X.co ",
    groupName: " Makati Dinkers ",
    username: "Hana",
    password: "long-enough",
    confirm: "long-enough",
  };

  it("normalizes the email, group, and username", () => {
    expect(HostSignupSchema.parse(base)).toMatchObject({
      email: "hana@x.co",
      groupName: "Makati Dinkers",
      username: "hana",
    });
  });

  it.each([
    [{ ...base, email: "nope" }, "Enter a valid email"],
    [{ ...base, groupName: " " }, "Enter your group's name"],
    [{ ...base, confirm: "other" }, "The passwords don't match"],
  ])("rejects %j", (input, message) => {
    expect(HostSignupSchema.safeParse(input).error?.issues[0].message).toBe(
      message,
    );
  });
});

describe("starting passwords", () => {
  it("seals and opens with the same secret", () => {
    const sealed = sealPassword("s3cret", "pop-host-123");
    expect(sealed).not.toContain("pop-host-123");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(openPassword("s3cret", sealed)).toBe("pop-host-123");
    // A fresh IV each time.
    expect(sealPassword("s3cret", "pop-host-123")).not.toBe(sealed);
  });

  it("gives null for another secret, tampering, or junk", () => {
    const sealed = sealPassword("s3cret", "pw");
    expect(openPassword("other", sealed)).toBeNull();
    const [v, iv, tag, data] = sealed.split(".");
    expect(
      openPassword("s3cret", [v, iv, tag, data + "A"].join(".")),
    ).toBeNull();
    expect(openPassword("s3cret", "v2.a.b.c")).toBeNull();
    expect(openPassword("s3cret", "junk")).toBeNull();
  });
});
