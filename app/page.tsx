import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Loading } from "@/components/loading";
import {
  BUTTON,
  PlaySection,
  sinceYesterday,
} from "@/components/open-plays/play-list";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { listOpenPlays } from "@/lib/db/queries";

/** Public: every open play coming up. Staff run theirs from /host. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      {/* Staff status and open plays are request-time, so they stream. */}
      <Suspense fallback={<Loading />}>
        <OpenPlays />
      </Suspense>
    </main>
  );
}

async function OpenPlays() {
  await connection();
  const [me, plays] = await Promise.all([
    currentAdmin(),
    listOpenPlays(getDb(), { from: sinceYesterday() }),
  ]);
  const live = plays.filter((p) => p.live);
  const upcoming = plays.filter((p) => !p.live);

  return (
    <>
      <AutoRefresh seconds={30} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            <span aria-hidden>🎾</span> Open plays
          </h1>
          <p className="text-ink/60">
            Pick the open play for your level, then sign up as a pair at the
            booth.
          </p>
        </div>
        {me ? (
          <Link
            href="/host"
            className={`${BUTTON} bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400`}
          >
            <span aria-hidden>🏓</span>&nbsp;My open plays
          </Link>
        ) : (
          <Link
            href="/host/signup"
            className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
          >
            <span aria-hidden>🏓</span>&nbsp;Host your own open play
          </Link>
        )}
      </header>

      {live.length > 0 && (
        <PlaySection title="Live now" emoji="🔴" plays={live} />
      )}
      <PlaySection
        title="Coming up"
        emoji="🗓️"
        plays={upcoming}
        empty={
          live.length > 0
            ? "Nothing else coming up."
            : "No open plays scheduled yet. Check back soon!"
        }
      />
    </>
  );
}
