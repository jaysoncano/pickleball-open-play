import { createHmac, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_RESEND_MS = 60_000;
export const CODE_MAX_ATTEMPTS = 5;

export const PLAYER_COOKIE = "pop_player";
export const PLAYER_COOKIE_DAYS = 30;

function sign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A 6-digit code, zero-padded. `rng` returns [0, 1). */
export function newCode(rng: () => number = Math.random): string {
  return String(Math.floor(rng() * 1_000_000)).padStart(6, "0");
}

/** What's stored instead of the code, bound to the player and email. */
export function hashCode(
  secret: string,
  playerId: string,
  email: string,
  code: string,
): string {
  return sign(secret, `code:${playerId}:${email}:${code}`);
}

export function sameHash(a: string, b: string): boolean {
  return same(a, b);
}

export type PlayerSession = { playerId: string; email: string; exp: number };

/** What a signed token is for, so one kind can't stand in for another. */
type Purpose = "player" | "link";

export const LINK_TTL_MS = 7 * 24 * 60 * 60_000;

function signToken(secret: string, purpose: Purpose, s: PlayerSession) {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(secret, `${purpose}:${body}`)}`;
}

/** Cookie value proving a verified email for one player, until `exp`. */
export function playerToken(secret: string, session: PlayerSession): string {
  return signToken(secret, "player", session);
}

/** Token in an emailed link: opening it proves the player owns `email`. */
export function emailLinkToken(secret: string, link: PlayerSession): string {
  return signToken(secret, "link", link);
}

/** The session in a player cookie, or null if forged, broken, or expired. */
export function readPlayerToken(
  secret: string | undefined,
  token: string | undefined,
  now: number,
): PlayerSession | null {
  return readToken(secret, "player", token, now);
}

/** The player and email in an emailed link, or null if bad or expired. */
export function readEmailLinkToken(
  secret: string | undefined,
  token: string | undefined,
  now: number,
): PlayerSession | null {
  return readToken(secret, "link", token, now);
}

function readToken(
  secret: string | undefined,
  purpose: Purpose,
  token: string | undefined,
  now: number,
): PlayerSession | null {
  if (!secret || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !same(sig, sign(secret, `${purpose}:${body}`))) {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      typeof s?.playerId !== "string" ||
      typeof s?.email !== "string" ||
      typeof s?.exp !== "number" ||
      s.exp <= now
    ) {
      return null;
    }
    return { playerId: s.playerId, email: s.email, exp: s.exp };
  } catch {
    return null;
  }
}

/**
 * Where to go after signing in: a path on this site, or the fallback.
 * Refuses other sites ("//evil.com", "https://…", "/\\evil.com").
 */
export function safeNext(value: unknown, fallback: string): string {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}
