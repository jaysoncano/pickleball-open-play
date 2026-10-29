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
  `/open-plays/[id]` (its hosts: setup/dashboard; others: public board),
  `/open-plays/[id]/manage` (its hosts: edit date/ranks/cap/fee, venue,
  banner, hosts; only the main host invites; image at `/banners/[id]`;
  old `/details` and `/hosts` redirect here),
  `/host/signup` + `/host/verify` (host self sign-up, email code),
  `/groups/[id]` (public group page) + `/groups/[id]/logo`, `/players`, `/players/[id]`,
  `/players/[id]/edit`, `/players/[id]/verify` (returning player → email code), `/claim/[token]` (QR → email code),
  `/confirm/[token]` (receipt link), `/host/login` (hosts only),
  `/admin/login` (admins only, "Admin" nav link; admin-only pages 404 instead of
  redirecting there), `/admin/protests`,
  `/admin/qr-codes`, `/admin/players` (Player desk: pair sign-up, payment),
  `/admin/settings` (accounts and levels, password), `/login` (players).
  Host dashboard
  tabs: Courts, Profiles (check-in QR), History, Standings.
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
  (protests, levels, QR codes page, accounts) check `requireAdmin()`.
  Lists for staff filter with `managedBy` unless an admin picks "All".
- Every other server action that changes data checks `requireAdmin()`, except
  `fileProtest` (signed-in player who shared an open play) and
  `signUpOnline` (public by design; sign-ups stay
  pending until an admin confirms payment), the QR email-code actions (gated by
  the claim token), and profile edits (`profileEditor()`: `staffFor` the
  player, or the verified player once `hasPaidRegistration`).
- Open plays are scheduled events with a level range; several can be
  live at once. Session actions and queries take the `openPlayId`.
- Payments are confirmed by hosts by hand; unpaid pairs are `pending`.
  A pair joins the queue only when `notReady` is null (paid, right rank,
  both checked in).
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
- Destructive buttons use `ConfirmButton` (two taps), never `confirm()`.
  Saves that change or replace data use `ConfirmSubmit` (two taps, checks
  the form first); a dropdown or file pick that saves asks inline first.
  Live dashboard moves (queue order, swaps, court rank, rename) stay one tap.

## Local email

No `RESEND_API_KEY` locally: codes and receipts land in Mailpit at
http://127.0.0.1:54324 (`MAILPIT_URL`), started by `npm run db:start`.

## Sample data

`supabase/seed.sql` loads on `npm run db:reset` (dates relative to
today): accounts `admin` / `pop-admin-123`; hosts `makati.host`,
`bgc.host`, `pending.host` (unverified) / `pop-host-123`; players
`maria`, `juan` / `pop-player-123`. "Riverside Courts" (today) is already
running with two games on court for hosts to score. Fixed ids per table prefix
(`a…` admins, `b…` players, `c…` open plays). Update it with schema changes.

## Commands

`npm run dev` (`scripts/dev.mjs`: starts Supabase if needed, applies new
migrations, Next on port 1027 or the next free one, never 3000–3010,
opens the app, Mailpit, and Supabase Studio;
`-- --no-open` skips the browser) · `npm run dev:next` (plain `next dev`) ·
`npm run db:start` · `npm test` · `npm run coverage` (85%
on `lib/`) · `npm run lint` · `npm run typecheck` · `npm run format:check` ·
`npm run build` · `npm run db:generate` · `npm run db:reset`
