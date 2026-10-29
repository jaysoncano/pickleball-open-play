import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import {
  ADMIN_COOKIE,
  passwordVersion,
  readAdminToken,
  type AdminEnv,
} from "./auth";
import { getDb } from "./db/client";
import {
  getAdmin,
  openPlayManagers,
  playerInManagedOpenPlay,
} from "./db/queries";
import {
  PLAYER_COOKIE,
  readPlayerToken,
  type PlayerSession,
} from "./profile/verify";
import { canInvite, canManage, type Account } from "./roles";

/** The first admin's credentials, used only while no admin account exists. */
export function adminEnv(): AdminEnv {
  return {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  };
}

/**
 * The signed-in staff account (admin or host), or null. The session must
 * be signed, unexpired, and made with the account's current password.
 */
export async function currentAdmin(): Promise<Account | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  await connection(); // Request time only: the expiry check reads the clock.
  const secret = process.env.ADMIN_SECRET;
  const session = readAdminToken(secret, token, Date.now());
  if (!session || !secret) return null;
  const admin = await getAdmin(getDb(), session.adminId);
  if (!admin || passwordVersion(secret, admin.passwordHash) !== session.v) {
    return null;
  }
  return { id: admin.id, username: admin.username, role: admin.role };
}

/** Whether this request comes from a signed-in admin (not a host). */
export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin())?.role === "admin";
}

/** Throw unless the request is from an admin. Call in every admin action. */
export async function requireAdmin(): Promise<Account> {
  const me = await currentAdmin();
  if (me?.role !== "admin") throw new Error("Admins only. Sign in first.");
  return me;
}

/** Throw unless the request is from any staff account (admin or host). */
export async function requireStaff(): Promise<Account> {
  const me = await currentAdmin();
  if (!me) throw new Error("Staff only. Sign in first.");
  return me;
}

/** Whether this account runs the open play (admins run them all). */
export async function managesOpenPlay(
  me: Account | null,
  openPlayId: string,
): Promise<boolean> {
  if (!me) return false;
  return canManage(me, await openPlayManagers(getDb(), openPlayId));
}

/**
 * Throw unless the request is from an account that runs this open play:
 * an admin, its creator, or a host they invited.
 */
export async function requireOpenPlay(openPlayId: string): Promise<Account> {
  const me = await requireStaff();
  if (!(await managesOpenPlay(me, openPlayId))) {
    throw new Error("Only this open play's hosts can do that.");
  }
  return me;
}

/** Whether this account chooses the open play's hosts (main host, admin). */
export async function invitesHosts(
  me: Account | null,
  openPlayId: string,
): Promise<boolean> {
  if (!me) return false;
  return canInvite(me, await openPlayManagers(getDb(), openPlayId));
}

/**
 * Throw unless the request is from the open play's main host (the account
 * that scheduled it) or an admin: only they invite and remove hosts.
 */
export async function requireMainHost(openPlayId: string): Promise<Account> {
  const me = await requireStaff();
  if (!(await invitesHosts(me, openPlayId))) {
    throw new Error("Only this open play's main host can choose its hosts.");
  }
  return me;
}

/** The email-verified player on this device, if any. */
export async function currentPlayer(): Promise<PlayerSession | null> {
  const token = (await cookies()).get(PLAYER_COOKIE)?.value;
  await connection(); // Request time only: the expiry check reads the clock.
  return readPlayerToken(process.env.ADMIN_SECRET, token, Date.now());
}

/**
 * Whether this account may act for the player at the desk: an admin, or a
 * host the player signed up with (one of the host's open plays).
 */
export async function staffFor(
  me: Account | null,
  playerId: string,
): Promise<boolean> {
  if (!me) return false;
  return (
    me.role === "admin" ||
    (await playerInManagedOpenPlay(getDb(), playerId, me.id))
  );
}

/**
 * Who may edit this player's whole profile: an admin, or the player after
 * verifying their email. Null when neither. Hosts only change the names
 * a player registered with (`saveRegistrationName`).
 */
export async function profileEditor(
  playerId: string,
): Promise<{ admin: true } | { admin: false; email: string } | null> {
  if ((await currentAdmin())?.role === "admin") return { admin: true };
  const session = await currentPlayer();
  return session?.playerId === playerId
    ? { admin: false, email: session.email }
    : null;
}
