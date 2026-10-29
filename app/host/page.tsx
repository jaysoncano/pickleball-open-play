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
  if (!me) redirect("/host/login");
  const query = await searchParams;
  const all = me.role === "admin" && query.view === "all";
  const tab = query.tab === "ended" ? "ended" : "open";
  const managedBy = all ? undefined : me.id;
  const db = getDb();
  const today = sinceYesterday();
  const [plays, past] = await Promise.all([
    listOpenPlays(db, { from: today, managedBy }),
    listOpenPlays(db, { before: today, managedBy }),
  ]);
  const live = plays.filter((p) => p.live);
  // Ended open plays move to their own tab, newest first.
  const upcoming = plays.filter((p) => !p.live && !p.ended);
  const notRun = past.filter((p) => !p.ended);
  const ended = [
    ...plays.filter((p) => p.ended).reverse(),
    ...past.filter((p) => p.ended),
  ];
  const tabHref = (t: "open" | "ended") => {
    const params = new URLSearchParams();
    if (all) params.set("view", "all");
    if (t === "ended") params.set("tab", "ended");
    const qs = params.toString();
    return qs ? `/host?${qs}` : "/host";
  };

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

      <nav
        aria-label="Open plays"
        className="grid w-full grid-cols-2 gap-1.5 rounded-2xl bg-white/80 p-1.5 ring-2 ring-white sm:max-w-md"
      >
        {(
          [
            ["open", "🎾", "Active", live.length + upcoming.length],
            ["ended", "🏁", "Ended", ended.length],
          ] as const
        ).map(([t, emoji, label, count]) => (
          <Link
            key={t}
            href={tabHref(t)}
            aria-current={tab === t ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-display text-base font-semibold whitespace-nowrap transition-colors ${tab === t ? "bg-fuchsia-500 text-white shadow-[0_3px_0_0_#a21caf]" : "text-ink/60 hover:bg-fuchsia-50 hover:text-fuchsia-600"}`}
          >
            <span aria-hidden>{emoji}</span>
            {label}
            <span
              className={`min-w-6 rounded-full px-1.5 text-center text-sm tabular-nums ${tab === t ? "bg-white/25" : "bg-ink/5"}`}
            >
              {count}
            </span>
          </Link>
        ))}
      </nav>

      {tab === "ended" ? (
        <PlaySection
          title="Ended"
          emoji="🏁"
          plays={ended}
          manage
          empty="No open plays have ended yet. End a session to see its results here."
        />
      ) : (
        <>
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
          {notRun.length > 0 && (
            <PlaySection
              title="Past"
              emoji="🕰️"
              plays={notRun.slice(0, PAST_LIMIT)}
              manage
            />
          )}
        </>
      )}
    </>
  );
}
