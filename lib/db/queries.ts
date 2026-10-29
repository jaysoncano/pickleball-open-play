import {
  and,
  asc,
  desc,
  eq,
  gte,
  lt,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type ExtractTablesWithRelations,
  type SQL,
} from "drizzle-orm";
import {
  alias,
  type PgDatabase,
  type PgQueryResultHKT,
} from "drizzle-orm/pg-core";
import { nameKey } from "@/lib/queue/names";
import {
  fullName,
  maskEmail,
  type Hand,
  type ProfileInput,
} from "@/lib/profile/forms";
import {
  CODE_MAX_ATTEMPTS,
  CODE_RESEND_MS,
  CODE_TTL_MS,
  sameHash,
} from "@/lib/profile/verify";
import type { Match, QueueState } from "@/lib/queue/schema";
import type { ProtestInput, ProtestStatus, Score } from "@/lib/ranking/forms";
import {
  LEVEL_INFO,
  LEVELS,
  levelRank,
  type Level,
} from "@/lib/ranking/levels";
import type { RecordedMatch } from "@/lib/ranking/record";
import type { UnitGame } from "@/lib/ranking/standings";
import {
  joinProblem,
  overlaps,
  rankProblem,
  soloProblem,
  strongest,
  type Member,
  type OpenPlayEdit,
  type OpenPlayInput,
  type OpenPlayKind,
} from "@/lib/registration/open-play";
import {
  pairLevel,
  pairName,
  type ConfirmPayment,
  type GuestPair,
  type GuestSolo,
  type PairRegistration,
  type PairUp,
  type RegistrationName,
  type UnpaidPair,
  type PublicSignup,
  type PublicSolo,
  type PaymentMethod,
  type Person,
  type SoloRegistration,
} from "@/lib/registration/forms";
import type { Account, Managers, Role, Venue } from "@/lib/roles";
import { z } from "zod";
import * as schema from "./schema";

/** Who filed a protest, joined alongside the protested player. */
const filer = alias(schema.players, "filer");

const {
  accountCodes,
  admins,
  emailCodes,
  groupLogos,
  openPlayBanners,
  levelChanges,
  matchPlayers,
  matches,
  openPlayHosts,
  openPlayInvites,
  openPlays,
  pairs,
  playerPhotos,
  players,
  protests,
  registrations,
  sessions,
} = schema;

/** Any Drizzle Postgres client for this schema (postgres-js or PGlite). */
export type Db = PgDatabase<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export type PlayerRow = { id: string; name: string; level: Level };

/** "First Last" for display; parts are stored separately. */
const fullNameSql = sql<string>`trim(${players.firstName} || ' ' || ${players.lastName})`;

// ── Players ────────────────────────────────────────────────────────────────

const won = sql<number>`case when (${matchPlayers.side} = 'A') = (${matches.scoreA} > ${matches.scoreB}) then 1 else 0 end`;

export type PlayerSummary = PlayerRow & {
  fullName: string;
  photoUpdatedAt: Date | null;
  games: number;
  wins: number;
};

/** Every player with games and wins, by name. */
/** The real (not guest) player going by this name, any case. */
function realNamed(name: string) {
  return and(
    sql`lower(${players.name}) = ${nameKey(name)}`,
    eq(players.guest, false),
  );
}

export async function listPlayers(db: Db): Promise<PlayerSummary[]> {
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      level: players.level,
      fullName: fullNameSql,
      photoUpdatedAt: players.photoUpdatedAt,
      games: sql<number>`count(${matches.id})::int`,
      wins: sql<number>`coalesce(sum(${won}), 0)::int`,
    })
    .from(players)
    .leftJoin(matchPlayers, eq(matchPlayers.playerId, players.id))
    .leftJoin(matches, eq(matches.id, matchPlayers.matchId))
    // Regular open plays' guests have no shared record.
    .where(eq(players.guest, false))
    .groupBy(players.id)
    .orderBy(asc(sql`lower(${players.name})`));
  return rows;
}

/** A player's public profile. Email and phone are left out on purpose. */
export type PlayerProfile = PlayerRow & {
  firstName: string;
  lastName: string;
  fullName: string;
  homeClub: string;
  bio: string;
  hand: Hand | null;
  photoUpdatedAt: Date | null;
  createdAt: Date;
};

export async function getPlayer(
  db: Db,
  id: string,
): Promise<PlayerProfile | null> {
  const [row] = await db
    .select({
      id: players.id,
      name: players.name,
      level: players.level,
      firstName: players.firstName,
      lastName: players.lastName,
      fullName: fullNameSql,
      homeClub: players.homeClub,
      bio: players.bio,
      hand: players.hand,
      photoUpdatedAt: players.photoUpdatedAt,
      createdAt: players.createdAt,
    })
    .from(players)
    // Guests (Regular open plays) have no profile.
    .where(and(eq(players.id, id), eq(players.guest, false)));
  return row ?? null;
}

/**
 * Registered players for these names, creating any that are new. Names
 * match case-insensitively; the result follows the input order, once each.
 */
export async function ensurePlayers(
  db: Db,
  names: string[],
): Promise<PlayerRow[]> {
  const wanted = new Map<string, string>();
  for (const name of names) {
    const key = nameKey(name);
    if (key && !wanted.has(key)) wanted.set(key, name.trim());
  }
  if (wanted.size === 0) return [];
  const keys = [...wanted.keys()];
  const find = () =>
    db
      .select({ id: players.id, name: players.name, level: players.level })
      .from(players)
      .where(
        and(
          inArray(sql`lower(${players.name})`, keys),
          eq(players.guest, false),
        ),
      );

  const existing = new Set((await find()).map((p) => nameKey(p.name)));
  const missing = keys.filter((k) => !existing.has(k));
  if (missing.length) {
    await db
      .insert(players)
      .values(missing.map((k) => ({ name: wanted.get(k)! })))
      .onConflictDoNothing();
  }
  const byKey = new Map((await find()).map((p) => [nameKey(p.name), p]));
  return keys.map((k) => byKey.get(k)!);
}

/** Rename a registered player. Returns an error, or null when renamed. */
export async function renamePlayer(
  db: Db,
  id: string,
  name: string,
): Promise<string | null> {
  const [taken] = await db
    .select({ id: players.id })
    .from(players)
    .where(realNamed(name));
  if (taken && taken.id !== id) return `${name} is already registered`;
  const rows = await db
    .update(players)
    .set({ name: name.trim() })
    .where(eq(players.id, id))
    .returning({ id: players.id });
  return rows.length ? null : "Player not found";
}

/**
 * Change the names a player registered with: queue name, first and last.
 * Returns an error, or null when saved.
 */
export async function setRegistrationName(
  db: Db,
  input: RegistrationName,
): Promise<string | null> {
  const [taken] = await db
    .select({ id: players.id })
    .from(players)
    .where(realNamed(input.name));
  if (taken && taken.id !== input.playerId) {
    return `${input.name} is already registered`;
  }
  const rows = await db
    .update(players)
    .set({
      name: input.name,
      firstName: input.firstName,
      lastName: input.lastName,
    })
    .where(eq(players.id, input.playerId))
    .returning({ id: players.id });
  return rows.length ? null : "Player not found";
}

/** Set a player's level directly, keeping a record of the change. */
export async function setLevel(
  db: Db,
  playerId: string,
  level: Level,
  note = "",
  protestId: string | null = null,
): Promise<boolean> {
  const player = await getPlayer(db, playerId);
  if (!player) return false;
  if (player.level === level) return true;
  await db.transaction(async (tx) => {
    await tx.update(players).set({ level }).where(eq(players.id, playerId));
    await tx.insert(levelChanges).values({
      playerId,
      fromLevel: player.level,
      toLevel: level,
      note,
      protestId,
    });
  });
  return true;
}

export async function levelHistory(db: Db, playerId: string) {
  return db
    .select({
      id: levelChanges.id,
      fromLevel: levelChanges.fromLevel,
      toLevel: levelChanges.toLevel,
      note: levelChanges.note,
      protestId: levelChanges.protestId,
      createdAt: levelChanges.createdAt,
    })
    .from(levelChanges)
    .where(eq(levelChanges.playerId, playerId))
    .orderBy(desc(levelChanges.createdAt));
}

// ── Profiles ───────────────────────────────────────────────────────────────

/** Private details: contact info, and the secret in the player's QR code. */
export async function getPlayerPrivate(
  db: Db,
  id: string,
): Promise<{
  email: string | null;
  emailConfirmedAt: Date | null;
  phone: string;
  claimToken: string;
  username: string | null;
  hasPassword: boolean;
} | null> {
  const [row] = await db
    .select({
      username: players.username,
      hasPassword: sql<boolean>`${players.passwordHash} is not null`,
      email: players.email,
      emailConfirmedAt: players.emailConfirmedAt,
      phone: players.phone,
      claimToken: players.claimToken,
    })
    .from(players)
    .where(eq(players.id, id));
  return row ?? null;
}

/** The player a QR code belongs to. */
export async function playerByClaimToken(
  db: Db,
  token: string,
): Promise<{ id: string; name: string; email: string | null } | null> {
  const [row] = await db
    .select({ id: players.id, name: players.name, email: players.email })
    .from(players)
    .where(eq(players.claimToken, token));
  return row ?? null;
}

export type ProfileSetupRow = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Private: for admin views only. */
  email: string | null;
  claimToken: string;
  hasEmail: boolean;
  /** The player proved the email with a code (not just typed by an admin). */
  emailConfirmed: boolean;
  hasPhoto: boolean;
  photoUpdatedAt: Date | null;
};

/**
 * Players' QR secrets and how far they are with their profile, by name.
 * Pass `ids` to limit it, e.g. to today's session.
 */
export async function listClaimTokens(
  db: Db,
  ids?: string[],
): Promise<ProfileSetupRow[]> {
  if (ids && ids.length === 0) return [];
  return db
    .select({
      id: players.id,
      name: players.name,
      firstName: players.firstName,
      lastName: players.lastName,
      fullName: fullNameSql,
      email: players.email,
      claimToken: players.claimToken,
      hasEmail: sql<boolean>`${players.email} is not null`,
      emailConfirmed: sql<boolean>`${players.emailConfirmedAt} is not null`,
      hasPhoto: sql<boolean>`${players.photoUpdatedAt} is not null`,
      photoUpdatedAt: players.photoUpdatedAt,
    })
    .from(players)
    .where(
      and(eq(players.guest, false), ids ? inArray(players.id, ids) : undefined),
    )
    .orderBy(asc(sql`lower(${players.name})`));
}

/** Issue a new QR secret, so any printed code stops working. */
export async function regenerateClaimToken(
  db: Db,
  id: string,
): Promise<string | null> {
  const [row] = await db
    .update(players)
    .set({ claimToken: sql`gen_random_uuid()` })
    .where(eq(players.id, id))
    .returning({ token: players.claimToken });
  return row?.token ?? null;
}

async function emailOwner(db: Db, email: string) {
  const [row] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.email, email));
  return row?.id ?? null;
}

export type CodeRequest = {
  playerId: string;
  email: string;
  codeHash: string;
  now?: Date;
};

/**
 * Store a hashed code for a player and email, replacing older ones.
 * Refused if the profile is linked to another email, the email belongs to
 * another player, or a code was sent less than a minute ago.
 */
export async function issueEmailCode(
  db: Db,
  { playerId, email, codeHash, now = new Date() }: CodeRequest,
): Promise<string | null> {
  const contact = await getPlayerPrivate(db, playerId);
  if (!contact) return "Player not found";
  if (contact.email && contact.email !== email) {
    return `This profile is linked to ${maskEmail(contact.email)}. Use that email, or ask an admin to change it.`;
  }
  const owner = await emailOwner(db, email);
  if (owner && owner !== playerId) {
    return "That email is linked to another player";
  }
  const [last] = await db
    .select({ createdAt: emailCodes.createdAt })
    .from(emailCodes)
    .where(eq(emailCodes.playerId, playerId))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (last && now.getTime() - last.createdAt.getTime() < CODE_RESEND_MS) {
    return "A code was just sent. Wait a minute before asking again.";
  }
  await db.transaction(async (tx) => {
    await tx.delete(emailCodes).where(eq(emailCodes.playerId, playerId));
    await tx.insert(emailCodes).values({
      playerId,
      email,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      createdAt: now,
    });
  });
  return null;
}

/**
 * Check a code. On success the codes are used up and, the first time, the
 * email is linked to the player. Returns an error, or null when verified.
 */
export async function checkEmailCode(
  db: Db,
  { playerId, email, codeHash, now = new Date() }: CodeRequest,
): Promise<string | null> {
  const [code] = await db
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.playerId, playerId), eq(emailCodes.email, email)));
  if (!code || code.expiresAt <= now) {
    return "That code expired. Send a new one.";
  }
  if (code.attempts >= CODE_MAX_ATTEMPTS) {
    return "Too many tries. Send a new code.";
  }
  if (!sameHash(code.codeHash, codeHash)) {
    await db
      .update(emailCodes)
      .set({ attempts: code.attempts + 1 })
      .where(eq(emailCodes.id, code.id));
    const left = CODE_MAX_ATTEMPTS - code.attempts - 1;
    return left > 0
      ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.`
      : "Too many tries. Send a new code.";
  }
  const owner = await emailOwner(db, email);
  if (owner && owner !== playerId) {
    return "That email is linked to another player";
  }
  await db.transaction(async (tx) => {
    await tx.delete(emailCodes).where(eq(emailCodes.playerId, playerId));
    await tx
      .update(players)
      .set({ email, emailConfirmedAt: now })
      .where(
        and(
          eq(players.id, playerId),
          sql`(${players.email} is null or ${players.email} = ${email})`,
        ),
      );
  });
  return null;
}

/**
 * Mark the email confirmed (the player opened an emailed link). False if
 * the player's email has changed since the link was sent.
 */
export async function confirmEmail(
  db: Db,
  playerId: string,
  email: string,
  now = new Date(),
): Promise<boolean> {
  const rows = await db
    .update(players)
    .set({ emailConfirmedAt: now })
    .where(and(eq(players.id, playerId), eq(players.email, email)))
    .returning({ id: players.id });
  return rows.length > 0;
}

/**
 * Save a player's basic info. A new email starts unconfirmed until the
 * player checks a code. Returns an error, or null when saved.
 */
export async function updateProfile(
  db: Db,
  id: string,
  input: ProfileInput,
): Promise<string | null> {
  const owner = await emailOwner(db, input.email);
  if (owner && owner !== id) return "That email is linked to another player";
  const rows = await db
    .update(players)
    .set({
      ...input,
      // SET expressions see the old row, so this compares before/after.
      emailConfirmedAt: sql`case when ${players.email} = ${input.email} then ${players.emailConfirmedAt} end`,
    })
    .where(eq(players.id, id))
    .returning({ id: players.id });
  return rows.length ? null : "Player not found";
}

export async function savePhoto(
  db: Db,
  playerId: string,
  mime: string,
  data: Uint8Array,
  now = new Date(),
): Promise<boolean> {
  if (!(await getPlayer(db, playerId))) return false;
  await db.transaction(async (tx) => {
    await tx
      .insert(playerPhotos)
      .values({ playerId, mime, data })
      .onConflictDoUpdate({
        target: playerPhotos.playerId,
        set: { mime, data },
      });
    await tx
      .update(players)
      .set({ photoUpdatedAt: now })
      .where(eq(players.id, playerId));
  });
  return true;
}

export async function getPhoto(
  db: Db,
  playerId: string,
): Promise<{ mime: string; data: Uint8Array } | null> {
  const [row] = await db
    .select({ mime: playerPhotos.mime, data: playerPhotos.data })
    .from(playerPhotos)
    .where(eq(playerPhotos.playerId, playerId));
  return row ?? null;
}

export async function removePhoto(db: Db, playerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(playerPhotos).where(eq(playerPhotos.playerId, playerId));
    await tx
      .update(players)
      .set({ photoUpdatedAt: null })
      .where(eq(players.id, playerId));
  });
}

// ── Open plays ─────────────────────────────────────────────────────────────

export type OpenPlay = {
  id: string;
  venue: string;
  location: string;
  /** The account that scheduled it (null once that account is removed). */
  createdBy: string | null;
  /** That account's group, which hosts it ("" when none). */
  groupName: string;
  groupLogoUpdatedAt: Date | null;
  /** Null until a banner is uploaded (the placeholder shows). */
  bannerUpdatedAt: Date | null;
  playDate: string;
  startTime: string;
  endTime: string;
  /** The ticked ranks, lowest first. */
  levels: Level[];
  maxPairs: number | null;
  feeCents: number;
  /** Regular (names only, stats stay here) or Ranked (shared record). */
  kind: OpenPlayKind;
  /** Paid pairs so far (pending sign-ups don't count). */
  pairCount: number;
  /** A session is running for it now. */
  live: boolean;
  /** Its session ran and ended: it shows results, not in the lists. */
  ended: boolean;
};

// Fully qualified: Drizzle renders columns unqualified inside sql``, which
// would compare the subquery's own columns.
const pairCountSql = sql<number>`(select count(*)::int from "pairs" p where p."open_play_id" = "open_plays"."id" and p."status" = 'paid')`;
const liveSql = sql<boolean>`exists (select 1 from "sessions" s where s."open_play_id" = "open_plays"."id" and s."status" = 'active')`;
const endedSql = sql<boolean>`exists (select 1 from "sessions" s where s."open_play_id" = "open_plays"."id" and s."status" = 'ended') and not exists (select 1 from "sessions" s where s."open_play_id" = "open_plays"."id" and s."status" = 'active')`;

const groupNameSql = sql<string>`coalesce((select a."group_name" from "admins" a where a."id" = "open_plays"."created_by"), '')`;
const groupLogoSql =
  sql<Date | null>`(select a."logo_updated_at" from "admins" a where a."id" = "open_plays"."created_by")`.mapWith(
    (v: string | Date | null) => (v === null ? null : new Date(v)),
  );

const openPlayFields = {
  id: openPlays.id,
  venue: openPlays.venue,
  location: openPlays.location,
  createdBy: openPlays.createdBy,
  groupName: groupNameSql,
  groupLogoUpdatedAt: groupLogoSql,
  bannerUpdatedAt: openPlays.bannerUpdatedAt,
  playDate: openPlays.playDate,
  startTime: openPlays.startTime,
  endTime: openPlays.endTime,
  levels: openPlays.levels,
  maxPairs: openPlays.maxPairs,
  feeCents: openPlays.feeCents,
  kind: openPlays.kind,
  pairCount: pairCountSql,
  live: liveSql,
  ended: endedSql,
};

export async function createOpenPlay(
  db: Db,
  /** `kind` defaults to Ranked. */
  input: Omit<OpenPlayInput, "kind"> & { kind?: OpenPlayKind },
  /** The account scheduling it; it manages the open play. */
  createdBy: string | null = null,
): Promise<string> {
  const [row] = await db
    .insert(openPlays)
    .values({ ...input, createdBy })
    .returning({ id: openPlays.id });
  return row.id;
}

/** Open plays this account created or was invited to host. */
const managedBy = (adminId: string) =>
  or(
    eq(openPlays.createdBy, adminId),
    sql`exists (select 1 from "open_play_hosts" h where h."open_play_id" = "open_plays"."id" and h."admin_id" = ${adminId})`,
  );

/**
 * Open plays on one date, or from a date on, by date and start time
 * (or before a date, newest first).
 * With `managedBy`, only the ones that account runs.
 */
export async function listOpenPlays(
  db: Db,
  filter: {
    playDate?: string;
    from?: string;
    /** Only open plays before this date (past ones), newest first. */
    before?: string;
    managedBy?: string;
    /** Only the open plays this account's group hosts (it scheduled). */
    hostedBy?: string;
  },
): Promise<OpenPlay[]> {
  return db
    .select(openPlayFields)
    .from(openPlays)
    .where(
      and(
        filter.playDate ? eq(openPlays.playDate, filter.playDate) : undefined,
        filter.from ? gte(openPlays.playDate, filter.from) : undefined,
        filter.before ? lt(openPlays.playDate, filter.before) : undefined,
        filter.managedBy ? managedBy(filter.managedBy) : undefined,
        filter.hostedBy ? eq(openPlays.createdBy, filter.hostedBy) : undefined,
      ),
    )
    .orderBy(
      ...(filter.before
        ? [desc(openPlays.playDate), desc(openPlays.startTime)]
        : [asc(openPlays.playDate), asc(openPlays.startTime)]),
    );
}

/**
 * Venues used before, newest first, one per name: suggestions for the
 * next open play. With `managedBy`, only from that account's open plays.
 */
export async function venueSuggestions(
  db: Db,
  filter: { managedBy?: string } = {},
): Promise<Venue[]> {
  const rows = await db
    .select({ venue: openPlays.venue, location: openPlays.location })
    .from(openPlays)
    .where(
      and(
        ne(openPlays.venue, ""),
        filter.managedBy ? managedBy(filter.managedBy) : undefined,
      ),
    )
    .orderBy(desc(openPlays.createdAt));
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.venue.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getOpenPlay(
  db: Db,
  id: string,
): Promise<OpenPlay | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db
    .select(openPlayFields)
    .from(openPlays)
    .where(eq(openPlays.id, id));
  return row ?? null;
}

/** Delete an open play nobody has signed up for or started. */
export async function removeOpenPlay(
  db: Db,
  id: string,
): Promise<string | null> {
  const [used] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(eq(registrations.openPlayId, id))
    .limit(1);
  const [ran] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.openPlayId, id))
    .limit(1);
  if (used || ran) return "Players signed up already; it can't be removed";
  await db.delete(openPlays).where(eq(openPlays.id, id));
  return null;
}

/**
 * Change an open play's date, time, ranks, cap, or entry. Returns why
 * not, or null when saved. Nothing changes that would strand players: a
 * running session keeps its date, time, and ranks; a rank stays while
 * pairs or solos are in it; the cap stays at or above the paid pairs; and
 * a new time can't clash with another open play its players joined.
 * Fees already paid keep their amount.
 */
export async function updateOpenPlay(
  db: Db,
  id: string,
  input: OpenPlayEdit,
): Promise<string | null> {
  const play = await getOpenPlay(db, id);
  if (!play) return "Open play not found";
  const moved =
    input.playDate !== play.playDate ||
    input.startTime !== play.startTime ||
    input.endTime !== play.endTime;
  const reranked = input.levels.join() !== play.levels.join();
  if (play.live && (moved || reranked)) {
    return "It's running now: end it before changing its date, time, or ranks";
  }
  if (input.maxPairs !== null && input.maxPairs < play.pairCount) {
    return `${play.pairCount} pairs have paid already; allow at least ${play.pairCount}`;
  }
  const { pairs: paid, pending, solos } = await listRegistrations(db, id);
  const inUse = new Map<Level, number>();
  const tally = (level: Level) => inUse.set(level, (inUse.get(level) ?? 0) + 1);
  for (const p of paid) tally(pairLevel(p.members.map((m) => m.level)));
  for (const p of pending) {
    tally(p.requestedLevel ?? pairLevel(p.members.map((m) => m.level)));
  }
  for (const s of solos) tally(s.requestedLevel ?? s.level);
  for (const [level, count] of inUse) {
    if (!input.levels.includes(level)) {
      return `${LEVEL_INFO[level].label} has ${count} sign-up${count === 1 ? "" : "s"}; keep it, or move them first`;
    }
  }
  if (moved) {
    const playerIds = [
      ...paid.flatMap((p) => p.members),
      ...pending.flatMap((p) => p.members),
      ...solos,
    ].map((m) => m.playerId);
    if (playerIds.length) {
      const elsewhere = await db
        .select({
          name: players.name,
          playDate: openPlays.playDate,
          startTime: openPlays.startTime,
          endTime: openPlays.endTime,
        })
        .from(registrations)
        .innerJoin(players, eq(players.id, registrations.playerId))
        .innerJoin(openPlays, eq(openPlays.id, registrations.openPlayId))
        .where(
          and(
            inArray(registrations.playerId, playerIds),
            ne(openPlays.id, id),
            eq(openPlays.playDate, input.playDate),
          ),
        );
      const clash = elsewhere.find((b) => overlaps(b, input));
      if (clash) {
        return `${clash.name} is in another open play at that time`;
      }
    }
  }
  await db
    .update(openPlays)
    .set({
      playDate: input.playDate,
      startTime: input.startTime,
      endTime: input.endTime,
      levels: input.levels,
      maxPairs: input.maxPairs,
      feeCents: input.feeCents,
    })
    .where(eq(openPlays.id, id));
  return null;
}

// ── Open play hosts ────────────────────────────────────────────────────────

/** Who runs an open play: its creator and invited hosts. Null if no such play. */
export async function openPlayManagers(
  db: Db,
  openPlayId: string,
): Promise<Managers | null> {
  if (!z.uuid().safeParse(openPlayId).success) return null;
  const [play] = await db
    .select({ createdBy: openPlays.createdBy })
    .from(openPlays)
    .where(eq(openPlays.id, openPlayId));
  if (!play) return null;
  const hosts = await db
    .select({ id: openPlayHosts.adminId })
    .from(openPlayHosts)
    .where(eq(openPlayHosts.openPlayId, openPlayId));
  return { createdBy: play.createdBy, hostIds: hosts.map((h) => h.id) };
}

export type OpenPlayHost = Account & {
  owner: boolean;
  /** Private: shown only to staff who manage the open play. */
  email: string | null;
  /** The account that made this one, if any. */
  createdBy: string | null;
  /** Its creator can still show the password they set. */
  hasStartPassword: boolean;
};

/** The creator first, then invited hosts by username. */
export async function listOpenPlayHosts(
  db: Db,
  openPlayId: string,
): Promise<OpenPlayHost[]> {
  if (!z.uuid().safeParse(openPlayId).success) return [];
  const account = {
    id: admins.id,
    username: admins.username,
    role: admins.role,
    email: admins.email,
    createdBy: admins.createdBy,
    hasStartPassword: sql<boolean>`${admins.startPassword} is not null`,
  };
  const [owner] = await db
    .select(account)
    .from(openPlays)
    .innerJoin(admins, eq(admins.id, openPlays.createdBy))
    .where(eq(openPlays.id, openPlayId));
  const invited = await db
    .select(account)
    .from(openPlayHosts)
    .innerJoin(admins, eq(admins.id, openPlayHosts.adminId))
    .where(eq(openPlayHosts.openPlayId, openPlayId))
    .orderBy(asc(admins.username));
  return [
    ...(owner ? [{ ...owner, owner: true }] : []),
    ...invited.map((h) => ({ ...h, owner: false })),
  ];
}

export type Invited =
  { added: string } | { invited: string } | { error: string };

/**
 * Invite someone to help run an open play, by username or email. An
 * account joins right away; an email without a verified account gets a
 * pending invite that turns into hosting once they sign up and verify.
 */
export async function inviteHost(
  db: Db,
  openPlayId: string,
  who: string,
  invitedBy: string | null = null,
): Promise<Invited> {
  const managers = await openPlayManagers(db, openPlayId);
  if (!managers) return { error: "Open play not found" };
  const byEmail = who.includes("@");
  const found = byEmail
    ? await adminByEmail(db, who)
    : await adminByUsername(db, who);
  const account = found && (!byEmail || found.verified) ? found : null;
  if (!account) {
    if (!byEmail) return { error: `No account is named ${who}` };
    await db
      .insert(openPlayInvites)
      .values({ openPlayId, email: who, invitedBy })
      .onConflictDoNothing();
    return { invited: who };
  }
  if (
    managers.createdBy === account.id ||
    managers.hostIds.includes(account.id)
  ) {
    return { error: `${account.username} already hosts this open play` };
  }
  await db
    .insert(openPlayHosts)
    .values({ openPlayId, adminId: account.id })
    .onConflictDoNothing();
  return { added: account.username };
}

/**
 * The main host (or an admin) makes a new host account for their open
 * play: it signs in right away (the email counts as checked, since they
 * vouch for it) and co-hosts it. Returns the account, or an error.
 */
export async function createCoHost(
  db: Db,
  input: { openPlayId: string; username: string; email: string },
  passwordHash: string,
  madeBy: MadeBy = {},
): Promise<{ id: string } | { error: string }> {
  if (!(await openPlayManagers(db, input.openPlayId))) {
    return { error: "Open play not found" };
  }
  if (await adminByUsername(db, input.username)) {
    return { error: `The username ${input.username} is taken` };
  }
  if (await adminByEmail(db, input.email)) {
    return {
      error: `${input.email} already has an account. Invite it instead.`,
    };
  }
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(admins)
      .values({
        username: input.username,
        email: input.email,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "host",
        ...madeBy,
      })
      .returning({ id: admins.id });
    await tx
      .insert(openPlayHosts)
      .values({ openPlayId: input.openPlayId, adminId: row.id });
    return { id: row.id };
  });
}

/** Emails invited to host an open play who haven't signed up yet. */
export async function listOpenPlayInvites(
  db: Db,
  openPlayId: string,
): Promise<string[]> {
  if (!z.uuid().safeParse(openPlayId).success) return [];
  const rows = await db
    .select({ email: openPlayInvites.email })
    .from(openPlayInvites)
    .where(eq(openPlayInvites.openPlayId, openPlayId))
    .orderBy(asc(openPlayInvites.email));
  return rows.map((r) => r.email);
}

export async function removeInvite(
  db: Db,
  openPlayId: string,
  email: string,
): Promise<void> {
  await db
    .delete(openPlayInvites)
    .where(
      and(
        eq(openPlayInvites.openPlayId, openPlayId),
        eq(openPlayInvites.email, email),
      ),
    );
}

/** Take an invited host off an open play (its creator stays). */
export async function removeHost(
  db: Db,
  openPlayId: string,
  adminId: string,
): Promise<void> {
  await db
    .delete(openPlayHosts)
    .where(
      and(
        eq(openPlayHosts.openPlayId, openPlayId),
        eq(openPlayHosts.adminId, adminId),
      ),
    );
}

/** The open play a pair signed up for, or null. */
export async function pairOpenPlayId(
  db: Db,
  pairId: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(pairId).success) return null;
  const [row] = await db
    .select({ openPlayId: pairs.openPlayId })
    .from(pairs)
    .where(eq(pairs.id, pairId));
  return row?.openPlayId ?? null;
}

/** Players signed up for any open play this account runs. */
export async function managedPlayerIds(
  db: Db,
  adminId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: registrations.playerId })
    .from(registrations)
    .innerJoin(openPlays, eq(openPlays.id, registrations.openPlayId))
    .where(managedBy(adminId));
  return rows.map((r) => r.id);
}

/** Whether the player signed up for any open play this account runs. */
export async function playerInManagedOpenPlay(
  db: Db,
  playerId: string,
  adminId: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(playerId).success) return false;
  const [row] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .innerJoin(openPlays, eq(openPlays.id, registrations.openPlayId))
    .where(and(eq(registrations.playerId, playerId), managedBy(adminId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Check a pair in at the venue, both players at once (or undo it). False
 * when there's no such pair in this open play.
 */
export async function setPairCheckIn(
  db: Db,
  openPlayId: string,
  pairId: string,
  checkedIn: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  if (!z.uuid().safeParse(pairId).success) return false;
  const rows = await db
    .update(registrations)
    .set({ checkedInAt: checkedIn ? now : null })
    .where(
      and(
        eq(registrations.openPlayId, openPlayId),
        eq(registrations.pairId, pairId),
      ),
    )
    .returning({ id: registrations.id });
  return rows.length > 0;
}

// ── Registrations (pairs) ──────────────────────────────────────────────────

/** People with their current level, for the rank rules. */
async function asMembers(db: Db, people: Person[]): Promise<Member[]> {
  const ids = people.map((p) => p.playerId).filter(Boolean);
  const rows = ids.length
    ? await db
        .select({ id: players.id, name: players.name, level: players.level })
        .from(players)
        .where(inArray(players.id, ids))
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return people.map((p) => {
    const known = byId.get(p.playerId);
    // New players start at the lowest level.
    return known
      ? { name: known.name, level: known.level }
      : { name: p.name, level: LEVELS[0] };
  });
}

/**
 * Why these people can't sign up for this open play, or null. Checks
 * names and emails, double sign-ups, the level range (for a pair, its
 * stronger player), and, for pairs, the cap.
 */
async function registrationProblem(
  db: Db,
  people: Person[],
  openPlayId: string,
  { pair }: { pair: boolean },
): Promise<string | null> {
  const play = await getOpenPlay(db, openPlayId);
  if (!play) return "Open play not found";
  if (play.ended) return "This open play has ended";
  if (play.kind === "regular") {
    return "This is a Regular open play: add pairs by name at the booth";
  }
  for (const p of people) {
    if (p.playerId) {
      if (!(await getPlayer(db, p.playerId))) return "Player not found";
    } else {
      const [taken] = await db
        .select({ id: players.id })
        .from(players)
        .where(realNamed(p.name));
      if (taken) return `${p.name} is already registered. Pick them instead.`;
    }
    const owner = await emailOwner(db, p.email);
    if (owner && owner !== p.playerId) {
      return `${p.email} is linked to another player`;
    }
  }
  const busy = await alreadyBooked(
    db,
    people.map((p) => p.playerId).filter(Boolean),
    play,
  );
  if (busy) return busy;
  const members = await asMembers(db, people);
  if (!pair) return soloProblem(play, members[0]);
  return joinProblem(play, members, play.pairCount);
}

/** A player already signed up for this open play, or one at the same time. */
async function alreadyBooked(
  db: Db,
  playerIds: string[],
  play: OpenPlay,
): Promise<string | null> {
  if (!playerIds.length) return null;
  const booked = await db
    .select({
      name: players.name,
      openPlayId: openPlays.id,
      playDate: openPlays.playDate,
      startTime: openPlays.startTime,
      endTime: openPlays.endTime,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .innerJoin(openPlays, eq(openPlays.id, registrations.openPlayId))
    .where(
      and(
        inArray(registrations.playerId, playerIds),
        eq(openPlays.playDate, play.playDate),
      ),
    );
  const same = booked.find((b) => b.openPlayId === play.id);
  if (same) return `${same.name} is already signed up for this open play`;
  const clash = booked.find((b) => overlaps(b, play));
  return clash
    ? `${clash.name} is signed up for another open play at that time`
    : null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Create or update a person's player row; a changed email is unconfirmed. */
async function savePerson(tx: Tx, p: Person) {
  const info = { firstName: p.firstName, lastName: p.lastName, email: p.email };
  const [row] = p.playerId
    ? await tx
        .update(players)
        .set({
          ...info,
          emailConfirmedAt: sql`case when ${players.email} = ${p.email} then ${players.emailConfirmedAt} end`,
        })
        .where(eq(players.id, p.playerId))
        .returning({ id: players.id, name: players.name })
    : await tx
        .insert(players)
        .values({ ...info, name: p.name })
        .returning({ id: players.id, name: players.name });
  return { ...row, fullName: fullName(p), email: p.email };
}

export type Registered = {
  pairId: string | null;
  players: { id: string; name: string; fullName: string; email: string }[];
};

/** The pair row for an entry paid in full. */
function entry(input: PairRegistration | PairUp) {
  return {
    openPlayId: input.openPlayId,
    status: "paid" as const,
    amountCents: input.amountCents,
    method: input.method,
    notes: input.notes,
    paidAt: new Date(),
  };
}

/**
 * Register a pair at the desk: with its entry, paid in full, or unpaid
 * (pending) until the host confirms the payment.
 */
export async function registerPair(
  db: Db,
  input: PairRegistration | UnpaidPair,
): Promise<Registered | { error: string }> {
  const [a, b] = await linkByEmail(db, [input.a, input.b]);
  const problem = await registrationProblem(db, [a, b], input.openPlayId, {
    pair: true,
  });
  if (problem) return { error: problem };
  return db.transaction(async (tx) => {
    const people = [await savePerson(tx, a), await savePerson(tx, b)];
    const [pair] = await tx
      .insert(pairs)
      .values(
        "amountCents" in input
          ? entry(input)
          : {
              openPlayId: input.openPlayId,
              status: "pending",
              notes: input.notes,
            },
      )
      .returning({ id: pairs.id });
    await tx.insert(registrations).values(
      people.map((p) => ({
        playerId: p.id,
        openPlayId: input.openPlayId,
        pairId: pair.id,
      })),
    );
    return { pairId: pair.id, players: people };
  });
}

/**
 * The first of these names someone in this open play already goes by
 * (any case), leaving out `except` (a player being renamed). Null when
 * all are free: names stay unique within an open play.
 */
async function nameTakenIn(
  db: Db,
  openPlayId: string,
  names: string[],
  except: string[] = [],
): Promise<string | null> {
  const keys = names.map(nameKey);
  const rows = await db
    .select({ name: players.name })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(
      and(
        eq(registrations.openPlayId, openPlayId),
        inArray(sql`lower(${players.name})`, keys),
        except.length ? notInArray(players.id, except) : undefined,
      ),
    );
  const taken = new Set(rows.map((r) => nameKey(r.name)));
  return names.find((n) => taken.has(nameKey(n))) ?? null;
}

/**
 * A Regular open play's pair, by name only ("gel/son"): two guest players
 * for this open play (no email, no shared record), paid or not. Guests
 * take the rank the host picked (the open play's lowest by default), so
 * the rank rule never turns them away; a paid pair still has to fit the
 * cap.
 */
export async function registerGuestPair(
  db: Db,
  input: GuestPair,
): Promise<{ pairId: string } | { error: string }> {
  const play = await getOpenPlay(db, input.openPlayId);
  if (!play) return { error: "Open play not found" };
  if (play.ended) return { error: "This open play has ended" };
  if (play.kind !== "regular") {
    return { error: "Ranked open plays need each player's details" };
  }
  if (input.paid && play.maxPairs !== null && play.pairCount >= play.maxPairs) {
    return { error: "This open play is full" };
  }
  if (input.rank && !play.levels.includes(input.rank)) {
    return { error: "Pick one of this open play's ranks" };
  }
  const taken = await nameTakenIn(db, play.id, input.names);
  if (taken) return { error: `${taken} is already in this open play` };
  const level = input.rank ?? play.levels[0] ?? "beginner";
  return db.transaction(async (tx) => {
    const people = await tx
      .insert(players)
      .values(input.names.map((name) => ({ name, level, guest: true })))
      .returning({ id: players.id });
    const [pair] = await tx
      .insert(pairs)
      .values(
        input.paid
          ? {
              openPlayId: play.id,
              status: "paid",
              amountCents: play.feeCents,
              method: "cash",
              notes: input.notes,
              paidAt: new Date(),
            }
          : { openPlayId: play.id, status: "pending", notes: input.notes },
      )
      .returning({ id: pairs.id });
    await tx.insert(registrations).values(
      people.map((p) => ({
        playerId: p.id,
        openPlayId: play.id,
        pairId: pair.id,
      })),
    );
    return { pairId: pair.id };
  });
}

/** A Regular open play's player who came alone, by name: paired later. */
export async function registerGuestSolo(
  db: Db,
  input: GuestSolo,
): Promise<{ playerId: string } | { error: string }> {
  const play = await getOpenPlay(db, input.openPlayId);
  if (!play) return { error: "Open play not found" };
  if (play.ended) return { error: "This open play has ended" };
  if (play.kind !== "regular") {
    return { error: "Ranked open plays need each player's details" };
  }
  if (input.rank && !play.levels.includes(input.rank)) {
    return { error: "Pick one of this open play's ranks" };
  }
  const taken = await nameTakenIn(db, play.id, [input.name]);
  if (taken) return { error: `${taken} is already in this open play` };
  return db.transaction(async (tx) => {
    const [me] = await tx
      .insert(players)
      .values({
        name: input.name,
        level: input.rank ?? play.levels[0] ?? "beginner",
        guest: true,
      })
      .returning({ id: players.id });
    await tx
      .insert(registrations)
      .values({ playerId: me.id, openPlayId: play.id });
    return { playerId: me.id };
  });
}

/**
 * Regular open plays: pair two guests who came alone, paid (the entry
 * fee, cash) or not. A paid pair has to fit the cap.
 */
export async function pairGuestSolos(
  db: Db,
  input: { openPlayId: string; a: string; b: string; paid: boolean },
): Promise<{ pairId: string } | { error: string }> {
  const play = await getOpenPlay(db, input.openPlayId);
  if (!play) return { error: "Open play not found" };
  if (play.ended) return { error: "This open play has ended" };
  if (play.kind !== "regular") return { error: "Only Regular open plays" };
  const ids = [input.a, input.b];
  if (
    input.a === input.b ||
    !ids.every((id) => z.uuid().safeParse(id).success)
  ) {
    return { error: "Pick two different players" };
  }
  const solos = await db
    .select({ id: registrations.id })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(
      and(
        eq(registrations.openPlayId, play.id),
        isNull(registrations.pairId),
        eq(players.guest, true),
        inArray(registrations.playerId, ids),
      ),
    );
  if (solos.length !== 2) {
    return { error: "Both players must be signed up alone for this open play" };
  }
  if (input.paid && play.maxPairs !== null && play.pairCount >= play.maxPairs) {
    return { error: "This open play is full" };
  }
  return db.transaction(async (tx) => {
    const [pair] = await tx
      .insert(pairs)
      .values(
        input.paid
          ? {
              openPlayId: play.id,
              status: "paid",
              amountCents: play.feeCents,
              method: "cash",
              paidAt: new Date(),
            }
          : { openPlayId: play.id, status: "pending" },
      )
      .returning({ id: pairs.id });
    await tx
      .update(registrations)
      .set({ pairId: pair.id })
      .where(
        inArray(
          registrations.id,
          solos.map((s) => s.id),
        ),
      );
    return { pairId: pair.id };
  });
}

/**
 * Regular open plays: fix a solo guest's name, or remove them (they
 * haven't paired yet). Returns an error, or null.
 */
export async function renameGuestSolo(
  db: Db,
  playerId: string,
  name: string,
): Promise<string | null> {
  const openPlayId = await soloGuest(db, playerId);
  if (!openPlayId) return "Player not found";
  const taken = await nameTakenIn(db, openPlayId, [name], [playerId]);
  if (taken) return `${taken} is already in this open play`;
  await db.update(players).set({ name }).where(eq(players.id, playerId));
  return null;
}

export async function removeGuestSolo(
  db: Db,
  playerId: string,
): Promise<string | null> {
  if (!(await soloGuest(db, playerId))) return "Player not found";
  // A guest belongs to one open play: removing the sign-up removes them.
  await db.transaction(async (tx) => {
    await tx.delete(registrations).where(eq(registrations.playerId, playerId));
    await tx.delete(players).where(eq(players.id, playerId));
  });
  return null;
}

/** The open play a guest signed up alone for, or null. */
export async function soloGuest(
  db: Db,
  playerId: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(playerId).success) return null;
  const [row] = await db
    .select({ openPlayId: registrations.openPlayId })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(
      and(
        eq(registrations.playerId, playerId),
        isNull(registrations.pairId),
        eq(players.guest, true),
      ),
    );
  return row?.openPlayId ?? null;
}

/**
 * Regular open plays: the host typed one name for a pair. That player
 * stays, alone (renamed to what was typed), ready to pair again; the other
 * is removed, and so is the pair and its payment. Not while the pair is in
 * a running queue. Returns an error, or null.
 */
export async function splitGuestPair(
  db: Db,
  pairId: string,
  name: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(pairId).success) return "Pair not found";
  const people = await db
    .select({
      id: players.id,
      name: players.name,
      guest: players.guest,
      openPlayId: registrations.openPlayId,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(eq(registrations.pairId, pairId))
    .orderBy(asc(registrations.createdAt), asc(sql`lower(${players.name})`));
  if (people.length !== 2) return "Pair not found";
  if (!people.every((p) => p.guest)) {
    return "Only Regular pairs are changed here";
  }
  const session = await getLiveSession(db, people[0].openPlayId);
  if (session?.players[pairId]) {
    return "They're in the queue. Remove them there first.";
  }
  const keep =
    people.find((p) => nameKey(p.name) === nameKey(name)) ?? people[0];
  const drop = people.find((p) => p.id !== keep.id)!;
  const taken = await nameTakenIn(
    db,
    keep.openPlayId,
    [name],
    people.map((p) => p.id),
  );
  if (taken) return `${taken} is already in this open play`;
  await db.transaction(async (tx) => {
    await tx
      .update(registrations)
      .set({ pairId: null })
      .where(eq(registrations.playerId, keep.id));
    await tx.update(players).set({ name }).where(eq(players.id, keep.id));
    await tx.delete(registrations).where(eq(registrations.playerId, drop.id));
    await tx.delete(players).where(eq(players.id, drop.id));
    await tx.delete(pairs).where(eq(pairs.id, pairId));
  });
  return null;
}

/**
 * Regular open plays: fix a pair's names (two guests, in list order). A
 * running queue shows the new names too. Returns an error, or null.
 */
export async function renameGuestPair(
  db: Db,
  pairId: string,
  names: [string, string],
): Promise<string | null> {
  if (!z.uuid().safeParse(pairId).success) return "Pair not found";
  const people = await db
    .select({
      id: players.id,
      guest: players.guest,
      openPlayId: registrations.openPlayId,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(eq(registrations.pairId, pairId))
    .orderBy(asc(registrations.createdAt), asc(sql`lower(${players.name})`));
  if (people.length !== 2) return "Pair not found";
  if (!people.every((p) => p.guest)) {
    return "Only Regular pairs are renamed here";
  }
  const taken = await nameTakenIn(
    db,
    people[0].openPlayId,
    names,
    people.map((p) => p.id),
  );
  if (taken) return `${taken} is already in this open play`;
  await db.transaction(async (tx) => {
    for (const [i, p] of people.entries()) {
      await tx
        .update(players)
        .set({ name: names[i] })
        .where(eq(players.id, p.id));
    }
  });
  const openPlayId = people[0].openPlayId;
  const session = await getLiveSession(db, openPlayId);
  const unit = session?.players[pairId];
  if (session && unit) {
    await saveSession(db, openPlayId, {
      ...session,
      players: {
        ...session.players,
        [pairId]: { ...unit, name: pairName(names) },
      },
    });
  }
  return null;
}

/**
 * Regular open plays: mark a paid pair as not paid after all. Returns an
 * error, or null when done.
 */
export async function markPairUnpaid(
  db: Db,
  pairId: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(pairId).success) return "Pair not found";
  const [row] = await db
    .select({ kind: openPlays.kind })
    .from(pairs)
    .innerJoin(openPlays, eq(openPlays.id, pairs.openPlayId))
    .where(eq(pairs.id, pairId));
  if (!row) return "Pair not found";
  if (row.kind !== "regular") return "Only Regular open plays can do that";
  await db
    .update(pairs)
    .set({ status: "pending", amountCents: null, method: null, paidAt: null })
    .where(eq(pairs.id, pairId));
  return null;
}

/** Sign up a player alone, looking for a partner (unpaid until paired). */
export async function registerSolo(
  db: Db,
  input: SoloRegistration,
): Promise<Registered | { error: string }> {
  const [a] = await linkByEmail(db, [input.a]);
  const problem = await registrationProblem(db, [a], input.openPlayId, {
    pair: false,
  });
  if (problem) return { error: problem };
  return db.transaction(async (tx) => {
    const person = await savePerson(tx, a);
    await tx
      .insert(registrations)
      .values({ playerId: person.id, openPlayId: input.openPlayId });
    return { pairId: null, players: [person] };
  });
}

/** Pair two solo players of an open play; the pair pays the full entry. */
export async function pairSolos(
  db: Db,
  input: PairUp,
): Promise<Registered | { error: string }> {
  const ids = { a: input.a.playerId, b: input.b.playerId };
  const solos = await db
    .select({
      id: players.id,
      name: players.name,
      fullName: fullNameSql,
      email: players.email,
      level: players.level,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(
      and(
        eq(registrations.openPlayId, input.openPlayId),
        isNull(registrations.pairId),
        inArray(registrations.playerId, [ids.a, ids.b]),
      ),
    );
  if (solos.length !== 2) {
    return { error: "Both players must be signed up alone for this open play" };
  }
  // In the order the desk picked them.
  const order = [ids.a, ids.b];
  solos.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  const play = await getOpenPlay(db, input.openPlayId);
  const problem =
    play &&
    joinProblem(
      play,
      solos.map((p) => ({ name: p.name, level: p.level })),
      play.pairCount,
    );
  if (problem) return { error: problem };
  return db.transaction(async (tx) => {
    const [pair] = await tx
      .insert(pairs)
      .values(entry(input))
      .returning({ id: pairs.id });
    await tx
      .update(registrations)
      .set({ pairId: pair.id })
      .where(
        and(
          eq(registrations.openPlayId, input.openPlayId),
          inArray(registrations.playerId, [ids.a, ids.b]),
        ),
      );
    return {
      pairId: pair.id,
      players: solos.map((p) => ({
        id: p.id,
        name: p.name,
        fullName: p.fullName,
        email: p.email ?? "",
      })),
    };
  });
}

export type DayMember = {
  playerId: string;
  name: string;
  fullName: string;
  level: Level;
  photoUpdatedAt: Date | null;
  /** Solo sign-ups: the rank they asked for (null: their own level). */
  requestedLevel: Level | null;
  /** The host checked them in at the venue. */
  checkedIn: boolean;
};

export type DayPair = {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  notes: string;
  createdAt: Date;
  members: DayMember[];
};

/** A pair that signed up online and waits for the admin to confirm payment. */
export type PendingPair = {
  id: string;
  requestedLevel: Level | null;
  notes: string;
  createdAt: Date;
  members: DayMember[];
};

/**
 * An open play's paid pairs, pairs pending payment (signed up online), and
 * solos awaiting a partner.
 */
export async function listRegistrations(
  db: Db,
  openPlayId: string,
): Promise<{ pairs: DayPair[]; pending: PendingPair[]; solos: DayMember[] }> {
  const rows = await db
    .select({
      pairId: registrations.pairId,
      playerId: players.id,
      name: players.name,
      fullName: fullNameSql,
      level: players.level,
      photoUpdatedAt: players.photoUpdatedAt,
      requestedLevel: registrations.requestedLevel,
      checkedInAt: registrations.checkedInAt,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(eq(registrations.openPlayId, openPlayId))
    .orderBy(asc(registrations.createdAt), asc(sql`lower(${players.name})`));
  const all = await db
    .select()
    .from(pairs)
    .where(eq(pairs.openPlayId, openPlayId))
    .orderBy(desc(pairs.createdAt));
  const member = (r: (typeof rows)[number]): DayMember => ({
    playerId: r.playerId,
    name: r.name,
    fullName: r.fullName,
    level: r.level,
    photoUpdatedAt: r.photoUpdatedAt,
    requestedLevel: r.requestedLevel,
    checkedIn: r.checkedInAt !== null,
  });
  const membersOf = (id: string) =>
    rows.filter((r) => r.pairId === id).map(member);
  return {
    pairs: all.flatMap((p) =>
      p.status === "paid" && p.amountCents !== null && p.method !== null
        ? [
            {
              id: p.id,
              amountCents: p.amountCents,
              method: p.method,
              notes: p.notes,
              createdAt: p.paidAt ?? p.createdAt,
              members: membersOf(p.id),
            },
          ]
        : [],
    ),
    pending: all
      .filter((p) => p.status === "pending")
      .map((p) => ({
        id: p.id,
        requestedLevel: p.requestedLevel,
        notes: p.notes,
        createdAt: p.createdAt,
        members: membersOf(p.id),
      }))
      .reverse(),
    solos: rows.filter((r) => !r.pairId).map(member),
  };
}

// ── Online sign-up and payment approval ────────────────────────────────────

/**
 * Match public sign-up names to players. A taken name only counts as that
 * player when the email matches the one on file, so nobody can sign up as
 * someone else.
 */
/**
 * Players are shared across open plays: someone typed in as new whose
 * email is already on a player is that player, with their name, level,
 * and history. Their info on file is kept.
 */
async function linkByEmail(db: Db, people: Person[]): Promise<Person[]> {
  return Promise.all(
    people.map(async (p) => {
      if (p.playerId) return p;
      const [found] = await db
        .select({
          id: players.id,
          firstName: players.firstName,
          lastName: players.lastName,
        })
        .from(players)
        .where(eq(players.email, p.email));
      return found
        ? {
            ...p,
            playerId: found.id,
            name: "",
            firstName: found.firstName || p.firstName,
            lastName: found.lastName || p.lastName,
          }
        : p;
    }),
  );
}

async function resolvePublic(
  db: Db,
  people: Person[],
): Promise<Person[] | { error: string }> {
  const out: Person[] = [];
  for (const p of await linkByEmail(db, people)) {
    if (p.playerId) {
      out.push(p);
      continue;
    }
    const [found] = await db
      .select({ id: players.id, name: players.name, email: players.email })
      .from(players)
      .where(realNamed(p.name));
    if (!found) {
      out.push(p);
      continue;
    }
    if (found.email !== p.email) {
      return {
        error: `${found.name} is already a player. Use the email on their profile, or sign up at the booth.`,
      };
    }
    out.push({ ...p, playerId: found.id, name: "" });
  }
  return out;
}

/**
 * A pair signs up online for one rank. It's saved as pending payment;
 * nothing counts toward the cap or the queue until an admin confirms.
 */
export async function signUpPair(
  db: Db,
  input: PublicSignup,
): Promise<{ pairId: string; names: string[] } | { error: string }> {
  const people = await resolvePublic(db, [input.a, input.b]);
  if ("error" in people) return people;
  const problem = await registrationProblem(db, people, input.openPlayId, {
    pair: true,
  });
  if (problem) return { error: problem };
  const members = await asMembers(db, people);
  const top = strongest(members)!;
  if (top.level !== input.rank) {
    return {
      error:
        levelRank(top.level) > levelRank(input.rank)
          ? `${top.name} is ${LEVEL_INFO[top.level].label}, so this pair can't join ${LEVEL_INFO[input.rank].label}`
          : `This pair plays ${LEVEL_INFO[top.level].label}; pick the ${LEVEL_INFO[top.level].label} rank`,
    };
  }
  return db.transaction(async (tx) => {
    const saved = [
      await savePerson(tx, people[0]),
      await savePerson(tx, people[1]),
    ];
    const [pair] = await tx
      .insert(pairs)
      .values({
        openPlayId: input.openPlayId,
        status: "pending",
        requestedLevel: input.rank,
      })
      .returning({ id: pairs.id });
    await tx.insert(registrations).values(
      saved.map((p) => ({
        playerId: p.id,
        openPlayId: input.openPlayId,
        pairId: pair.id,
      })),
    );
    return { pairId: pair.id, names: saved.map((p) => p.name) };
  });
}

/**
 * A player signs up alone online for a rank. They join the "looking for a
 * partner" list; a partner can lift the pair's level, so only a player
 * above the chosen rank is turned away.
 */
export async function signUpSolo(
  db: Db,
  input: PublicSolo,
): Promise<{ playerId: string; name: string } | { error: string }> {
  const people = await resolvePublic(db, [input.a]);
  if ("error" in people) return people;
  const problem = await registrationProblem(db, people, input.openPlayId, {
    pair: false,
  });
  if (problem) return { error: problem };
  const [me] = await asMembers(db, people);
  if (levelRank(me.level) > levelRank(input.rank)) {
    return {
      error: `${me.name} is ${LEVEL_INFO[me.level].label}, so they can't join ${LEVEL_INFO[input.rank].label}`,
    };
  }
  return db.transaction(async (tx) => {
    const saved = await savePerson(tx, people[0]);
    await tx.insert(registrations).values({
      playerId: saved.id,
      openPlayId: input.openPlayId,
      requestedLevel: input.rank,
    });
    return { playerId: saved.id, name: saved.name };
  });
}

/** The pair's open play and its players, with email and name for receipts. */
async function pairPeople(db: Db, pairId: string) {
  return db
    .select({
      id: players.id,
      name: players.name,
      fullName: fullNameSql,
      email: players.email,
      level: players.level,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(eq(registrations.pairId, pairId))
    .orderBy(asc(registrations.createdAt), asc(sql`lower(${players.name})`));
}

/**
 * The admin confirms a pending pair's payment: it becomes paid (counts
 * toward the cap, can join the queue). Checks rank and cap again.
 */
export async function confirmPairPayment(
  db: Db,
  input: ConfirmPayment,
): Promise<(Registered & { openPlayId: string }) | { error: string }> {
  const [pair] = await db
    .select()
    .from(pairs)
    .where(eq(pairs.id, input.pairId));
  if (!pair) return { error: "Sign-up not found" };
  if (pair.status === "paid") return { error: "Already paid" };
  const play = await getOpenPlay(db, pair.openPlayId);
  if (!play) return { error: "Open play not found" };
  const people = await pairPeople(db, pair.id);
  const problem = joinProblem(play, people, play.pairCount);
  if (problem) return { error: problem };
  await db
    .update(pairs)
    .set({
      status: "paid",
      amountCents: input.amountCents,
      method: input.method,
      notes: input.notes || pair.notes,
      paidAt: new Date(),
    })
    .where(and(eq(pairs.id, pair.id), eq(pairs.status, "pending")));
  return {
    openPlayId: pair.openPlayId,
    pairId: pair.id,
    players: people.map((p) => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      email: p.email ?? "",
    })),
  };
}

/** Replace the host's notes on a pair; false when there's no such pair. */
export async function setPairNotes(
  db: Db,
  pairId: string,
  notes: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(pairId).success) return false;
  const rows = await db
    .update(pairs)
    .set({ notes })
    .where(eq(pairs.id, pairId))
    .returning({ id: pairs.id });
  return rows.length > 0;
}

/**
 * Remove a pair and its sign-ups: a pending sign-up the admin rejects, or
 * a paid pair (refunded) while its open play isn't running.
 */
export async function removePair(
  db: Db,
  pairId: string,
): Promise<string | null> {
  const [pair] = await db.select().from(pairs).where(eq(pairs.id, pairId));
  if (!pair) return "Pair not found";
  if (
    pair.status === "paid" &&
    (await getOpenPlay(db, pair.openPlayId))?.live
  ) {
    return "This open play is running; remove the pair after it ends";
  }
  await db.transaction(async (tx) => {
    await tx.delete(registrations).where(eq(registrations.pairId, pairId));
    await tx.delete(pairs).where(eq(pairs.id, pairId));
  });
  return null;
}

export type PairUnit = {
  id: string;
  name: string;
  skill: number;
  /**
   * Why the pair can't play here now, e.g. a player was promoted above
   * the open play's ranks after paying. Null when they can.
   */
  blocked: string | null;
  /** The host confirmed the payment. */
  paid: boolean;
  members: { id: string; name: string; checkedIn: boolean }[];
};

/**
 * An open play's pairs, paid and unpaid, as queue units: "Ana & Ben" at
 * its level, checked against the players' current levels, with who's
 * checked in. Before the start only paid, checked-in pairs can join;
 * once live, paid is enough (`notReady`).
 */
export async function rosterPairs(
  db: Db,
  openPlayId: string,
): Promise<PairUnit[]> {
  const play = await getOpenPlay(db, openPlayId);
  if (!play) return [];
  const { pairs: paid, pending } = await listRegistrations(db, openPlayId);
  const unit = (p: { id: string; members: DayMember[] }, isPaid: boolean) => ({
    id: p.id,
    name: pairName(p.members.map((m) => m.name)),
    skill: levelRank(pairLevel(p.members.map((m) => m.level))),
    blocked: rankProblem(play, p.members),
    paid: isPaid,
    members: p.members.map((m) => ({
      id: m.playerId,
      name: m.name,
      checkedIn: m.checkedIn,
    })),
  });
  return [
    ...paid.map((p) => unit(p, true)),
    ...pending.map((p) => unit(p, false)),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

/** An open play's paid pairs as queue units. */
export async function paidPairs(
  db: Db,
  openPlayId: string,
): Promise<PairUnit[]> {
  return (await rosterPairs(db, openPlayId)).filter((p) => p.paid);
}

/** The players in each of these pairs, in sign-up order. */
export async function pairMembers(
  db: Db,
  pairIds: string[],
): Promise<Map<string, { id: string; name: string }[]>> {
  const ids = pairIds.filter((id) => z.uuid().safeParse(id).success);
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      pairId: registrations.pairId,
      id: players.id,
      name: players.name,
    })
    .from(registrations)
    .innerJoin(players, eq(players.id, registrations.playerId))
    .where(inArray(registrations.pairId, ids))
    .orderBy(asc(registrations.createdAt), asc(sql`lower(${players.name})`));
  const out = new Map<string, { id: string; name: string }[]>();
  for (const r of rows) {
    const list = out.get(r.pairId!) ?? [];
    list.push({ id: r.id, name: r.name });
    out.set(r.pairId!, list);
  }
  return out;
}

/** Whether the player has ever signed up (needed to edit their info). */
/**
 * Whether the player is in a pair whose payment was confirmed: that's what
 * unlocks editing their own profile.
 */
export async function hasPaidRegistration(
  db: Db,
  playerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .innerJoin(pairs, eq(pairs.id, registrations.pairId))
    .where(and(eq(registrations.playerId, playerId), eq(pairs.status, "paid")))
    .limit(1);
  return Boolean(row);
}

// ── Sessions ───────────────────────────────────────────────────────────────

/** The live queue of an open play, or null when it isn't running. */
export async function getLiveSession(
  db: Db,
  openPlayId: string,
): Promise<QueueState | null> {
  const [row] = await db
    .select({ state: sessions.state })
    .from(sessions)
    .where(live(openPlayId));
  return row?.state ?? null;
}

/** Every running open play with its live queue. */
export async function listLiveSessions(db: Db) {
  return db
    .select({ openPlayId: sessions.openPlayId, state: sessions.state })
    .from(sessions)
    .where(eq(sessions.status, "active"))
    .orderBy(asc(sessions.startsAt));
}

const live = (openPlayId: string) =>
  and(eq(sessions.openPlayId, openPlayId), eq(sessions.status, "active"));

function window(state: QueueState) {
  return { startsAt: new Date(state.startsAt), endsAt: new Date(state.endsAt) };
}

/** Start an open play's session; false if it's already running. */
export async function startSession(
  db: Db,
  openPlayId: string,
  state: QueueState,
): Promise<boolean> {
  const rows = await db
    .insert(sessions)
    .values({ openPlayId, state, ...window(state) })
    .onConflictDoNothing()
    .returning({ id: sessions.id });
  return rows.length > 0;
}

/** Save an open play's live queue; false if it isn't running. */
export async function saveSession(
  db: Db,
  openPlayId: string,
  state: QueueState,
): Promise<boolean> {
  const rows = await db
    .update(sessions)
    .set({ state, ...window(state), updatedAt: new Date() })
    .where(live(openPlayId))
    .returning({ id: sessions.id });
  return rows.length > 0;
}

export async function endSession(db: Db, openPlayId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ status: "ended", updatedAt: new Date() })
    .where(live(openPlayId));
}

// ── Matches ────────────────────────────────────────────────────────────────

/**
 * Who sat where. Queue units are pairs when the session was built from
 * paid pairs: each expands to its two players on that pair's side. Plain
 * players (older sessions) map one to one.
 */
async function matchSeats(db: Db, game: Match) {
  const half = Math.ceil(game.playerIds.length / 2);
  const side = (i: number) => (i < half ? ("A" as const) : ("B" as const));
  const members = await pairMembers(db, game.playerIds);
  return game.playerIds.flatMap((unit, i) => {
    const team = members.get(unit);
    return team
      ? team.map((p) => ({ playerId: p.id, name: p.name, side: side(i) }))
      : [{ playerId: unit, name: game.playerNames[i], side: side(i) }];
  });
}

/**
 * Record a finished game with its score and save the session that
 * results from finishing it, in one transaction. Each player's current
 * level is stored with the match.
 */
export async function recordMatch(
  db: Db,
  openPlayId: string,
  state: QueueState,
  game: Match,
  score: Score,
): Promise<boolean> {
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(live(openPlayId));
  if (!session) return false;
  const seats = await matchSeats(db, game);
  const levels = new Map(
    (
      await db
        .select({ id: players.id, level: players.level })
        .from(players)
        .where(
          inArray(
            players.id,
            seats.map((p) => p.playerId),
          ),
        )
    ).map((p) => [p.id, p.level]),
  );

  await db.transaction(async (tx) => {
    const [match] = await tx
      .insert(matches)
      .values({
        sessionId: session.id,
        courtLabel: game.courtLabel,
        startedAt: new Date(game.startedAt),
        endedAt: new Date(game.endedAt),
        ...score,
      })
      .returning({ id: matches.id });
    await tx.insert(matchPlayers).values(
      seats.map((p) => ({
        matchId: match.id,
        ...p,
        level: levels.get(p.playerId) ?? "beginner",
      })),
    );
    await tx
      .update(sessions)
      .set({ state, ...window(state), updatedAt: new Date() })
      .where(eq(sessions.id, session.id));
  });
  return true;
}

/** Matches with their players, newest first. */
async function loadMatches(db: Db, ids: string[]): Promise<RecordedMatch[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(matches)
    .where(inArray(matches.id, ids))
    .orderBy(desc(matches.endedAt));
  const people = await db
    .select()
    .from(matchPlayers)
    .where(inArray(matchPlayers.matchId, ids));
  return rows.map((m) => ({
    id: m.id,
    courtLabel: m.courtLabel,
    startedAt: m.startedAt.getTime(),
    endedAt: m.endedAt.getTime(),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    players: people
      .filter((p) => p.matchId === m.id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map(({ playerId, name, level, side }) => ({
        playerId,
        name,
        level,
        side,
      })),
  }));
}

/** Every match a player was in, newest first. */
export async function playerMatches(
  db: Db,
  playerId: string,
): Promise<RecordedMatch[]> {
  const ids = await db
    .select({ id: matchPlayers.matchId })
    .from(matchPlayers)
    .where(eq(matchPlayers.playerId, playerId));
  return loadMatches(
    db,
    ids.map((r) => r.id),
  );
}

/** The most recent matches across all sessions. */
export async function recentMatches(
  db: Db,
  limit = 20,
): Promise<RecordedMatch[]> {
  const ids = await db
    .select({ id: matches.id })
    .from(matches)
    .orderBy(desc(matches.endedAt))
    .limit(limit);
  return loadMatches(
    db,
    ids.map((r) => r.id),
  );
}

/**
 * The running session's scored games, side by side as queue units: each
 * player maps to their pair in this open play (or stays themselves).
 */
export async function liveSessionGames(
  db: Db,
  openPlayId: string,
): Promise<UnitGame[]> {
  return unitGames(db, openPlayId, live(openPlayId));
}

/** Every scored game of an open play, across all its sessions. */
export async function openPlayGames(
  db: Db,
  openPlayId: string,
): Promise<UnitGame[]> {
  return unitGames(db, openPlayId, eq(sessions.openPlayId, openPlayId));
}

async function unitGames(
  db: Db,
  openPlayId: string,
  which: SQL | undefined,
): Promise<UnitGame[]> {
  if (!z.uuid().safeParse(openPlayId).success) return [];
  const rows = await db
    .select({
      id: matches.id,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      side: matchPlayers.side,
      unit: sql<string>`coalesce(${registrations.pairId}, ${matchPlayers.playerId})`,
    })
    .from(matches)
    .innerJoin(sessions, eq(sessions.id, matches.sessionId))
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .leftJoin(
      registrations,
      and(
        eq(registrations.playerId, matchPlayers.playerId),
        eq(registrations.openPlayId, openPlayId),
      ),
    )
    .where(which)
    .orderBy(asc(matches.endedAt));
  const games = new Map<string, UnitGame>();
  for (const r of rows) {
    const g = games.get(r.id) ?? {
      id: r.id,
      sideA: [],
      sideB: [],
      scoreA: r.scoreA,
      scoreB: r.scoreB,
    };
    const side = r.side === "A" ? g.sideA : g.sideB;
    if (!side.includes(r.unit)) side.push(r.unit);
    games.set(r.id, g);
  }
  return [...games.values()];
}

/** Every recorded match of an open play, newest first. */
export async function openPlayMatches(
  db: Db,
  openPlayId: string,
): Promise<RecordedMatch[]> {
  if (!z.uuid().safeParse(openPlayId).success) return [];
  const ids = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(sessions, eq(sessions.id, matches.sessionId))
    .where(eq(sessions.openPlayId, openPlayId));
  return loadMatches(
    db,
    ids.map((r) => r.id),
  );
}

/** Whether a session of this open play was run and ended. */
export async function hasEndedSession(
  db: Db,
  openPlayId: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(openPlayId).success) return false;
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(eq(sessions.openPlayId, openPlayId), eq(sessions.status, "ended")),
    )
    .limit(1);
  return Boolean(row);
}

/** The player with this (verified or desk-entered) email, if any. */
export async function playerByEmail(
  db: Db,
  email: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.email, email));
  return row ?? null;
}

// ── Accounts (sign-in) ─────────────────────────────────────────────────────

export type AdminRow = Account & {
  passwordHash: string;
  /** Set for hosts who signed up themselves. */
  email: string | null;
  /** False only for a self-signed-up host who hasn't verified their email. */
  verified: boolean;
  /** The group hosting this account's open plays; "" until set. */
  groupName: string;
  logoUpdatedAt: Date | null;
};

const adminRow = {
  id: admins.id,
  username: admins.username,
  role: admins.role,
  passwordHash: admins.passwordHash,
  email: admins.email,
  verified: sql<boolean>`(${admins.email} is null or ${admins.emailVerifiedAt} is not null)`,
  groupName: admins.groupName,
  logoUpdatedAt: admins.logoUpdatedAt,
};

export async function getAdmin(db: Db, id: string): Promise<AdminRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select(adminRow).from(admins).where(eq(admins.id, id));
  return row ?? null;
}

export async function adminByUsername(
  db: Db,
  username: string,
): Promise<AdminRow | null> {
  const [row] = await db
    .select(adminRow)
    .from(admins)
    .where(eq(admins.username, username));
  return row ?? null;
}

export async function adminByEmail(
  db: Db,
  email: string,
): Promise<AdminRow | null> {
  const [row] = await db
    .select(adminRow)
    .from(admins)
    .where(eq(admins.email, email));
  return row ?? null;
}

/**
 * A host signing up themselves: an unverified account until they enter
 * the code emailed to them. Signing up again before verifying replaces
 * the unverified account.
 */
export async function createHostSignup(
  db: Db,
  input: {
    email: string;
    username: string;
    passwordHash: string;
    groupName: string;
  },
): Promise<{ id: string } | { error: string }> {
  const existing = await adminByEmail(db, input.email);
  if (existing?.verified) {
    return { error: "That email already has an account. Sign in instead." };
  }
  return db.transaction(async (tx) => {
    if (existing) await tx.delete(admins).where(eq(admins.id, existing.id));
    const [row] = await tx
      .insert(admins)
      .values({ ...input, role: "host" })
      .onConflictDoNothing()
      .returning({ id: admins.id });
    return row ?? { error: `The username ${input.username} is taken` };
  });
}

/** Store a new email code for an account; at most one a minute. */
export async function issueAccountCode(
  db: Db,
  {
    adminId,
    codeHash,
    now = new Date(),
  }: { adminId: string; codeHash: string; now?: Date },
): Promise<string | null> {
  const [last] = await db
    .select({ createdAt: accountCodes.createdAt })
    .from(accountCodes)
    .where(eq(accountCodes.adminId, adminId))
    .orderBy(desc(accountCodes.createdAt))
    .limit(1);
  if (last && now.getTime() - last.createdAt.getTime() < CODE_RESEND_MS) {
    return "A code was just sent. Wait a minute before asking again.";
  }
  await db.transaction(async (tx) => {
    await tx.delete(accountCodes).where(eq(accountCodes.adminId, adminId));
    await tx.insert(accountCodes).values({
      adminId,
      codeHash,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      createdAt: now,
    });
  });
  return null;
}

/**
 * Check an account's email code. On success the email is verified, and
 * any open plays it was invited to host by email are now theirs to help run.
 */
export async function checkAccountCode(
  db: Db,
  {
    adminId,
    codeHash,
    now = new Date(),
  }: { adminId: string; codeHash: string; now?: Date },
): Promise<string | null> {
  const [code] = await db
    .select()
    .from(accountCodes)
    .where(eq(accountCodes.adminId, adminId));
  if (!code || code.expiresAt <= now) {
    return "That code expired. Send a new one.";
  }
  if (code.attempts >= CODE_MAX_ATTEMPTS) {
    return "Too many tries. Send a new code.";
  }
  if (!sameHash(code.codeHash, codeHash)) {
    await db
      .update(accountCodes)
      .set({ attempts: code.attempts + 1 })
      .where(eq(accountCodes.id, code.id));
    const left = CODE_MAX_ATTEMPTS - code.attempts - 1;
    return left > 0
      ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.`
      : "Too many tries. Send a new code.";
  }
  await db.transaction(async (tx) => {
    await tx.delete(accountCodes).where(eq(accountCodes.adminId, adminId));
    const [me] = await tx
      .update(admins)
      .set({ emailVerifiedAt: now })
      .where(eq(admins.id, adminId))
      .returning({ email: admins.email });
    if (!me?.email) return;
    const invites = await tx
      .delete(openPlayInvites)
      .where(eq(openPlayInvites.email, me.email))
      .returning({ openPlayId: openPlayInvites.openPlayId });
    if (invites.length) {
      await tx
        .insert(openPlayHosts)
        .values(invites.map((i) => ({ openPlayId: i.openPlayId, adminId })))
        .onConflictDoNothing();
    }
  });
  return null;
}

/** Accounts of every level (zero means the first sign-in creates one). */
export async function countAdmins(db: Db): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(admins);
  return row.n;
}

/** Every account: admins first, then hosts, each by username. */
const accountListFields = {
  id: admins.id,
  username: admins.username,
  role: admins.role,
  email: admins.email,
  verified: adminRow.verified,
  groupName: admins.groupName,
  createdBy: admins.createdBy,
  /** Its creator can still show the password they set. */
  hasStartPassword: sql<boolean>`${admins.startPassword} is not null`,
  createdAt: admins.createdAt,
};

export async function listAdmins(db: Db) {
  return db
    .select(accountListFields)
    .from(admins)
    .orderBy(asc(admins.role), asc(admins.username));
}

/** Who made an account, and the password they set (sealed), if any. */
export type MadeBy = { createdBy?: string | null; startPassword?: string };

export async function createAdmin(
  db: Db,
  username: string,
  passwordHash: string,
  role: Role = "admin",
  madeBy: MadeBy = {},
): Promise<{ id: string } | { error: string }> {
  const [row] = await db
    .insert(admins)
    .values({ username, passwordHash, role, ...madeBy })
    .onConflictDoNothing()
    .returning({ id: admins.id });
  return row ?? { error: `The username ${username} is taken` };
}

/** Their own new password: the creator's copy of the old one is dropped. */
export async function setAdminPassword(
  db: Db,
  id: string,
  passwordHash: string,
): Promise<void> {
  await db
    .update(admins)
    .set({ passwordHash, startPassword: null })
    .where(eq(admins.id, id));
}

/** The accounts this one made, for its Accounts tab. */
export async function listCreatedAccounts(db: Db, creatorId: string) {
  return db
    .select(accountListFields)
    .from(admins)
    .where(eq(admins.createdBy, creatorId))
    .orderBy(asc(admins.username));
}

/**
 * The sealed password an account's creator set, for that creator only;
 * null otherwise, or once the account changed it.
 */
export async function startPasswordFor(
  db: Db,
  accountId: string,
  creatorId: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(accountId).success) return null;
  const [row] = await db
    .select({ sealed: admins.startPassword })
    .from(admins)
    .where(and(eq(admins.id, accountId), eq(admins.createdBy, creatorId)));
  return row?.sealed ?? null;
}

/** Name the group that hosts this account's open plays. */
export async function setGroupName(
  db: Db,
  adminId: string,
  groupName: string,
): Promise<void> {
  await db.update(admins).set({ groupName }).where(eq(admins.id, adminId));
}

export async function saveGroupLogo(
  db: Db,
  adminId: string,
  mime: string,
  data: Uint8Array,
  now = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(groupLogos)
      .values({ adminId, mime, data })
      .onConflictDoUpdate({ target: groupLogos.adminId, set: { mime, data } });
    await tx
      .update(admins)
      .set({ logoUpdatedAt: now })
      .where(eq(admins.id, adminId));
  });
}

export async function removeGroupLogo(db: Db, adminId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(groupLogos).where(eq(groupLogos.adminId, adminId));
    await tx
      .update(admins)
      .set({ logoUpdatedAt: null })
      .where(eq(admins.id, adminId));
  });
}

/** Change where an open play is played. */
export async function setVenue(
  db: Db,
  openPlayId: string,
  { venue, location }: Venue,
): Promise<void> {
  await db
    .update(openPlays)
    .set({ venue, location })
    .where(eq(openPlays.id, openPlayId));
}

export async function saveBanner(
  db: Db,
  openPlayId: string,
  mime: string,
  data: Uint8Array,
  now = new Date(),
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(openPlayBanners)
      .values({ openPlayId, mime, data })
      .onConflictDoUpdate({
        target: openPlayBanners.openPlayId,
        set: { mime, data },
      });
    await tx
      .update(openPlays)
      .set({ bannerUpdatedAt: now })
      .where(eq(openPlays.id, openPlayId));
  });
}

export async function removeBanner(db: Db, openPlayId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(openPlayBanners)
      .where(eq(openPlayBanners.openPlayId, openPlayId));
    await tx
      .update(openPlays)
      .set({ bannerUpdatedAt: null })
      .where(eq(openPlays.id, openPlayId));
  });
}

export async function getBanner(
  db: Db,
  openPlayId: string,
): Promise<{ mime: string; data: Uint8Array } | null> {
  if (!z.uuid().safeParse(openPlayId).success) return null;
  const [row] = await db
    .select({ mime: openPlayBanners.mime, data: openPlayBanners.data })
    .from(openPlayBanners)
    .where(eq(openPlayBanners.openPlayId, openPlayId));
  return row ?? null;
}

/** A group's public profile: name and logo, never the login or email. */
export type Group = { id: string; name: string; logoUpdatedAt: Date | null };

export async function getGroup(db: Db, adminId: string): Promise<Group | null> {
  if (!z.uuid().safeParse(adminId).success) return null;
  const [row] = await db
    .select({
      id: admins.id,
      name: admins.groupName,
      logoUpdatedAt: admins.logoUpdatedAt,
    })
    .from(admins)
    .where(eq(admins.id, adminId));
  return row ?? null;
}

export async function getGroupLogo(
  db: Db,
  adminId: string,
): Promise<{ mime: string; data: Uint8Array } | null> {
  if (!z.uuid().safeParse(adminId).success) return null;
  const [row] = await db
    .select({ mime: groupLogos.mime, data: groupLogos.data })
    .from(groupLogos)
    .where(eq(groupLogos.adminId, adminId));
  return row ?? null;
}

/** Whether `id` is the only admin-level account left. */
async function lastAdmin(db: Db, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.role, "admin"));
  return rows.length === 1 && rows[0].id === id;
}

/** Change an account's level; never demote the last admin. */
export async function setAdminRole(
  db: Db,
  id: string,
  role: Role,
): Promise<string | null> {
  if (role !== "admin" && (await lastAdmin(db, id))) {
    return "Keep at least one admin";
  }
  await db.update(admins).set({ role }).where(eq(admins.id, id));
  return null;
}

/** Remove an account; never the last admin. Its open plays stay. */
export async function removeAdmin(db: Db, id: string): Promise<string | null> {
  if (await lastAdmin(db, id)) return "Keep at least one admin";
  await db.delete(admins).where(eq(admins.id, id));
  return null;
}

/** A player's sign-in by username. */
export async function playerByUsername(
  db: Db,
  username: string,
): Promise<{
  id: string;
  email: string | null;
  passwordHash: string | null;
} | null> {
  const [row] = await db
    .select({
      id: players.id,
      email: players.email,
      passwordHash: players.passwordHash,
    })
    .from(players)
    .where(eq(players.username, username));
  return row ?? null;
}

/**
 * Set a player's username and (new) password. Returns an error, or null
 * when saved. A null hash keeps the current password.
 */
export async function setPlayerLogin(
  db: Db,
  playerId: string,
  username: string,
  passwordHash: string | null,
): Promise<string | null> {
  const [taken] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.username, username));
  if (taken && taken.id !== playerId) {
    return `The username ${username} is taken`;
  }
  const rows = await db
    .update(players)
    .set(passwordHash ? { username, passwordHash } : { username })
    .where(eq(players.id, playerId))
    .returning({ id: players.id });
  return rows.length ? null : "Player not found";
}

// ── Protests ───────────────────────────────────────────────────────────────

/**
 * An open play both players were confirmed (paid) in, newest first. With
 * the same player twice: any open play they were confirmed in.
 */
export async function sharedOpenPlay(
  db: Db,
  a: string,
  b: string,
): Promise<{ id: string; playDate: string; startTime: string } | null> {
  const paidIn = (playerId: string) =>
    db
      .select({ openPlayId: registrations.openPlayId })
      .from(registrations)
      .innerJoin(pairs, eq(pairs.id, registrations.pairId))
      .where(
        and(eq(registrations.playerId, playerId), eq(pairs.status, "paid")),
      );
  const [mine, theirs] = await Promise.all([paidIn(a), paidIn(b)]);
  const both = new Set(theirs.map((r) => r.openPlayId));
  const ids = mine.map((r) => r.openPlayId).filter((id) => both.has(id));
  if (!ids.length) return null;
  const [row] = await db
    .select({
      id: openPlays.id,
      playDate: openPlays.playDate,
      startTime: openPlays.startTime,
    })
    .from(openPlays)
    .where(inArray(openPlays.id, ids))
    .orderBy(desc(openPlays.playDate), desc(openPlays.startTime))
    .limit(1);
  return row ?? null;
}

/** Why this signed-in player can't protest that one, or null when they can. */
export async function protestProblem(
  db: Db,
  filedBy: string,
  playerId: string,
): Promise<string | null> {
  if (!(await hasPaidRegistration(db, filedBy))) {
    return "Only players with a confirmed open play spot can file a protest";
  }
  if (!(await sharedOpenPlay(db, filedBy, playerId))) {
    return "You can only protest players you've been in an open play with";
  }
  return null;
}

/**
 * File a protest as a signed-in player who shared an open play with them.
 * Returns an error message, or null when filed.
 */
export async function createProtest(
  db: Db,
  input: ProtestInput,
  filedBy: string,
): Promise<string | null> {
  const player = await getPlayer(db, input.playerId);
  if (!player) return "Player not found";
  const notAllowed = await protestProblem(db, filedBy, input.playerId);
  if (notAllowed) return notAllowed;
  if (player.level !== input.currentLevel) {
    return "This player's level just changed; reload and try again";
  }
  const [pending] = await db
    .select({ id: protests.id })
    .from(protests)
    .where(
      and(
        eq(protests.playerId, input.playerId),
        eq(protests.status, "pending"),
      ),
    );
  if (pending) return "There's already a protest waiting for review";
  await db.insert(protests).values({ ...input, filedBy });
  return null;
}

/** The account that decided a protest. */
const decider = alias(admins, "decider");

export async function listProtests(
  db: Db,
  filter: {
    status?: ProtestStatus;
    playerId?: string;
    /** A host's players (of their open plays); all when absent. */
    playerIds?: string[];
  } = {},
) {
  if (filter.playerIds && filter.playerIds.length === 0) return [];
  return db
    .select({
      id: protests.id,
      playerId: protests.playerId,
      playerName: players.name,
      playerLevel: players.level,
      currentLevel: protests.currentLevel,
      requestedLevel: protests.requestedLevel,
      reason: protests.reason,
      status: protests.status,
      adminNote: protests.adminNote,
      createdAt: protests.createdAt,
      resolvedAt: protests.resolvedAt,
      filedById: protests.filedBy,
      filedByName: filer.name,
      filedByEmail: filer.email,
      resolvedByName: decider.username,
    })
    .from(protests)
    .innerJoin(players, eq(players.id, protests.playerId))
    .leftJoin(filer, eq(filer.id, protests.filedBy))
    .leftJoin(decider, eq(decider.id, protests.resolvedBy))
    .where(
      and(
        filter.status ? eq(protests.status, filter.status) : undefined,
        filter.playerId ? eq(protests.playerId, filter.playerId) : undefined,
        filter.playerIds
          ? inArray(protests.playerId, filter.playerIds)
          : undefined,
      ),
    )
    .orderBy(desc(protests.createdAt));
}

/**
 * Approve (moving the player to the requested level) or reject a pending
 * protest. Returns false if it isn't pending.
 */
export async function resolveProtest(
  db: Db,
  protestId: string,
  approve: boolean,
  note: string,
  /** The host or admin deciding. */
  resolvedBy: string | null = null,
): Promise<boolean> {
  const [protest] = await db
    .update(protests)
    .set({
      status: approve ? "approved" : "rejected",
      adminNote: note,
      resolvedBy,
      resolvedAt: new Date(),
    })
    .where(and(eq(protests.id, protestId), eq(protests.status, "pending")))
    .returning();
  if (!protest) return false;
  if (approve) {
    await setLevel(
      db,
      protest.playerId,
      protest.requestedLevel,
      note || "Protest approved",
      protest.id,
    );
  }
  return true;
}

/** Pending protests: all of them, or about these players (a host's). */
export async function pendingProtestCount(
  db: Db,
  playerIds?: string[],
): Promise<number> {
  if (playerIds && playerIds.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(protests)
    .where(
      and(
        eq(protests.status, "pending"),
        playerIds ? inArray(protests.playerId, playerIds) : undefined,
      ),
    );
  return row.n;
}

/** The player a protest is about, or null. */
export async function protestPlayerId(
  db: Db,
  protestId: string,
): Promise<string | null> {
  if (!z.uuid().safeParse(protestId).success) return null;
  const [row] = await db
    .select({ playerId: protests.playerId })
    .from(protests)
    .where(eq(protests.id, protestId));
  return row?.playerId ?? null;
}

/** Admins: remove a protest (a level it changed stays changed). */
export async function removeProtest(
  db: Db,
  protestId: string,
): Promise<boolean> {
  if (!z.uuid().safeParse(protestId).success) return false;
  await db
    .update(levelChanges)
    .set({ protestId: null })
    .where(eq(levelChanges.protestId, protestId));
  const rows = await db
    .delete(protests)
    .where(eq(protests.id, protestId))
    .returning({ id: protests.id });
  return rows.length > 0;
}
