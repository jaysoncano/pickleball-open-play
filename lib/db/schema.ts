import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { ROLES } from "@/lib/roles";
import { HANDS } from "@/lib/profile/forms";
import type { QueueState } from "@/lib/queue/schema";
import { PROTEST_STATUSES } from "@/lib/ranking/forms";
import { LEVELS } from "@/lib/ranking/levels";
import { PAYMENT_METHODS } from "@/lib/registration/forms";
import { OPEN_PLAY_KINDS } from "@/lib/registration/open-play";

// RLS is on with no policies: the app connects as the database owner, and
// Supabase's public API (anon key) can't read or write these tables.

export const levelEnum = pgEnum("level", LEVELS);
export const sideEnum = pgEnum("side", ["A", "B"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "ended"]);
export const protestStatusEnum = pgEnum("protest_status", PROTEST_STATUSES);
export const handEnum = pgEnum("hand", HANDS);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const pairStatusEnum = pgEnum("pair_status", ["pending", "paid"]);
export const accountRoleEnum = pgEnum("account_role", ROLES);
export const openPlayKindEnum = pgEnum("open_play_kind", OPEN_PLAY_KINDS);

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    level: levelEnum("level").notNull().default("beginner"),
    // Basic info the player (or the desk) fills in.
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    /** Private. Set by the player's first code check, or by an admin. */
    email: text("email"),
    /** When the player proved they own `email` with a code. */
    emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
    /** Private. */
    phone: text("phone").notNull().default(""),
    homeClub: text("home_club").notNull().default(""),
    bio: text("bio").notNull().default(""),
    hand: handEnum("hand"),
    /** Secret in the player's QR code; regenerating it voids old codes. */
    claimToken: uuid("claim_token").notNull().defaultRandom(),
    photoUpdatedAt: timestamp("photo_updated_at", { withTimezone: true }),
    /** Sign-in: set by the player once their payment is confirmed. */
    username: text("username"),
    passwordHash: text("password_hash"),
    /**
     * A name typed for one Regular open play ("gel/son"): no email, no
     * profile, left out of the directory and rankings. Names only need to
     * be unique among real players.
     */
    guest: boolean("guest").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("players_name_key")
      .on(sql`lower(${t.name})`)
      .where(sql`not ${t.guest}`),
    uniqueIndex("players_username_key").on(t.username),
    uniqueIndex("players_email_key").on(t.email),
    uniqueIndex("players_claim_token_key").on(t.claimToken),
  ],
).enableRLS();

/** Profile photo, apart from `players` so lists don't load the bytes. */
export const playerPhotos = pgTable("player_photos", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
}).enableRLS();

/**
 * Staff accounts. Admins control everything; hosts run only the open
 * plays they scheduled or were invited to.
 */
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lowercase; unique. */
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: accountRoleEnum("role").notNull().default("host"),
  /**
   * Set when a host signs up themselves (lowercase; unique). They can't
   * sign in until `email_verified_at`. Null for accounts an admin added.
   */
  email: text("email").unique(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** The group that hosts this account's open plays; shown on them. */
  groupName: text("group_name").notNull().default(""),
  logoUpdatedAt: timestamp("logo_updated_at", { withTimezone: true }),
  /** The account that made this one (Settings, or a co-host account). */
  createdBy: uuid("created_by").references((): AnyPgColumn => admins.id, {
    onDelete: "set null",
  }),
  /**
   * The password its creator set, encrypted with ADMIN_SECRET, so only
   * they can show it to hand over. Cleared once the account changes it.
   */
  startPassword: text("start_password"),
  createdAt: createdAt(),
}).enableRLS();

/** A host group's logo, apart from `admins` so lists don't load the bytes. */
export const groupLogos = pgTable("group_logos", {
  adminId: uuid("admin_id")
    .primaryKey()
    .references(() => admins.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
}).enableRLS();

/** Emailed codes that verify a self-signed-up host's email, hashed. */
export const accountCodes = pgTable("account_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => admins.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}).enableRLS();

/**
 * A scheduled open play: a date and time window for a level range, with
 * an optional cap on pairs. Several can run at the same time.
 */
export const openPlays = pgTable("open_plays", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Where it's played; past ones fill the venue autocomplete. */
  venue: text("venue").notNull().default(""),
  location: text("location").notNull().default(""),
  /** The account that scheduled it: it manages it, with any invited hosts. */
  createdBy: uuid("created_by").references(() => admins.id, {
    onDelete: "set null",
  }),
  playDate: date("play_date").notNull(),
  /** Venue-local "HH:MM". */
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  /**
   * The ranks this open play runs, each with its own line in the queue.
   * A pair joins the rank of its level (its stronger player).
   */
  levels: levelEnum("levels").array().notNull(),
  /** Null: no cap. */
  maxPairs: integer("max_pairs"),
  /** Entry for one pair, in minor units. */
  feeCents: integer("fee_cents").notNull().default(0),
  /**
   * Regular: the host types pairs by name ("gel/son"), stats stay in this
   * open play. Ranked: players sign up with email, and games count toward
   * their shared record.
   */
  kind: openPlayKindEnum("kind").notNull().default("ranked"),
  /** Set when a banner is uploaded (it versions the image URL). */
  bannerUpdatedAt: timestamp("banner_updated_at", { withTimezone: true }),
  createdAt: createdAt(),
}).enableRLS();

/** An open play's banner image (one per open play). */
export const openPlayBanners = pgTable("open_play_banners", {
  openPlayId: uuid("open_play_id")
    .primaryKey()
    .references(() => openPlays.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
}).enableRLS();

/** Accounts invited to help run an open play (besides its creator). */
export const openPlayHosts = pgTable(
  "open_play_hosts",
  {
    openPlayId: uuid("open_play_id")
      .notNull()
      .references(() => openPlays.id, { onDelete: "cascade" }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.openPlayId, t.adminId] })],
).enableRLS();

/**
 * An invitation, by email, to host an open play for someone without an
 * account yet. It turns into an `open_play_hosts` row when that email is
 * verified on a new host account.
 */
export const openPlayInvites = pgTable(
  "open_play_invites",
  {
    openPlayId: uuid("open_play_id")
      .notNull()
      .references(() => openPlays.id, { onDelete: "cascade" }),
    /** Lowercase. */
    email: text("email").notNull(),
    invitedBy: uuid("invited_by").references(() => admins.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.openPlayId, t.email] })],
).enableRLS();

/**
 * A pair joining an open play: one entry, paid in full. Pairs who sign up
 * online wait as `pending` until an admin confirms their payment at the
 * booth; the desk records paid pairs directly.
 */
export const pairs = pgTable("pairs", {
  id: uuid("id").primaryKey().defaultRandom(),
  openPlayId: uuid("open_play_id")
    .notNull()
    .references(() => openPlays.id),
  status: pairStatusEnum("status").notNull().default("paid"),
  /** The rank they asked for when signing up online. */
  requestedLevel: levelEnum("requested_level"),
  /** Payment: set when paid. */
  amountCents: integer("amount_cents"),
  method: paymentMethodEnum("method"),
  /** The host's own notes on the pair ("paid half", "late"); never emailed. */
  notes: text("notes").notNull().default(""),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: createdAt(),
}).enableRLS();

/**
 * A player signed up for an open play: with a pair (paid), or alone and
 * looking for a partner (`pair_id` null) until the desk pairs them.
 */
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    openPlayId: uuid("open_play_id")
      .notNull()
      .references(() => openPlays.id),
    pairId: uuid("pair_id").references(() => pairs.id),
    /** The rank a solo player signed up for online (null: their own). */
    requestedLevel: levelEnum("requested_level"),
    /** When the host checked them in at the venue; null until they arrive. */
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("registrations_player_open_play_key").on(
      t.playerId,
      t.openPlayId,
    ),
  ],
).enableRLS();

/** Emailed verification codes, stored hashed. */
export const emailCodes = pgTable("email_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}).enableRLS();

/** One open-play session. `state` is the live queue while active. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: sessionStatusEnum("status").notNull().default("active"),
    /** The open play this session runs; only its pairs can join. */
    openPlayId: uuid("open_play_id").references(() => openPlays.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    state: jsonb("state").$type<QueueState>().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Several open plays can run at once, but each has one live session.
  (t) => [
    uniqueIndex("sessions_live_open_play_key")
      .on(t.openPlayId)
      .where(sql`${t.status} = 'active'`),
  ],
).enableRLS();

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  courtLabel: text("court_label").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  scoreA: integer("score_a").notNull(),
  scoreB: integer("score_b").notNull(),
  createdAt: createdAt(),
}).enableRLS();

/** Who played in a match, with their name and level at the time. */
export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    side: sideEnum("side").notNull(),
    name: text("name").notNull(),
    level: levelEnum("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
).enableRLS();

export const protests = pgTable("protests", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id),
  currentLevel: levelEnum("current_level").notNull(),
  requestedLevel: levelEnum("requested_level").notNull(),
  reason: text("reason").notNull(),
  /**
   * The signed-in player who filed it: someone who played in an open play
   * with them. Null only for protests from before sign-in was required.
   */
  filedBy: uuid("filed_by").references(() => players.id),
  status: protestStatusEnum("status").notNull().default("pending"),
  adminNote: text("admin_note").notNull().default(""),
  /** The host or admin who decided it; null while pending. */
  resolvedBy: uuid("resolved_by").references(() => admins.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}).enableRLS();

/** Every level change, by an admin directly or by approving a protest. */
export const levelChanges = pgTable("level_changes", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id),
  fromLevel: levelEnum("from_level").notNull(),
  toLevel: levelEnum("to_level").notNull(),
  note: text("note").notNull().default(""),
  protestId: uuid("protest_id").references(() => protests.id),
  createdAt: createdAt(),
}).enableRLS();
