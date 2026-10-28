import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cache } from "react";
import type { Db } from "./queries";
import * as schema from "./schema";

/**
 * One connection per request, made lazily so `next build` works without
 * DATABASE_URL. Cloudflare Workers can't reuse a socket across requests,
 * so there is no module-level client.
 */
export const getDb = cache((): Db => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  // Supabase's pooler doesn't support prepared statements.
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  return drizzle(sql, { schema });
});
