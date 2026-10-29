# Spec: Data model and server actions

Postgres (Supabase), Drizzle ORM. Schema: `lib/db/schema.ts`. Queries:
`lib/db/queries.ts`, each taking a `Db` so tests run on PGlite with the
same migrations. Migrations: `supabase/migrations/` (drizzle-kit, supabase
prefix). RLS is enabled on every table with no policies: the app connects
as the database owner; the Supabase anon/public API sees nothing.

## Tables

| Table               | Holds                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `players`           | name (unique among non-guests, case-insensitive), `level`, profile fields, `guest` (a Regular open play's name-only player)                                                                                    |
| `player_photos`     | player (pk), `mime`, `data` bytea                                                                                                                                                                              |
| `admins`            | staff: `username`, `password_hash`, `role`, `email` + `email_verified_at` (self sign-up), `group_name`, `logo_updated_at`, `created_by` (the account that made it), `start_password` (sealed, for its creator) |
| `account_codes`     | admin, `code_hash`, `attempts`, `expires_at`: host email verification                                                                                                                                          |
| `open_play_banners` | open play (pk, cascade), `mime`, `data` bytea; `open_plays.banner_updated_at` versions `/banners/[id]`                                                                                                         |
| `group_logos`       | admin (pk), `mime`, `data` bytea                                                                                                                                                                               |
| `open_play_invites` | open play + email (pk), `invited_by`: email invitations to host, claimed on verification                                                                                                                       |
| `open_plays`        | `venue`, `location`, `created_by` (account), date, start/end, `levels`, `max_pairs`, fee, `kind` (`regular` / `ranked`)                                                                                        |
| `open_play_hosts`   | open play + account (pk together): hosts invited to help run it                                                                                                                                                |
| `pairs`             | open play, entry `amount_cents`, `method`, host's `notes` (never emailed)                                                                                                                                      |
| `registrations`     | player, open play (unique together), `pair_id` (null = solo), `checked_in_at`                                                                                                                                  |
| `email_codes`       | player, email, `code_hash`, `attempts`, `expires_at`                                                                                                                                                           |
| `sessions`          | open play, `status` active/ended, window, `state` jsonb                                                                                                                                                        |
| `matches`           | session, court, start/end, `score_a`, `score_b`                                                                                                                                                                |
| `match_players`     | match, player, `side` A/B, `name` and `level` at match time                                                                                                                                                    |
| `protests`          | player, current → requested level, reason, status, admin note, `filed_by` (signed-in player)                                                                                                                   |
| `level_changes`     | player, from → to, note, optional `protest_id`                                                                                                                                                                 |

`level` enum = `LEVELS` in `lib/ranking/levels.ts` (beginner, novice,
intermediate, advanced, pro). Changing it needs a new migration.

## Rules

- One live session per open play (partial unique index on active
  sessions); several open plays can be live at once. Session queries take
  the `openPlayId`.
- `recordMatch` stores the match, its players with current levels, and the
  session state after `finishGame`, in one transaction. Side A is the first
  half of `playerIds`. Scores: whole numbers 0–99, no ties (`ScoreSchema`).
- `ensurePlayers(names)` reuses players by `nameKey`, creates the rest.
- One pending protest per player. `createProtest(db, input, filedBy)`
  requires `protestProblem` to pass: the filer has a paid registration
  and `sharedOpenPlay(filer, player)` exists. `fileProtest` takes the
  filer from the player cookie (`currentPlayer`). A protest is refused if the player's
  level changed since the form loaded. Approving sets the level and logs a
  `level_changes` row linked to the protest; rejecting keeps the note.
- `setLevel` logs every change; setting the same level is a no-op.

## Record (`lib/ranking/record.ts`)

`playerGames(id, matches)` → newest first, each with won/lost, points,
partners, opponents, and `opponentLevel` (strongest opponent's level at the
time). `playerRecord(games)` → games, W–L, win rate %, point diff, court
minutes, and W–L by opponent level. Shown on profiles and next to each
pending protest as evidence.

## Profiles (`lib/profile/`)

`players` profile columns: `first_name`, `last_name` (queries also return
a display `fullName`), `email_confirmed_at`, `email` (unique, lowercased,
private), `phone` (private), `home_club`, `bio`, `hand` (right/left),
`claim_token` (uuid in the QR code, unique), `photo_updated_at` (photo
cache version). `getPlayer` returns public fields only; `getPlayerPrivate`
returns email, phone, and `claim_token`.

- `ProfileSchema` (`forms.ts`) validates basic info; `photoError` checks
  type and size (300 KB). Photos are served by
  `GET /players/[id]/photo?v=<photo_updated_at ms>` (immutable cache).
- Codes (`verify.ts`): 6 digits, stored as HMAC(`ADMIN_SECRET`, player,
  email, code). `issueEmailCode` refuses another email than the linked
  one, an email owned by another player, or a resend within 60 s, and
  keeps only the newest code. `checkEmailCode` expires after 10 min, locks
  after 5 wrong tries, and links the email on first success.
- Player cookie `pop_player`: base64url `{playerId, email, exp}` + HMAC,
  30 days. Saving as a player keeps the verified email and fails if an
  admin changed it since.
- Email (`lib/email.ts`): Resend HTTP API with `RESEND_API_KEY` and
  `EMAIL_FROM`. Without a key, emails go to the local Mailpit inbox
  (`MAILPIT_URL`, from `supabase start`: open it to read codes and
  receipts). With neither, or if Mailpit is down, the email is logged.
- Ranking (`lib/ranking/rank.ts`): `rankPlayers(listPlayers())`.
- Setup status (`status.ts`): `profileStatus` → new / verified / complete
  from `listClaimTokens(db, ids?)` (`emailVerified`, `fullName`,
  `hasPhoto`); `missingSteps` follows `PROFILE_STEPS`.
- Claim target: `token` (QR) or `playerId` when an email is linked.

## Registration (`lib/registration/`)

- `PairRegistrationSchema`: two people (`a_*`, `b_*` form fields via
  `nestForm`; each a `playerId` or new `name`, plus first/last name and
  email) and one entry paid in full. `SoloRegistrationSchema`: one person.
  `PairUpSchema`: two solo player ids and the entry.
- `registerPair` / `registerSolo` / `pairSolos` save names and emails (a
  changed email starts unconfirmed) in one transaction. Refused: taken
  names or emails, unknown players, a player already signed up that date.
- Open plays (`lib/registration/open-play.ts`): `OpenPlaySchema` (levels
  from `form.getAll("levels")`), `ranksLabel`, `rankProblem` (the strongest
  player's level must be ticked; names them when it's above the ranks),
  `joinProblem` (rank + cap), `soloProblem` (above every rank), `overlaps` (same-day
  time clash), `whenLabel`. Queries: `createOpenPlay`, `listOpenPlays`
  (`pairCount`, `live`), `getOpenPlay`, `removeOpenPlay` (only unused).
- `paidPairs(openPlayId)` → queue units `{ id: pair id, name: "A & B",
skill, blocked }`, skill = `levelRank(pairLevel(...))`; `blocked` is
  `rankProblem` with current levels, so a promotion after paying keeps the
  pair out. `startOpenPlay` and `addLateArrivals` accept only that open
  play's unblocked pairs.
- Online: `signUpSolo` (no pair yet; refused above the chosen rank;
  roster lists them under `requested_level`), `signUpPair` (pending; names match a player only with the
  email on file; the chosen rank must equal the pair's level),
  `confirmPairPayment` (rank + cap re-checked, then paid), `removePair`
  (pending, or paid while not live). `pairCount`, `paidPairs` and the cap
  count paid pairs only. `hasPaidRegistration` gates profile editing.
- `recordMatch` expands each pair unit to its two players on that side
  (`pairMembers`), so `match_players` stays per player.
- Receipts (`receiptEmail`) carry a signed link (`emailLinkToken`, 7 days,
  purpose-bound so it can't be used as the player cookie). `confirmEmail`
  sets `email_confirmed_at` only if the email is unchanged.

## Access (`lib/auth.ts`, `app/actions.ts`)

Staff: `admins` table (username, scrypt `password_hash`, `role` =
`ROLES` in `lib/roles.ts`: `admin` | `host`). The first account is an
admin, created at login while the table is empty, from `ADMIN_USERNAME`
(default `admin`) and `ADMIN_PASSWORD`. The admin cookie is a signed token
`{adminId, v, exp}` (`lib/auth.ts`), where `v` = `passwordVersion` of the
current hash, so a password change signs out older sessions; rotating
`ADMIN_SECRET` signs everyone out. Players: `players.username` (unique,
lowercase) and `password_hash`; `playerSignIn` sets the player cookie.
Unknown usernames are checked against a decoy hash so timing doesn't
reveal which exist. No rate limiting yet.
Who runs an open play: its `created_by` account plus `open_play_hosts`
rows (`openPlayManagers`); admins run all (`canManage` in
`lib/roles.ts`). `created_by` is set null when that account is removed;
hosts rows cascade. `lib/auth-server.ts`: `requireAdmin()` (role admin:
protests, levels, QR codes page, accounts), `requireStaff()` (any
account: `createOpenPlay`, `openPlaysOn`, scoped to `managedBy` for
hosts), `requireOpenPlay(id)` (session actions, desk registration,
`registrationsFor`, `paidPairsFor`, `editOpenPlay`, venue and banner;
`confirmPayment`/`removePairEntry` look up the pair's open play first),
`requireMainHost(id)` (creator or admin, `canInvite`: `inviteHost`,
`removeInvite`, `removeHost`).
`staffFor(account, playerId)`: admins, or a host the player registered
with (`playerInManagedOpenPlay`); it gates `playerQrCode` and the staff
side of `profileEditor()`. `setAdminRole`/`removeAdmin` keep at least
one admin. Public: viewing the live board,
players, profiles. Players sign in at `/login` (email → code → cookie;
`byEmail` claim target, `safeNext` redirect). `fileProtest` needs that
session. Public pages show emails only masked to the first letter
(`maskEmail` → "j•••••"). QR claim:
`sendEmailCode` / `confirmEmailCode` (by claim token). Profile edits
(`saveProfile`, `uploadPhoto`, `deletePhoto`) need `profileEditor()`: an
staff for that player or the verified player. `newQrCode` is admin
only; `profileSetup(ids)` (no QR secret in the result) is staff, limited
to the players of open plays a host runs.

## Hosts, check-in, shared players

- Self-signed-up hosts have `email` set; `verified` = `email is null or
email_verified_at is not null`. `login` sends unverified accounts a code
  and redirects to `/host/verify`. `checkAccountCode` sets
  `email_verified_at` and turns that email's `open_play_invites` into
  `open_play_hosts` rows in one transaction. Codes use the player-code
  TTL, resend, and attempt limits (`lib/profile/verify.ts`).
- `inviteHost(db, id, usernameOrEmail)` → `{added}` | `{invited}` |
  `{error}`. Email matches only verified accounts.
- `OpenPlay.groupName` / `groupLogoUpdatedAt` come from the creator's
  account (subqueries). The group is optional: `createOpenPlay` and
  `saveGroup` share `applyGroup` (name when given, logo or `removeLogo`).
- `setVenue(db, id, {venue, location})` edits an existing open play.
- `updateOpenPlay(db, id, OpenPlayEdit)` → error or null: date, times,
  levels, `max_pairs`, `fee_cents`. Refuses date/time/level changes while
  a session is active, dropping a level that paid or pending pairs or
  solos use, a cap below the paid pairs, and a new window that overlaps
  another open play one of its players joined.
- `saveBanner` / `removeBanner` / `getBanner`; `OpenPlay.bannerUpdatedAt`.
  Upload rules and the placeholder theme live in `lib/banner.ts`.
- `getGroup(db, id)` → `{id, name, logoUpdatedAt}` (public fields only)
  and `listOpenPlays(db, {hostedBy})` (open plays it created) back the
  public `/groups/[id]` page.
- `rosterPairs`: paid and pending pairs as units with `paid` and
  `members[].checkedIn`; `paidPairs` filters it. `notReady` in
  `lib/registration/gate.ts` (unpaid → wrong rank → not checked in) gates
  `startOpenPlay` and `addLateArrivals`.
- `linkByEmail`: a person typed without `playerId` whose email is on a
  player becomes that player (their names kept), in `registerPair`,
  `registerSolo`, and online sign-up. `registerPair` also takes an
  `UnpaidPair` (no entry → `status: pending`).
- Hosts' desk players: `managedPlayerIds`. `editorEmail` keeps a
  confirmed email when a host edits a profile.
