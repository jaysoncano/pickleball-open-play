@AGENTS.md

# POP · Pickleball Open Play

Open-play court queue for pickleball with a database: recorded matches,
player history, and skill levels players can protest. Built from Paddle
Stack Queuing. Next.js 16 App Router (Cache Components), React 19,
Tailwind 4, Zod 4, Drizzle ORM on Supabase Postgres (local via
`supabase start`). No `src/` folder.

## Layout

- `lib/queue/` — queue logic as pure functions (unchanged engine; players
  can carry DB ids via `PlayerEntry`). No React, no DB.
- `lib/ranking/` — levels, score/protest Zod schemas, record math, ranking,
  `standings.ts` (open play point system and predicted top N).
- `lib/registration/` — pair/solo sign-up schemas, entry fee, pair level.
- `lib/profile/` — basic-info/photo schemas, email codes, player cookie.
  `lib/email.ts` (send: Resend or Mailpit), `lib/email-templates.ts`
  (branded HTML emails: tables + inline styles only), `lib/qr.ts`.
- `lib/db/` — `schema.ts` (Drizzle), `queries.ts` (all SQL, take a `Db`),
  `client.ts` (server-only lazy connection).
- `lib/banner.ts` — banner upload rules, URL, placeholder theme, initials.
- `lib/roles.ts` — account levels (`admin`/`host`), `canManage`, venue
  schema. Client-safe.
- `lib/auth.ts` (scrypt passwords, signed admin session, username rules)
  / `lib/auth-server.ts` (`currentAdmin`, `requireAdmin`/`requireStaff`/
  `requireOpenPlay`, `staffFor`, `currentPlayer`, cookies).
- `app/actions.ts` — every server action; each checks access (see Rules).
- `components/session-provider.tsx` — live session state; `update()`
  applies an engine change, then saves in order in the background.
- Pages: `/` (public: open plays coming up), `/host` (staff: My open
  plays, live / coming up / past; admins Mine or All), `/open-plays/new`
  (schedule one; saving opens its Manage page),
  `/open-plays/[id]` (its hosts: setup/dashboard; others: info page;
  `?view=courts` is the shareable public board for everyone, hosts too:
  tabs Courts (dashboard look, watch only: `PublicCourts` with
  `CourtView`, `UpNextCard readOnly`, `QueueView`, ranks playing),
  Rankings, Games played, History (`?tab=`), nothing private;
  hosts share it with `ShareLink` on the dashboard, Manage, and results),
  `/open-plays/[id]/manage` (its hosts: edit date/ranks/cap/fee, venue,
  banner, hosts table; only the main host invites or creates a co-host
  account (`createCoHostAccount`); image at `/banners/[id]`;
  old `/details` and `/hosts` redirect here),
  `/host/signup` + `/host/verify` (host self sign-up, email code),
  `/groups/[id]` (public group page) + `/groups/[id]/logo`, `/players`, `/players/[id]`,
  `/players/[id]/edit`, `/players/[id]/verify` (returning player → email code), `/claim/[token]` (QR → email code),
  `/confirm/[token]` (receipt link), `/host/login` (hosts only),
  `/admin/login` (admins only, "Admin" nav link; admin-only pages 404 instead of
  redirecting there), `/admin/protests`,
  `/admin/qr-codes`, `/admin/players` (Player desk: pick an open play, then one screen:
  register tabs left, filterable pairs table right; `lib/registration/desk.ts`),
  `/admin/settings` (tabs: Group, Account, Accounts (admins: all; hosts:
  ones they made, `admins.created_by`), admins also Add account; `?tab=`;
  creators can show the password they set: `start_password`, sealed with
  ADMIN_SECRET, cleared when the account changes it), `/login` (players).
  Host dashboard
  tabs: Courts, Players (every signed-up pair: search, filters, where
  they are, games, check in even after the start; `lib/registration/
roster.ts`), Rankings (rankings so far), Profiles (profile-setup QR;
  Ranked only: Regular guests have no profile or QR),
  History (scoreboard panels, 🏆 Winner sticker / Lost stamp; `Match.score`), Standings, Payments
  (total/paid/unpaid widgets + two tables; the only place money totals
  show).
- Docs: `docs/prd/pop.md`, `docs/specs/data-model.md`,
  `docs/specs/queue-engine.md`.

## Rules

- Queue behavior goes in `lib/queue/`, ranking logic in `lib/ranking/`,
  SQL in `lib/db/queries.ts`, all with tests first. DB tests run on PGlite
  with the real migrations (`lib/db/queries.test.ts`).
- Schema change: edit `lib/db/schema.ts`, run `npm run db:generate`, then
  `npm run db:reset` locally. Keep `.enableRLS()` on every table.
- Staff accounts are admins or hosts. Open-play-scoped actions check
  `requireOpenPlay(id)` (admin, creator, or invited host); choosing hosts
  (invite, remove) checks `requireMainHost(id)` (creator or admin, `canInvite`);
  club-wide ones
  (levels, QR codes page, adding admins) check `requireAdmin()`.
  Protests: hosts decide those about their players (`staffFor`), admins
  any, plus set rank and remove (`requireAdmin`).
  Lists for staff filter with `managedBy` unless an admin picks "All".
- Every other server action that changes data checks `requireAdmin()`, except
  `fileProtest` (signed-in player who shared an open play) and
  `signUpOnline` (public by design; sign-ups stay
  pending until an admin confirms payment), the QR email-code actions (gated by
  the claim token), and profile edits (`profileEditor()`: an admin, or the
  verified player once `hasPaidRegistration`). Hosts change only a
  player's registration names (queue name, first, last) with
  `saveRegistrationName` (`staffFor` the player).
- Open plays are scheduled events with a level range; several can be
  live at once. Session actions and queries take the `openPlayId`.
- Each open play is `regular` or `ranked` (`open_plays.kind`, picked at
  creation, never changed). Regular: the host types pairs by name
  ("gel/son", `GuestPairSchema` → `registerGuestPair`) as **guest**
  players (`players.guest`: no email, one open play, kept out of the
  directory, profiles, rankings, and app-wide name uniqueness via
  `realNamed`; names are unique within one open play via `nameTakenIn`).
  Ranked: the email flow (`registrationProblem` refuses Regular).
- Once live, checked-in pairs join the queue on their own, at the front
  (`addLatePairs`). After **End session** the open play shows its
  results (`ResultsView`: top pairs, `finalStandings`, every game) and
  can't be set up again (`hasEndedSession`); its hosts can undo an
  accidental end with **↩ Reopen session** (`reopenSession`).
- Payments are confirmed by hosts by hand; unpaid pairs are `pending`.
  A pair joins the queue only when `notReady` is null: right rank and
  both checked in (before and after the start). Checking in is the
  host's go-ahead; payment can come later. The dashboard warns while an
  unpaid pair plays (`unpaidOnCourtAlerts`, reminds every 10 min) and
  before a game starts without time to finish (`startWarning`, popup);
  the stats row estimates games left (`gamesLeft`).
- Players are one record per email across open plays: registration
  links by email (`linkByEmail`), never duplicates.
- Open play is by paid pairs: queue units are pair ids. Code that needs
  people must expand units with `pairMembers`.
- Email and phone are private: never render them on public pages (masked
  hints show the first letter only: `maskEmail`). QR
  codes (claim tokens) are admin-only: never on public pages or the board.
- DB/cookie reads in pages go inside `<Suspense>` (Cache Components).
- Deploys on Vercel (Hobby), functions in `bom1` next to Supabase
  (`vercel.json`). See README "Deploy".
- Engine functions take `now` and `rng` as arguments.
- Every edit, update, and delete confirms in a popup (`ConfirmDialog`),
  never `confirm()`: destructive buttons use `ConfirmButton` (asks
  "{label}?"), saves use `ConfirmSubmit` (checks the form, then asks
  `confirmLabel`). Creating or recording something new (a sign-up, a
  pairing, a game's score) saves in one tap with a plain `Button`. A
  dropdown or file pick that saves asks inline first. Live dashboard moves
  (queue order, swaps, court rank, rename) stay one tap. Every popup is
  `Modal`: the whole card animates in and out (`dialog.modal` in
  `app/globals.css`).

## Local email

No `RESEND_API_KEY` locally: codes and receipts land in Mailpit at
http://127.0.0.1:54324 (`MAILPIT_URL`), started by `npm run db:start`.

## Sample data

`supabase/seed.sql` loads on `npm run db:reset` (dates relative to
today): accounts `admin` / `pop-admin-123` (`npm run db:admin` switches
it to `ADMIN_PASSWORD` from `.env.local`); hosts `makati.host`,
`bgc.host`, `pending.host` (unverified) / `pop-host-123`; players
`maria`, `juan` / `pop-player-123`. "Riverside Courts" (today) is already
running with two games on court for hosts to score. Fixed ids per table prefix
(`a…` admins, `b…` players, `c…` open plays). Update it with schema changes.

## Commands

`npm run dev` (`scripts/dev.mjs`: starts Supabase if needed, applies new
migrations, Next on port 1027 or the next free one, never 3000–3010,
always on the local database even if `.env.local` names the hosted one,
opens the app, Mailpit, and Supabase Studio;
`-- --no-open` skips the browser) · `npm run dev:next` (plain `next dev`) ·
`npm run db:start` · `npm test` · `npm run coverage` (85%
on `lib/`) · `npm run lint` · `npm run typecheck` · `npm run format:check` ·
`npm run build` · `npm run db:generate` · `npm run db:reset` ·
`npm run db:admin`
