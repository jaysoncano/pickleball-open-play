# POP · Pickleball Open Play

Fair court rotation for pickleball open play, with every match saved:
scores, player history, and skill levels players can protest.

## Run locally

Needs Docker (for Supabase) and the Supabase CLI (`brew install supabase/tap/supabase`).

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD and ADMIN_SECRET
npm run db:start             # local Supabase; applies supabase/migrations
npm run dev                  # Supabase + Next on :1027 (or next free, never 3000–3010), opens app + Mailpit
npm run dev:next             # plain next dev
```

Supabase Studio (browse tables): http://127.0.0.1:54323

## Commands

`npm test` · `npm run coverage` · `npm run lint` · `npm run typecheck` ·
`npm run build` · `npm run db:generate` (after editing `lib/db/schema.ts`) ·
`npm run db:reset` (wipe local data and re-run migrations)

See `docs/prd/pop.md` and `docs/specs/`.
