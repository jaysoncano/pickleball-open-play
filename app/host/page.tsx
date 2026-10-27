import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import {
  BUTTON,
  PlaySection,
  sinceYesterday,
  ViewToggle,
} from "@/components/open-plays/play-list";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { listOpenPlays } from "@/lib/db/queries";

export const metadata: Metadata = { title: "My open plays" };

/** How many past open plays to list. */
const PAST_LIMIT = 12;

/**
 * Staff: every open play they created or co-host, live, coming up, and
 * past. Admins can switch to all of them. New ones are made on their own
 * page.
 */
export default function HostPage({ searchParams }: PageProps<"/host">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-5 sm:py-8">
      <Suspense fallback={<Loading />}>
        <MyOpenPlays searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyOpenPlays({
  searchParams,
}: Pick<PageProps<"/host">, "searchParams">) {
  await connection();
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  const all = me.role === "admin" && (await searchParams).view === "all";
  const managedBy = all ? undefined : me.id;
  const db = getDb();
  const today = sinceYesterday();
  const [plays, past] = await Promise.all([
    listOpenPlays(db, { from: today, managedBy }),
    listOpenPlays(db, { before: today, managedBy }),
  ]);
  const live = plays.filter((p) => p.live);
  const upcoming = plays.filter((p) => !p.live);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            <span aria-hidden>🏓</span>{" "}
            {all ? "All open plays" : "My open plays"}
          </h1>
          <p className="text-ink/60">
            {all
              ? "Every open play in the club."
              : "The open plays you created or co-host. Open one to check in pairs and run the courts."}
          </p>
        </div>
        {me.role === "admin" && <ViewToggle all={all} path="/host" />}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/open-plays/new"
          className={`${BUTTON} min-h-14 bg-fuchsia-500 px-6 text-lg text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400`}
        >
          <span aria-hidden>＋</span>&nbsp;New open play
        </Link>
        <Link
          href={`/groups/${me.id}`}
          className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
        >
          <span aria-hidden>🌐</span>&nbsp;Your public page
        </Link>
      </div>

      {live.length > 0 && (
        <PlaySection title="Live now" emoji="🔴" plays={live} manage />
      )}
      <PlaySection
        title="Coming up"
        emoji="🗓️"
        plays={upcoming}
        manage
        empty={
          <>
            {all
              ? "No open plays scheduled."
              : "No open plays you host yet. Make one, or ask a host to invite you."}{" "}
            <Link
              href="/open-plays/new"
              className="font-semibold text-fuchsia-600 underline"
            >
              New open play
            </Link>
          </>
        }
      />
      {past.length > 0 && (
        <PlaySection
          title="Past"
          emoji="🕰️"
          plays={past.slice(0, PAST_LIMIT)}
          manage
        />
      )}
    </>
  );
}
