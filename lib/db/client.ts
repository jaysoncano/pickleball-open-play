import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Db } from "./queries";
import * as schema from "./schema";

let db: Db | null = null;

/** Lazily connect, so `next build` works without DATABASE_URL. */
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    // Supabase's pooler doesn't support prepared statements.
    db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return db;
}
