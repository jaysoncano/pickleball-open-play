import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { EmailSchema } from "./profile/forms";
import { GroupNameSchema } from "./roles";

export const ADMIN_COOKIE = "pop_admin";
export const ADMIN_COOKIE_DAYS = 30;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

// ── Usernames and passwords ────────────────────────────────────────────────

export const UsernameSchema = z
  .string("Enter a username")
  .trim()
  .toLowerCase()
  .min(3, "Usernames are at least 3 characters")
  .max(30, "Usernames are up to 30 characters")
  .regex(/^[a-z0-9._-]+$/, "Use letters, numbers, dots, dashes, underscores");

export const PasswordSchema = z
  .string("Enter a password")
  .min(8, "Passwords are at least 8 characters")
  .max(128, "Passwords are up to 128 characters");

/** A new password, typed twice. */
export const NewPasswordSchema = z
  .object({ password: PasswordSchema, confirm: z.string() })
  .refine((p) => p.password === p.confirm, {
    message: "The passwords don't match",
    path: ["confirm"],
  });

/** A host signing themselves up; their email is verified with a code. */
export const HostSignupSchema = z
  .object({
    email: EmailSchema,
    groupName: GroupNameSchema,
    username: UsernameSchema,
    password: PasswordSchema,
    confirm: z.string(),
  })
  .refine((p) => p.password === p.confirm, {
    message: "The passwords don't match",
    path: ["confirm"],
  });

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;

/** "scrypt$<salt>$<hash>", base64url. Salted, slow on purpose. */
export function hashPassword(
  password: string,
  salt: Buffer = randomBytes(16),
): string {
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    SCRYPT,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * A short fingerprint of the stored hash. Sessions carry it, so changing
 * the password signs out every older session.
 */
export function passwordVersion(secret: string, stored: string): string {
  return sign(secret, `pw:${stored}`).slice(0, 16);
}

// ── Admin sessions ─────────────────────────────────────────────────────────

export type AdminSession = { adminId: string; v: string; exp: number };

/** Cookie value for a signed-in admin, until `exp`. */
export function adminToken(secret: string, session: AdminSession): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${sign(secret, `admin:${body}`)}`;
}

/** The session in an admin cookie, or null if forged, broken, or expired. */
export function readAdminToken(
  secret: string | undefined,
  token: string | undefined,
  now: number,
): AdminSession | null {
  if (!secret || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !same(sig, sign(secret, `admin:${body}`))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      typeof s?.adminId !== "string" ||
      typeof s?.v !== "string" ||
      typeof s?.exp !== "number" ||
      s.exp <= now
    ) {
      return null;
    }
    return { adminId: s.adminId, v: s.v, exp: s.exp };
  } catch {
    return null;
  }
}

// ── First admin ────────────────────────────────────────────────────────────

export type AdminEnv = { username?: string; password?: string };

/**
 * Before any admin account exists, the credentials in the environment
 * (ADMIN_USERNAME, default "admin", and ADMIN_PASSWORD) create the first.
 */
export function isBootstrapLogin(
  username: string,
  password: string,
  env: AdminEnv,
): boolean {
  if (!env.password) return false;
  return (
    same(username, (env.username || "admin").trim().toLowerCase()) &&
    same(password, env.password)
  );
}
