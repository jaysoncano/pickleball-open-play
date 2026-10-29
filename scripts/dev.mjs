// `npm run dev`: start Supabase (database, Studio, Mailpit) if it isn't
// running and apply any new migrations (data is kept), run Next on port
// 1027 (or the next free one, never 3000–3010), then open the app, the
// Mailpit inbox, and Supabase Studio (browse tables) in the browser.
// Always on the local Supabase database, whatever DATABASE_URL .env.local
// holds. `npm run dev -- --no-open` skips the browser; `npm run dev:next`
// is plain `next dev` (uses .env.local as is).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { LOCAL_DB } from "./local-db.mjs";

const FIRST_PORT = 1027;
const AVOID = { from: 3000, to: 3010 };
const READY_TIMEOUT_MS = 90_000;

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const mailpit = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const studio = process.env.SUPABASE_STUDIO_URL ?? "http://127.0.0.1:54323";
const openBrowser = !process.argv.includes("--no-open");

/** Whether nothing is listening on `port` yet. */
function isFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

async function pickPort() {
  for (let port = FIRST_PORT; port < 65536; port++) {
    if (port >= AVOID.from && port <= AVOID.to) continue;
    if (await isFree(port)) return port;
  }
  throw new Error("No free port found");
}

function ensureSupabase() {
  const status = spawnSync("npx", ["supabase", "status"], { stdio: "ignore" });
  if (status.status !== 0) {
    console.log("▶ Starting Supabase (database, Studio, Mailpit)…");
    const start = spawnSync("npx", ["supabase", "start"], {
      stdio: "inherit",
    });
    if (start.status !== 0) {
      console.error("✖ Supabase didn't start. Is Docker running?");
      process.exit(start.status ?? 1);
    }
  }
  // New migrations from a pull; a no-op when up to date. Keeps data.
  const migrate = spawnSync("npx", ["supabase", "migration", "up"], {
    encoding: "utf8",
  });
  if (migrate.status !== 0) {
    console.warn("⚠ Couldn't apply migrations:\n" + migrate.stderr.trim());
  } else if (/Applying migration/.test(migrate.stdout + migrate.stderr)) {
    console.log("▶ Applied new database migrations");
  }
}

/** Resolves once the dev server answers, or gives up quietly. */
async function waitForServer(url) {
  const until = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

function open(url) {
  const [cmd, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}

ensureSupabase();
const port = await pickPort();
const app = `http://localhost:${port}`;
console.log(
  `▶ App:     ${app}  (hosts: ${app}/host/login, admins: ${app}/admin/login)`,
);
console.log(`▶ Mailpit: ${mailpit}`);
console.log(`▶ Studio:  ${studio}  (browse tables and data)`);
console.log(`▶ Database: local (${LOCAL_DB.replace(/:[^:@]*@/, ":***@")})`);

// Real env vars win over .env files in Next, so this beats .env.local.
const next = spawn("npx", ["next", "dev", "--port", String(port)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: LOCAL_DB },
});
next.on("exit", (code) => process.exit(code ?? 0));
// Ctrl+C reaches Next too (same process group); just wait for it to exit.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => next.kill("SIGTERM"));

if (openBrowser && (await waitForServer(app))) {
  open(app);
  open(mailpit);
  open(studio);
}
