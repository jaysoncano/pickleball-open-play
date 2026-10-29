// `npm run db:admin`: set the local admin's password to ADMIN_PASSWORD from
// .env.local (account ADMIN_USERNAME, default "admin"). Use after
// `npm run db:reset`, which brings back the seed password. Local database
// only. Same hash format as hashPassword in lib/auth.ts.
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import postgres from "postgres";
import { LOCAL_DB } from "./local-db.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const username = process.env.ADMIN_USERNAME || "admin";
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("✖ Set ADMIN_PASSWORD in .env.local");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
const stored = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;

const sql = postgres(LOCAL_DB, { max: 1, onnotice: () => {} });
try {
  const rows = await sql`
    update admins set password_hash = ${stored}
    where username = ${username} returning role`;
  if (rows.length === 0) {
    console.error(`✖ No account named ${username} in the local database`);
    process.exitCode = 1;
  } else {
    console.log(
      `▶ ${username} (${rows[0].role}) now signs in with ADMIN_PASSWORD`,
    );
  }
} catch (error) {
  console.error(
    `✖ Couldn't reach the local database. Run npm run db:start.\n${error.message}`,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
