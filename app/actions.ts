"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_DAYS,
  adminToken,
  hashPassword,
  HostSignupSchema,
  isBootstrapLogin,
  NewPasswordSchema,
  passwordVersion,
  UsernameSchema,
  verifyPassword,
} from "@/lib/auth";
import {
  adminEnv,
  currentAdmin,
  currentPlayer,
  profileEditor,
  requireAdmin,
  requireMainHost,
  requireOpenPlay,
  requireStaff,
  staffFor,
} from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import * as q from "@/lib/db/queries";
import { sendEmail } from "@/lib/email";
import {
  hostCodeEmail,
  hostInviteEmail,
  receiptEmail,
  verificationEmail,
} from "@/lib/email-templates";
import {
  CodeSchema,
  EmailSchema,
  photoError,
  ProfileSchema,
} from "@/lib/profile/forms";
import {
  CODE_TTL_MS,
  emailLinkToken,
  hashCode,
  LINK_TTL_MS,
  readEmailLinkToken,
  newCode,
  PLAYER_COOKIE,
  PLAYER_COOKIE_DAYS,
  playerToken,
  safeNext,
} from "@/lib/profile/verify";
import { createSession } from "@/lib/queue/engine";
import {
  CourtsSchema,
  firstError,
  MatchSchema,
  SessionDateSchema,
  PlayerNameSchema,
  QueueStateSchema,
  type QueueState,
} from "@/lib/queue/schema";
import {
  ProtestSchema,
  ResolutionSchema,
  ScoreSchema,
} from "@/lib/ranking/forms";
import { LevelSchema, levelRank, type Level } from "@/lib/ranking/levels";
import type { UnitGame } from "@/lib/ranking/standings";
import { notReady, pickRegistered } from "@/lib/registration/gate";
import {
  OpenPlayEditSchema,
  OpenPlaySchema,
  ranksLabel,
  whenLabel,
} from "@/lib/registration/open-play";
import { formatTimeLabel } from "@/lib/queue/time";
import {
  formatMoney,
  METHOD_LABEL,
  nestForm,
  openPlayFee,
  ConfirmPaymentSchema,
  PairRegistrationSchema,
  PairUpSchema,
  PublicSignupSchema,
  PublicSoloSchema,
  SoloRegistrationSchema,
  UnpaidPairSchema,
  type PairRegistration,
} from "@/lib/registration/forms";
import { missingSteps, profileStatus } from "@/lib/profile/status";
import { bannerError } from "@/lib/banner";
import {
  GroupNameSchema,
  RoleSchema,
  VenueSchema,
  venueLabel,
} from "@/lib/roles";
import { claimUrl, originFrom, qrSvg } from "@/lib/qr";
import { z } from "zod";

export type FormState = {
  error: string | null;
  ok?: boolean;
  /** What happened, when it's worth saying. */
  message?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Admin sign-in ──────────────────────────────────────────────────────────

const COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Sign this device in as the player (30 days). */
async function setPlayerCookie(
  secret: string,
  playerId: string,
  email: string,
) {
  (await cookies()).set(
    PLAYER_COOKIE,
    playerToken(secret, {
      playerId,
      email,
      exp: Date.now() + PLAYER_COOKIE_DAYS * DAY_MS,
    }),
    { ...COOKIE, maxAge: PLAYER_COOKIE_DAYS * 24 * 60 * 60 },
  );
}

/** Sign this device in as the admin; tied to their current password. */
async function setAdminCookie(secret: string, admin: q.AdminRow) {
  (await cookies()).set(
    ADMIN_COOKIE,
    adminToken(secret, {
      adminId: admin.id,
      v: passwordVersion(secret, admin.passwordHash),
      exp: Date.now() + ADMIN_COOKIE_DAYS * DAY_MS,
    }),
    { ...COOKIE, maxAge: ADMIN_COOKIE_DAYS * 24 * 60 * 60 },
  );
}

/** Compared against when the username is unknown, so timing gives nothing away. */
let decoyHash: string | undefined;
function decoy(): string {
  decoyHash ??= hashPassword("not-a-real-password");
  return decoyHash;
}

const WRONG = "Wrong username or password";

/**
 * Admin sign-in with username and password. Before any admin account
 * exists, ADMIN_USERNAME (default "admin") and ADMIN_PASSWORD create it.
 */
export async function login(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return { error: "Set ADMIN_SECRET in .env.local" };
  const username = UsernameSchema.safeParse(form.get("username"));
  const password = String(form.get("password") ?? "");
  if (!username.success) return { error: WRONG };
  const db = getDb();
  let admin = await q.adminByUsername(db, username.data);
  if (
    !admin &&
    (await q.countAdmins(db)) === 0 &&
    isBootstrapLogin(username.data, password, adminEnv())
  ) {
    const made = await q.createAdmin(
      db,
      username.data,
      hashPassword(password),
      "admin",
    );
    if ("error" in made) return { error: made.error };
    admin = await q.getAdmin(db, made.id);
  }
  if (!verifyPassword(password, admin?.passwordHash ?? decoy()) || !admin) {
    return { error: WRONG };
  }
  if (!admin.verified) {
    // Right password, email not verified yet: send a code and ask for it.
    await sendHostCode(admin);
    redirect(`/host/verify?u=${encodeURIComponent(admin.username)}`);
  }
  await setAdminCookie(secret, admin);
  redirect("/host");
}

// ── Host sign-up (email verified with a code) ──────────────────────────────

/** Email a fresh verification code; null when sent. */
async function sendHostCode(admin: q.AdminRow): Promise<string | null> {
  if (!admin.email) return "This account has no email to verify";
  const code = newCode();
  const error = await q.issueAccountCode(getDb(), {
    adminId: admin.id,
    codeHash: hashCode(authSecret(), admin.id, admin.email, code),
  });
  if (error) return error;
  const sent = await sendEmail(
    hostCodeEmail(admin.email, admin.username, code, CODE_TTL_MS / 60_000),
    mailEnv(),
  );
  return sent.sent ? null : sent.error;
}

/**
 * Anyone can sign up as a host with their email. The account stays
 * locked until they enter the code emailed to them.
 */
export async function hostSignUp(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = HostSignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed) };
  const { email, username, password, groupName } = parsed.data;
  const db = getDb();
  const made = await q.createHostSignup(db, {
    email,
    username,
    groupName,
    passwordHash: hashPassword(password),
  });
  if ("error" in made) return { error: made.error };
  const admin = await q.getAdmin(db, made.id);
  const error = admin && (await sendHostCode(admin));
  if (error) return { error };
  redirect(`/host/verify?u=${encodeURIComponent(username)}`);
}

/** The unverified host account a verify form is for. */
async function pendingHost(form: FormData) {
  const username = UsernameSchema.safeParse(form.get("username"));
  const admin = username.success
    ? await q.adminByUsername(getDb(), username.data)
    : null;
  return admin && !admin.verified ? admin : null;
}

/** Send another code to a host who hasn't verified yet. */
export async function resendHostCode(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await pendingHost(form);
  if (!admin) return { error: "Nothing to verify. Sign in instead." };
  const error = await sendHostCode(admin);
  return error ? { error } : { error: null, ok: true, message: "Code sent" };
}

/** Check the code: the account opens, and this device signs in. */
export async function verifyHostCode(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await pendingHost(form);
  if (!admin?.email) return { error: "Nothing to verify. Sign in instead." };
  const code = CodeSchema.safeParse(form.get("code"));
  if (!code.success) return { error: firstError(code) };
  const secret = authSecret();
  const error = await q.checkAccountCode(getDb(), {
    adminId: admin.id,
    codeHash: hashCode(secret, admin.id, admin.email, code.data),
  });
  if (error) return { error };
  await setAdminCookie(secret, admin);
  redirect("/host");
}

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/");
}

// ── Open play (admin) ──────────────────────────────────────────────────────

function parseState(state: QueueState): QueueState {
  return QueueStateSchema.parse(state);
}

/**
 * Schedule an open play; the account scheduling it runs it. The group
 * name and logo are optional: filled in, they update the account's group.
 */
export async function createOpenPlay(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const me = await requireStaff();
  const parsed = OpenPlaySchema.safeParse({
    ...Object.fromEntries(form),
    levels: form.getAll("levels"),
  });
  if (!parsed.success) return { error: firstError(parsed) };
  const db = getDb();
  const name = String(form.get("groupName") ?? "").trim();
  const banner = uploaded(form, "banner");
  const error =
    (banner && bannerError(banner.type, banner.size)) ||
    (await applyGroup(db, me.id, form, name || null));
  if (error) return { error };
  const id = await q.createOpenPlay(db, parsed.data, me.id);
  if (banner) await q.saveBanner(db, id, banner.type, await bytes(banner));
  revalidatePath("/", "layout");
  redirect(`/open-plays/${id}/manage`);
}

/** Its hosts: change an open play's date, time, ranks, cap, or entry. */
export async function editOpenPlay(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = String(form.get("openPlayId") ?? "");
  await requireOpenPlay(id);
  const parsed = OpenPlayEditSchema.safeParse({
    ...Object.fromEntries(form),
    levels: form.getAll("levels"),
  });
  if (!parsed.success) return { error: firstError(parsed) };
  const error = await q.updateOpenPlay(getDb(), id, parsed.data);
  if (error) return { error };
  revalidatePath("/", "layout");
  return { error: null, ok: true, message: "Open play saved" };
}

/** Its hosts: change where an open play is played. */
export async function saveVenue(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = String(form.get("openPlayId") ?? "");
  await requireOpenPlay(id);
  const parsed = VenueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await q.setVenue(getDb(), id, parsed.data);
  revalidatePath("/", "layout");
  return { error: null, ok: true, message: "Venue saved" };
}

/** Its hosts: upload or remove an open play's banner. */
export async function saveOpenPlayBanner(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = String(form.get("openPlayId") ?? "");
  await requireOpenPlay(id);
  const db = getDb();
  const banner = uploaded(form, "banner");
  if (banner) {
    const error = bannerError(banner.type, banner.size);
    if (error) return { error };
    await q.saveBanner(db, id, banner.type, await bytes(banner));
  } else if (form.get("removeBanner")) {
    await q.removeBanner(db, id);
  } else {
    return { error: "Pick a banner first" };
  }
  revalidatePath("/", "layout");
  return {
    error: null,
    ok: true,
    message: banner ? "Banner saved" : "Banner removed",
  };
}

/** The form's file under `name`, unless none was picked. */
function uploaded(form: FormData, name: string): File | null {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

async function bytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Delete an open play nobody signed up for. */
export async function removeOpenPlay(id: string): Promise<string | null> {
  await requireOpenPlay(id);
  const error = await q.removeOpenPlay(getDb(), id);
  if (!error) revalidatePath("/", "layout");
  return error;
}

/**
 * Invite someone to help run an open play: an account by username or
 * email joins right away; an email without an account gets an invitation
 * to sign up as a host.
 */
export async function inviteHost(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const openPlayId = String(form.get("openPlayId") ?? "");
  const me = await requireMainHost(openPlayId);
  const raw = String(form.get("who") ?? "");
  const who = raw.includes("@")
    ? EmailSchema.safeParse(raw)
    : UsernameSchema.safeParse(raw);
  if (!who.success) return { error: firstError(who) };
  const db = getDb();
  const result = await q.inviteHost(db, openPlayId, who.data, me.id);
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  if ("added" in result) {
    return {
      error: null,
      ok: true,
      message: `${result.added} can help run it now. It's on their list.`,
    };
  }
  const play = await q.getOpenPlay(db, openPlayId);
  const origin = originFrom(await headers());
  const sent = await sendEmail(
    hostInviteEmail({
      to: result.invited,
      from: me.username,
      when: play ? whenLabel(play) : "",
      venue: play ? venueLabel(play) : "",
      signupLink: `${origin}/host/signup?email=${encodeURIComponent(result.invited)}`,
    }),
    mailEnv(),
  );
  return sent.sent
    ? {
        error: null,
        ok: true,
        message: `Invitation emailed to ${result.invited}. Once they sign up and verify, it's on their list.`,
      }
    : { error: `Invite saved, but the email failed: ${sent.error}` };
}

/** Main host: cancel an email invitation that hasn't been accepted. */
export async function removeInvite(
  openPlayId: string,
  email: string,
): Promise<void> {
  await requireMainHost(openPlayId);
  await q.removeInvite(getDb(), openPlayId, email);
  revalidatePath("/", "layout");
}

/** Main host: take an invited host off. Its creator always stays. */
export async function removeHost(
  openPlayId: string,
  adminId: string,
): Promise<void> {
  await requireMainHost(openPlayId);
  await q.removeHost(getDb(), openPlayId, adminId);
  revalidatePath("/", "layout");
}

/**
 * An open play's pairs, paid and unpaid, with who's checked in: the
 * check-in list before starting, and late arrivals.
 */
export async function rosterFor(openPlayId: string) {
  await requireOpenPlay(openPlayId);
  return q.rosterPairs(getDb(), openPlayId);
}

/** Check a player in at the venue (or undo it). */
export async function checkIn(
  openPlayId: string,
  playerId: string,
  checkedIn: boolean,
): Promise<boolean> {
  await requireOpenPlay(openPlayId);
  const ok = await q.setCheckIn(getDb(), openPlayId, playerId, checkedIn);
  if (ok) revalidatePath("/admin/players");
  return ok;
}

/**
 * Start an open play with its paid pairs. Pairs are the queue's units, two
 * per court (pair vs pair); the date and times come from the open play.
 */
export async function startOpenPlay(
  openPlayId: string,
  courtLevels: Level[],
  pairIds: string[],
): Promise<{ state: QueueState } | { error: string }> {
  await requireOpenPlay(openPlayId);
  const db = getDb();
  const play = await q.getOpenPlay(db, openPlayId);
  if (!play) return { error: "Open play not found" };
  if (!courtLevels.every((l) => play.levels.includes(l))) {
    return { error: "Each court must play one of this open play's ranks" };
  }
  const courts = CourtsSchema.safeParse({
    courtCount: courtLevels.length,
    playersPerCourt: 2,
  });
  if (!courts.success) return { error: firstError(courts) ?? "Check courts" };
  const { players, unregistered } = pickRegistered(
    await q.rosterPairs(db, openPlayId),
    pairIds,
  );
  if (unregistered) {
    return { error: "Some pairs aren't signed up for this open play. Reload." };
  }
  // Only paid pairs with both players checked in can start.
  for (const p of players) {
    const why = notReady(p);
    if (why) return { error: `${p.name}: ${why}` };
  }
  const state = createSession(
    {
      startTime: play.startTime,
      endTime: play.endTime,
      date: play.playDate,
      ...courts.data,
      courtRanks: courtLevels.map(levelRank),
    },
    players.map(asUnit),
    Date.now(),
  );
  if (!(await q.startSession(db, openPlayId, state))) {
    return { error: "This open play is already running. Reload to see it." };
  }
  revalidatePath("/", "layout");
  return { state };
}

/** Late arrivals: only paid, checked-in pairs that can play its ranks. */
export async function addLateArrivals(openPlayId: string, pairIds: string[]) {
  return pickRegistered(await rosterFor(openPlayId), pairIds)
    .players.filter((p) => !notReady(p))
    .map(asUnit);
}

/** What the queue keeps of a pair: id, name, and its rank. */
function asUnit({ id, name, skill }: q.PairUnit) {
  return { id, name, skill };
}

/** Rename a registered player, then save the session that shows it. */
export async function renameAndSave(
  openPlayId: string,
  state: QueueState,
  playerId: string,
  name: string,
): Promise<string | boolean> {
  await requireOpenPlay(openPlayId);
  const parsed = PlayerNameSchema.safeParse(name);
  if (!parsed.success) return firstError(parsed) ?? "Invalid name";
  const db = getDb();
  if ((await q.pairMembers(db, [playerId])).size) {
    return "Pair names come from the players. Rename them at the Player desk.";
  }
  const error = await q.renamePlayer(db, playerId, parsed.data);
  return error ?? q.saveSession(db, openPlayId, parseState(state));
}

export async function saveOpenPlay(
  openPlayId: string,
  state: QueueState,
): Promise<boolean> {
  await requireOpenPlay(openPlayId);
  return q.saveSession(getDb(), openPlayId, parseState(state));
}

export async function endOpenPlay(openPlayId: string): Promise<void> {
  await requireOpenPlay(openPlayId);
  await q.endSession(getDb(), openPlayId);
  revalidatePath("/", "layout");
}

/** Record a finished game's score and save the session after it. */
export async function finishMatch(
  openPlayId: string,
  state: QueueState,
  game: unknown,
  score: unknown,
): Promise<string | null> {
  await requireOpenPlay(openPlayId);
  const parsedScore = ScoreSchema.safeParse(score);
  if (!parsedScore.success) return firstError(parsedScore);
  const ok = await q.recordMatch(
    getDb(),
    openPlayId,
    parseState(state),
    MatchSchema.parse(game),
    parsedScore.data,
  );
  return ok ? null : "This open play isn't running";
}

/** The running session's scored games by pair, for the standings. */
export async function liveStandingGames(
  openPlayId: string,
): Promise<UnitGame[]> {
  await requireOpenPlay(openPlayId);
  return q.liveSessionGames(getDb(), openPlayId);
}

// ── Levels and protests ────────────────────────────────────────────────────

/**
 * A signed-in player who shared a confirmed open play with someone can
 * protest that player's level; an admin reviews it.
 */
export async function fileProtest(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const me = await currentPlayer();
  if (!me) return { error: "Sign in first to file a protest" };
  const db = getDb();
  // The session must still match the player's email.
  if ((await q.getPlayerPrivate(db, me.playerId))?.email !== me.email) {
    return { error: "Your email changed. Sign in again." };
  }
  const parsed = ProtestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed) };
  const error = await q.createProtest(db, parsed.data, me.playerId);
  if (error) return { error };
  revalidatePath(`/players/${parsed.data.playerId}`);
  revalidatePath("/admin/protests");
  return { error: null, ok: true };
}

export async function resolveProtest(form: FormData): Promise<void> {
  await requireAdmin();
  const { protestId, approve, note } = ResolutionSchema.parse({
    protestId: form.get("protestId"),
    approve: form.get("decision") === "approve",
    note: form.get("note") ?? "",
  });
  await q.resolveProtest(getDb(), protestId, approve, note);
  revalidatePath("/admin/protests");
  revalidatePath("/players", "layout");
}

export async function changeLevel(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireAdmin();
  const playerId = String(form.get("playerId") ?? "");
  const level = LevelSchema.safeParse(form.get("level"));
  if (!level.success) return { error: firstError(level) };
  const note = String(form.get("note") ?? "")
    .trim()
    .slice(0, 500);
  if (!(await q.setLevel(getDb(), playerId, level.data, note))) {
    return { error: "Player not found" };
  }
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/players");
  return { error: null, ok: true };
}

// ── Player profiles ────────────────────────────────────────────────────────

/** Resend in production; Supabase's local Mailpit inbox in development. */
function mailEnv() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
    mailpitUrl: process.env.MAILPIT_URL,
  };
}

function authSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("Set ADMIN_SECRET in .env.local");
  return secret;
}

export type CodeFormState = FormState & { email?: string };

/**
 * The player a code is for: by QR token (first time), or by profile id
 * once an email is linked (returning players, no QR needed).
 */
async function claimTarget(
  db: q.Db,
  form: FormData,
): Promise<{ id: string; name: string } | { error: string }> {
  const token = form.get("token");
  if (token) {
    return (
      (await q.playerByClaimToken(db, String(token))) ?? {
        error: "This QR code is no longer valid",
      }
    );
  }
  if (form.get("byEmail")) {
    // Sign in: the player is whoever has this email.
    const email = EmailSchema.safeParse(form.get("email"));
    const found = email.success ? await q.playerByEmail(db, email.data) : null;
    return (
      found ?? {
        error: "No player has that email. Sign up for an open play first.",
      }
    );
  }
  const id = z.uuid().safeParse(form.get("playerId"));
  const player = id.success ? await q.getPlayer(db, id.data) : null;
  if (!player) return { error: "Player not found" };
  if (!(await q.getPlayerPrivate(db, player.id))?.email) {
    return { error: "Ask the host for your QR code to set up your profile" };
  }
  return player;
}

const NOT_PAID =
  "Your profile opens once the admin confirms your open play payment at the booth";

/** Only players whose open play payment was confirmed can edit their info. */
async function claimTargetRegistered(
  db: q.Db,
  form: FormData,
): Promise<{ id: string; name: string } | { error: string }> {
  const player = await claimTarget(db, form);
  if ("error" in player) return player;
  if (!(await q.hasPaidRegistration(db, player.id))) return { error: NOT_PAID };
  return player;
}

/**
 * Who may edit this profile: an admin always; the verified player once an
 * admin has confirmed their payment.
 */
async function profileEditorPaid(playerId: string) {
  const editor = await profileEditor(playerId);
  if (!editor || editor.admin) return editor;
  return (await q.hasPaidRegistration(getDb(), playerId)) ? editor : null;
}

/** Step 1 of a QR claim: email a code to the address the player typed. */
export async function sendEmailCode(
  _prev: CodeFormState,
  form: FormData,
): Promise<CodeFormState> {
  const email = EmailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: firstError(email) };
  const db = getDb();
  const player = await claimTargetRegistered(db, form);
  if ("error" in player) return { error: player.error };
  const code = newCode();
  const error = await q.issueEmailCode(db, {
    playerId: player.id,
    email: email.data,
    codeHash: hashCode(authSecret(), player.id, email.data, code),
  });
  if (error) return { error, email: email.data };
  const sent = await sendEmail(
    verificationEmail(email.data, player.name, code, CODE_TTL_MS / 60_000),
    mailEnv(),
  );
  if (!sent.sent) return { error: sent.error, email: email.data };
  return { error: null, ok: true, email: email.data };
}

/** Step 2: check the code, remember this device, open the edit page. */
export async function confirmEmailCode(
  _prev: CodeFormState,
  form: FormData,
): Promise<CodeFormState> {
  const email = EmailSchema.safeParse(form.get("email"));
  const code = CodeSchema.safeParse(form.get("code"));
  if (!email.success) return { error: firstError(email) };
  if (!code.success)
    return { error: firstError(code), ok: true, email: email.data };
  const db = getDb();
  const player = await claimTargetRegistered(db, form);
  if ("error" in player) return { error: player.error };
  const secret = authSecret();
  const error = await q.checkEmailCode(db, {
    playerId: player.id,
    email: email.data,
    codeHash: hashCode(secret, player.id, email.data, code.data),
  });
  if (error) return { error, ok: true, email: email.data };
  await setPlayerCookie(secret, player.id, email.data);
  redirect(safeNext(form.get("next"), `/players/${player.id}/edit`));
}

export async function signOutPlayer(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE);
  redirect("/");
}

/**
 * Who is editing this profile, and the email to save. Players keep the
 * email they verified; an admin may set any.
 */
async function editorEmail(
  playerId: string,
  typed: FormDataEntryValue | null,
): Promise<{ email: unknown } | { error: string }> {
  const editor = await profileEditor(playerId);
  if (!editor)
    return { error: "Scan your QR code and verify your email first" };
  if (editor.admin) {
    // Hosts can't move a player's confirmed email; only admins can.
    const contact = await q.getPlayerPrivate(getDb(), playerId);
    const host = (await currentAdmin())?.role !== "admin";
    return { email: host && contact?.emailConfirmedAt ? contact.email : typed };
  }
  if (!(await q.hasPaidRegistration(getDb(), playerId))) {
    return { error: NOT_PAID };
  }
  const contact = await q.getPlayerPrivate(getDb(), playerId);
  if (contact?.email !== editor.email) {
    return { error: "Your email changed. Scan your QR code to verify again." };
  }
  return { email: editor.email };
}

export async function saveProfile(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const playerId = String(form.get("playerId") ?? "");
  const who = await editorEmail(playerId, form.get("email"));
  if ("error" in who) return { error: who.error };
  const parsed = ProfileSchema.safeParse({
    ...Object.fromEntries(form),
    email: who.email,
  });
  if (!parsed.success) return { error: firstError(parsed) };
  const error = await q.updateProfile(getDb(), playerId, parsed.data);
  if (error) return { error };
  revalidatePath(`/players/${playerId}`, "layout");
  revalidatePath("/players");
  return { error: null, ok: true };
}

export async function uploadPhoto(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const playerId = String(form.get("playerId") ?? "");
  if (!(await profileEditorPaid(playerId))) {
    return { error: "Scan your QR code and verify your email first" };
  }
  const file = form.get("photo");
  if (!(file instanceof File)) return { error: "Pick a photo first" };
  const error = photoError(file.type, file.size);
  if (error) return { error };
  const data = new Uint8Array(await file.arrayBuffer());
  if (!(await q.savePhoto(getDb(), playerId, file.type, data))) {
    return { error: "Player not found" };
  }
  revalidatePath(`/players/${playerId}`, "layout");
  revalidatePath("/players");
  return { error: null, ok: true };
}

export async function deletePhoto(playerId: string): Promise<void> {
  if (!(await profileEditorPaid(playerId))) throw new Error("Not allowed");
  await q.removePhoto(getDb(), playerId);
  revalidatePath(`/players/${playerId}`, "layout");
  revalidatePath("/players");
}

/** Void a player's printed QR code and issue a new one. */
export async function newQrCode(playerId: string): Promise<void> {
  await requireAdmin();
  await q.regenerateClaimToken(getDb(), playerId);
  revalidatePath(`/players/${playerId}`);
  revalidatePath("/admin/qr-codes");
}

/** Today's players and how far each is with their profile (host view). */
export async function profileSetup(playerIds: string[]) {
  const me = await requireStaff();
  const db = getDb();
  const ids = playerIds.filter((id) => z.uuid().safeParse(id).success);
  // Session units are pairs: list each pair's players.
  const members = await q.pairMembers(db, ids);
  let people = ids.flatMap((id) => members.get(id)?.map((m) => m.id) ?? [id]);
  // Hosts only see players of the open plays they run.
  if (me.role !== "admin") {
    const mine = new Set(await q.managedPlayerIds(db, me.id));
    people = people.filter((id) => mine.has(id));
  }
  const rows = await q.listClaimTokens(db, people);
  // The QR secret stays on the server; playerQrCode renders it on demand.
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    fullName: row.fullName,
    emailConfirmed: row.emailConfirmed,
    status: profileStatus(row),
    missing: missingSteps(row),
  }));
}

/** A player's QR code as SVG, to show full screen for them to scan. */
export async function playerQrCode(
  playerId: string,
): Promise<{ svg: string; url: string } | null> {
  // Hosts get QR codes only for players in their own open plays.
  if (!(await staffFor(await requireStaff(), playerId))) return null;
  const secret = await q.getPlayerPrivate(getDb(), playerId);
  if (!secret) return null;
  const url = claimUrl(originFrom(await headers()), secret.claimToken);
  return { svg: await qrSvg(url), url };
}

// ── Open-play registration (booth) ─────────────────────────────────────────

export type RegisterState = FormState & {
  /** Shown after saving: who, and whether the emails went out. */
  done?: {
    names: string[];
    emailed: boolean;
    note?: string;
    /** Saved as unpaid: no receipt until the payment is confirmed. */
    unpaid?: boolean;
  };
};

const playDay = new Intl.DateTimeFormat("en", {
  dateStyle: "full",
  timeZone: "UTC",
});

/**
 * Email each player a receipt for the date with their own link to confirm
 * the email and update their profile.
 */
async function sendReceipts(
  who: q.Registered,
  openPlayId: string,
  entry: Pick<PairRegistration, "amountCents" | "method" | "reference"> | null,
): Promise<RegisterState> {
  const play = await q.getOpenPlay(getDb(), openPlayId);
  if (!play) return { error: "Open play not found" };
  const secret = authSecret();
  const origin = originFrom(await headers());
  const partner = (i: number) => who.players[1 - i]?.name;
  const results = await Promise.all(
    who.players.map((p, i) => {
      const link = emailLinkToken(secret, {
        playerId: p.id,
        email: p.email,
        exp: Date.now() + LINK_TTL_MS,
      });
      return sendEmail(
        receiptEmail({
          to: p.email,
          name: p.fullName,
          playDate: playDay.format(new Date(`${play.playDate}T00:00:00Z`)),
          time: `${formatTimeLabel(play.startTime)} – ${formatTimeLabel(play.endTime)}`,
          rank: ranksLabel(play),
          venue: venueLabel(play) || undefined,
          partner: partner(i),
          entry: entry
            ? {
                amount: formatMoney(entry.amountCents, openPlayFee().currency),
                method: METHOD_LABEL[entry.method],
                reference: entry.reference,
              }
            : undefined,
          receiptNo: (who.pairId ?? p.id).slice(0, 8).toUpperCase(),
          // Editing opens only once the pair has paid.
          profileLink: entry ? `${origin}/confirm/${link}` : undefined,
        }),
        mailEnv(),
      );
    }),
  );
  const failed = results.find((r) => !r.sent);
  revalidatePath("/", "layout");
  return {
    error: null,
    ok: true,
    done: {
      names: who.players.map((p) => p.name),
      emailed: !failed,
      note: failed && !failed.sent ? failed.error : undefined,
    },
  };
}

/** Register a pair for a date with its entry, paid in full. */
export async function registerPairEntry(
  _prev: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  await requireStaff();
  if (form.get("payLater")) return registerUnpaidPair(form);
  const parsed = PairRegistrationSchema.safeParse(nestForm(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await requireOpenPlay(parsed.data.openPlayId);
  const r = await q.registerPair(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  return sendReceipts(r, parsed.data.openPlayId, parsed.data);
}

/**
 * A pair who'll pay later: they wait as unpaid until the host confirms
 * the payment; receipts go out then.
 */
async function registerUnpaidPair(form: FormData): Promise<RegisterState> {
  const parsed = UnpaidPairSchema.safeParse(nestForm(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await requireOpenPlay(parsed.data.openPlayId);
  const r = await q.registerPair(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  revalidatePath("/", "layout");
  return {
    error: null,
    ok: true,
    done: { names: r.players.map((p) => p.name), emailed: false, unpaid: true },
  };
}

/** Sign up a player alone; the desk pairs them later. */
export async function registerSoloEntry(
  _prev: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  await requireStaff();
  const parsed = SoloRegistrationSchema.safeParse(nestForm(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await requireOpenPlay(parsed.data.openPlayId);
  const r = await q.registerSolo(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  return sendReceipts(r, parsed.data.openPlayId, null);
}

/** Pair two solo players; the pair pays the full entry. */
export async function pairUpSolos(
  _prev: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  await requireStaff();
  const parsed = PairUpSchema.safeParse(nestForm(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await requireOpenPlay(parsed.data.openPlayId);
  const r = await q.pairSolos(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  return sendReceipts(r, parsed.data.openPlayId, parsed.data);
}

/**
 * The desk's lists for a date: the open plays this account runs (all of
 * them for an admin), and one's sign-ups.
 */
export async function openPlaysOn(playDate: string) {
  const me = await requireStaff();
  const day = SessionDateSchema.safeParse(playDate);
  if (!day.success) return [];
  return q.listOpenPlays(getDb(), {
    playDate: day.data,
    managedBy: me.role === "admin" ? undefined : me.id,
  });
}

export async function registrationsFor(openPlayId: string) {
  await requireOpenPlay(openPlayId);
  return q.listRegistrations(getDb(), openPlayId);
}

/**
 * The emailed link: confirms the email, signs this device in as the
 * player, and opens their profile editor.
 */
export async function confirmEmailLink(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const secret = authSecret();
  const link = readEmailLinkToken(
    secret,
    String(form.get("token") ?? ""),
    Date.now(),
  );
  if (!link) {
    return {
      error:
        "This link has expired or isn’t valid. Use “This is me” on your profile to get a code.",
    };
  }
  if (!(await q.hasPaidRegistration(getDb(), link.playerId))) {
    return { error: NOT_PAID };
  }
  if (!(await q.confirmEmail(getDb(), link.playerId, link.email))) {
    return {
      error: "Your email changed since this link was sent. Ask the booth.",
    };
  }
  await setPlayerCookie(secret, link.playerId, link.email);
  redirect(`/players/${link.playerId}/edit`);
}

// ── Online sign-up (public) and payment approval (admin) ──────────────────

export type SignupState = FormState & { names?: string[]; solo?: boolean };

/**
 * Online sign-up for a rank, as a pair or solo. A pair waits as "pending
 * payment" until an admin confirms it at the booth; a solo player waits
 * for the desk to pair them. Nothing is emailed yet.
 */
export async function signUpOnline(
  _prev: SignupState,
  form: FormData,
): Promise<SignupState> {
  if (form.get("kind") === "solo") {
    const solo = PublicSoloSchema.safeParse(nestForm(form));
    if (!solo.success) return { error: firstError(solo) };
    const r = await q.signUpSolo(getDb(), solo.data);
    if ("error" in r) return { error: r.error };
    revalidatePath(`/open-plays/${solo.data.openPlayId}`);
    revalidatePath("/admin/players");
    return { error: null, ok: true, names: [r.name], solo: true };
  }
  const parsed = PublicSignupSchema.safeParse(nestForm(form));
  if (!parsed.success) return { error: firstError(parsed) };
  const r = await q.signUpPair(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  revalidatePath(`/open-plays/${parsed.data.openPlayId}`);
  revalidatePath("/admin/players");
  return { error: null, ok: true, names: r.names };
}

/** Admin: payment received at the booth. The pair is in; receipts go out. */
export async function confirmPayment(
  _prev: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  await requireStaff();
  const parsed = ConfirmPaymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: firstError(parsed) };
  await requirePairHost(parsed.data.pairId);
  const r = await q.confirmPairPayment(getDb(), parsed.data);
  if ("error" in r) return { error: r.error };
  return sendReceipts(r, r.openPlayId, parsed.data);
}

/** Throw unless this account runs the pair's open play; null if no such pair. */
async function requirePairHost(pairId: string): Promise<string | null> {
  const openPlayId = await q.pairOpenPlayId(getDb(), pairId);
  if (openPlayId) await requireOpenPlay(openPlayId);
  return openPlayId;
}

/** Admin: reject a pending sign-up, or remove (refund) a paid pair. */
export async function removePairEntry(pairId: string): Promise<string | null> {
  await requireStaff();
  if (!(await requirePairHost(pairId))) return "Pair not found";
  const error = await q.removePair(getDb(), pairId);
  if (!error) revalidatePath("/", "layout");
  return error;
}

// ── Accounts: admin settings and player sign-in ───────────────────────────

/** Admin: add an account, as an admin or a host. */
export async function addAdmin(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  await requireAdmin();
  const username = UsernameSchema.safeParse(form.get("username"));
  if (!username.success) return { error: firstError(username) };
  const role = RoleSchema.safeParse(form.get("role"));
  if (!role.success) return { error: firstError(role) };
  const pw = NewPasswordSchema.safeParse(Object.fromEntries(form));
  if (!pw.success) return { error: firstError(pw) };
  const made = await q.createAdmin(
    getDb(),
    username.data,
    hashPassword(pw.data.password),
    role.data,
  );
  if ("error" in made) return { error: made.error };
  revalidatePath("/admin/settings");
  return { error: null, ok: true };
}

/**
 * Any account: name the group that hosts your open plays, and upload or
 * remove its logo.
 */
export async function saveGroup(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const me = await requireStaff();
  const name = String(form.get("groupName") ?? "");
  const error = await applyGroup(getDb(), me.id, form, name);
  if (error) return { error };
  revalidatePath("/", "layout");
  return { error: null, ok: true, message: "Group saved" };
}

/**
 * Save the group name (unless `name` is null) and the form's `logo` file
 * or `removeLogo` box. Returns an error, or null when saved.
 */
async function applyGroup(
  db: q.Db,
  adminId: string,
  form: FormData,
  name: string | null,
): Promise<string | null> {
  const parsed = name === null ? null : GroupNameSchema.safeParse(name);
  if (parsed && !parsed.success) return firstError(parsed);
  const logo = uploaded(form, "logo");
  if (logo) {
    const error = photoError(logo.type, logo.size);
    if (error) return error.replace("photo", "logo");
    await q.saveGroupLogo(db, adminId, logo.type, await bytes(logo));
  } else if (form.get("removeLogo")) {
    await q.removeGroupLogo(db, adminId);
  }
  if (parsed) await q.setGroupName(db, adminId, parsed.data);
  return null;
}

/** Admin: change your own password. Other sessions are signed out. */
export async function changeAdminPassword(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const me = await currentAdmin();
  const secret = process.env.ADMIN_SECRET;
  if (!me || !secret) return { error: "Sign in first" };
  const db = getDb();
  const admin = await q.getAdmin(db, me.id);
  if (
    !admin ||
    !verifyPassword(String(form.get("current") ?? ""), admin.passwordHash)
  ) {
    return { error: "Your current password is wrong" };
  }
  const pw = NewPasswordSchema.safeParse(Object.fromEntries(form));
  if (!pw.success) return { error: firstError(pw) };
  const passwordHash = hashPassword(pw.data.password);
  await q.setAdminPassword(db, me.id, passwordHash);
  // Keep this device signed in with the new password.
  await setAdminCookie(secret, { ...admin, passwordHash });
  return { error: null, ok: true };
}

/** Admin: change another account's level (never the last admin). */
export async function setAccountRole(
  id: string,
  role: unknown,
): Promise<string | null> {
  const me = await requireAdmin();
  if (me.id === id) return "You can't change your own level";
  const parsed = RoleSchema.safeParse(role);
  if (!parsed.success) return firstError(parsed);
  const error = await q.setAdminRole(getDb(), id, parsed.data);
  if (!error) revalidatePath("/admin/settings");
  return error;
}

/** Admin: remove another account (never yourself or the last admin). */
export async function removeAdminAccount(id: string): Promise<string | null> {
  const me = await requireAdmin();
  if (me.id === id) return "You can't remove your own account";
  const error = await q.removeAdmin(getDb(), id);
  if (!error) revalidatePath("/admin/settings");
  return error;
}

/** Player sign-in with username and password. */
export async function playerSignIn(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const secret = authSecret();
  const username = UsernameSchema.safeParse(form.get("username"));
  const password = String(form.get("password") ?? "");
  if (!username.success) return { error: WRONG };
  const player = await q.playerByUsername(getDb(), username.data);
  if (
    !verifyPassword(password, player?.passwordHash ?? decoy()) ||
    !player?.email
  ) {
    return { error: WRONG };
  }
  await setPlayerCookie(secret, player.id, player.email);
  redirect(safeNext(form.get("next"), `/players/${player.id}`));
}

/**
 * Set a player's username and password (the player once paid, or an
 * admin). Leave the password empty to only change the username.
 */
export async function savePlayerLogin(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const playerId = String(form.get("playerId") ?? "");
  if (!(await profileEditorPaid(playerId))) {
    return { error: NOT_PAID };
  }
  const username = UsernameSchema.safeParse(form.get("username"));
  if (!username.success) return { error: firstError(username) };
  const db = getDb();
  const hasPassword = (await q.getPlayerPrivate(db, playerId))?.hasPassword;
  const typed = String(form.get("password") ?? "");
  let passwordHash: string | null = null;
  if (typed || !hasPassword) {
    const pw = NewPasswordSchema.safeParse(Object.fromEntries(form));
    if (!pw.success) return { error: firstError(pw) };
    passwordHash = hashPassword(pw.data.password);
  }
  const error = await q.setPlayerLogin(
    db,
    playerId,
    username.data,
    passwordHash,
  );
  if (error) return { error };
  return { error: null, ok: true };
}
