import { defineConfig } from "drizzle-kit";

// Migrations land where `supabase start` / `supabase db reset` apply them.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations",
  migrations: { prefix: "supabase" },
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
