# POP · Pickleball Open Play

Fair court rotation for pickleball open play, with every match saved:
scores, player history, rankings, and skill levels players can protest.

- **Open plays** by rank, with court venue, banner, and the hosting group.
- **Staff levels:** admins run the club; hosts sign up with their email,
  schedule their own open plays, and invite co-hosts.
- **Player desk:** pair or solo sign-up, payments confirmed by hand
  (unpaid pairs are flagged), and emailed receipts.
- **Check-in** before the queue starts; players are shared across open
  plays, so their records follow them.
- **Public pages:** open plays, live court boards, player profiles, and
  group pages anyone can share.

Built with Next.js 16 (App Router, Cache Components), React 19,
Tailwind 4, Zod 4, and Drizzle ORM on Supabase Postgres, deployed on
Vercel.

## Prerequisites

- **Node.js 22+** and npm
- **Docker Desktop**, running (local Supabase runs in containers)
- **Supabase CLI:** `brew install supabase/tap/supabase`
  ([other platforms](https://supabase.com/docs/guides/local-development/cli/getting-started))

## Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/jaysoncano/pickleball-open-play.git
   cd pickleball-open-play
   npm install
   ```

2. **Create your env file**

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local`:

   | Variable                        | What to set                                                        |
   | ------------------------------- | ------------------------------------------------------------------ |
   | `ADMIN_PASSWORD`                | A password for the first admin account                             |
   | `ADMIN_SECRET`                  | A random string: `openssl rand -hex 32`                            |
   | `DATABASE_URL`                  | Leave as is for local Supabase                                     |
   | `OPEN_PLAY_FEE` / `CURRENCY`    | Optional: default entry per pair (e.g. `300`) and currency (`PHP`) |
   | `RESEND_API_KEY` / `EMAIL_FROM` | Leave empty locally: emails go to Mailpit instead                  |

3. **Start everything**

   ```bash
   npm run dev
   ```

   The first run downloads the Supabase images, which takes a few minutes.
   `npm run dev`:
   - starts local Supabase (Postgres, Studio, and the Mailpit email
     inbox) if it isn't running;
   - applies any new migrations in `supabase/migrations` (your data is
     kept; nothing happens when you're up to date);
   - runs the app on **http://localhost:1027** (or the next free port,
     never 3000–3010), printed in the terminal;
   - opens three tabs: the app, Mailpit, and Supabase Studio (browse and
     edit tables and data).

   Use `npm run dev -- --no-open` to skip the browser, or
   `npm run dev:next` for plain `next dev`.

4. **Sign in as the first admin**

   Go to `/admin/login` (the **Staff** link) and sign in with `admin` and
   your `ADMIN_PASSWORD`. While no account exists, that sign-in creates
   the admin. Add more staff and change passwords under **Settings**.

5. **Schedule your first open play**

   Signing in opens **My open plays** (`/host`). Tap **New open play**
   (`/open-plays/new`): venue name and location are required; banner,
   group name, and logo are optional. Saving opens its Manage page.

## Local URLs

| What                         | URL                                                       |
| ---------------------------- | --------------------------------------------------------- |
| App                          | http://localhost:1027                                     |
| Mailpit (codes and receipts) | http://127.0.0.1:54324                                    |
| Supabase Studio (tables)     | http://127.0.0.1:54323 (`npm run db:studio`)              |
| Postgres                     | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

## Commands

| Command                     | Does                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| `npm run dev`               | Supabase + app + browser (see above)                                  |
| `npm test`                  | Unit and DB tests (DB tests run on PGlite in memory)                  |
| `npm run coverage`          | Tests with coverage (85%+ on `lib/`)                                  |
| `npm run lint`              | ESLint                                                                |
| `npm run typecheck`         | TypeScript                                                            |
| `npm run format:check`      | Prettier                                                              |
| `npm run build`             | Production build                                                      |
| `npm run db:generate`       | New migration after editing `lib/db/schema.ts`                        |
| `npx supabase migration up` | Apply new migrations without restarting (`npm run dev` does this too) |
| `npm run db:reset`          | Wipe local data, re-run all migrations, load `supabase/seed.sql`      |
| `npm run db:stop`           | Stop local Supabase                                                   |

## Deploy (Vercel)

Pushes to `main` deploy on Vercel (Hobby plan). Functions run in Mumbai
(`bom1`, `vercel.json`), next to the Supabase database (`ap-south-1`).

- **Database:** a hosted Supabase project. Use its pooler connection
  string (Connect → Transaction pooler, port 6543), then apply the
  migrations through the session port (5432):
  `npx supabase db push --db-url "<url with :5432>"`.
- **Environment variables** (Project → Settings → Environment Variables,
  or `vercel env add <NAME> production`): `DATABASE_URL`, `ADMIN_SECRET`,
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM`,
  `CURRENCY`, `OPEN_PLAY_FEE`.
- The first sign-in at `/admin/login` with `ADMIN_USERNAME` /
  `ADMIN_PASSWORD` creates the first admin on an empty database.

## Troubleshooting

- **"Supabase didn't start. Is Docker running?"** Start Docker Desktop
  and run `npm run dev` again.
- **"Another next dev server is already running"** Only one dev server
  can run per project. Stop the other one (Ctrl+C, or the `kill` command
  Next prints).
- **No verification email** Locally, every email lands in Mailpit at
  http://127.0.0.1:54324.
- **Locked out of staff** Run `npm run db:reset` (this deletes all local
  data and loads the sample data), then sign in as `admin` / `pop-admin-123`.

## Docs

- `docs/prd/pop.md`: product requirements
- `docs/specs/data-model.md`: tables and queries
- `docs/specs/queue-engine.md`: court rotation rules
- `CLAUDE.md`: layout and rules for contributors
