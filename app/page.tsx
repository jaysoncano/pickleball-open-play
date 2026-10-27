import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Loading } from "@/components/loading";
import { CreateOpenPlay } from "@/components/open-plays/create-open-play";
import { OpenPlayCard } from "@/components/open-plays/open-play-card";
import { RemoveOpenPlay } from "@/components/open-plays/remove-open-play";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getAdmin,
  listOpenPlays,
  venueSuggestions,
  type OpenPlay,
} from "@/lib/db/queries";
import { dateInput } from "@/lib/queue/time";
import { openPlayFee } from "@/lib/registration/forms";
import { logoUrl } from "@/lib/roles";

const BUTTON =
  "inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      {/* Staff status and open plays are request-time, so they stream. */}
      <Suspense fallback={<Loading />}>
        <OpenPlays searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OpenPlays({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  await connection();
  const me = await currentAdmin();
  const admin = me !== null;
  // Staff see the open plays they run; an admin can switch to all of them.
  const all = me?.role === "admin" && (await searchParams).view === "all";
  const managedBy = me && !all ? me.id : undefined;
  const db = getDb();
  const [plays, venues, account] = await Promise.all([
    listOpenPlays(db, { from: sinceYesterday(), managedBy }),
    me
      ? venueSuggestions(db, {
          managedBy: me.role === "admin" ? undefined : me.id,
        })
      : [],
    me ? getAdmin(db, me.id) : null,
  ]);
  const live = plays.filter((p) => p.live);
  const upcoming = plays.filter((p) => !p.live);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            <span aria-hidden>🎾</span> Open plays
          </h1>
          <p className="text-ink/60">
            {admin
              ? "Schedule open plays by rank, register pairs at the Player desk, then start each one here."
              : "Pick the open play for your level, then sign up as a pair at the booth."}
          </p>
        </div>
        {me?.role === "admin" && <ViewToggle all={all} />}
        {!me && (
          <Link
            href="/host/signup"
            className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
          >
            <span aria-hidden>🏓</span>&nbsp;Host your own open play
          </Link>
        )}
      </header>
      {!admin && <AutoRefresh seconds={30} />}
      {me && (
        <div className="flex flex-wrap items-center gap-2">
          <CreateOpenPlay
            feeCents={openPlayFee().cents}
            venues={venues}
            group={{
              name: account?.groupName ?? "",
              logo: logoUrl(me.id, account?.logoUpdatedAt ?? null),
            }}
          />
          <Link
            href={`/groups/${me.id}`}
            className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
          >
            <span aria-hidden>🌐</span>&nbsp;Your public page
          </Link>
        </div>
      )}

      {live.length > 0 && (
        <Section title="Live now" emoji="🔴" plays={live} admin={admin} />
      )}
      <Section
        title="Coming up"
        emoji="🗓️"
        plays={upcoming}
        admin={admin}
        empty={
          live.length > 0
            ? "Nothing else coming up."
            : admin
              ? all
                ? "No open plays scheduled. Add one above."
                : "No open plays you host yet. Add one above, or ask a host to invite you."
              : "No open plays scheduled yet. Check back soon!"
        }
      />
    </>
  );
}

/**
 * From yesterday, so a late-night open play doesn't vanish at midnight
 * when the server's clock is in another time zone.
 */
function sinceYesterday(): string {
  return dateInput(Date.now() - 24 * 60 * 60 * 1000);
}

function Section({
  title,
  emoji,
  plays,
  admin,
  empty,
}: {
  title: string;
  emoji: string;
  plays: OpenPlay[];
  admin: boolean;
  empty?: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-display text-2xl font-bold">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      {plays.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          {empty}
        </p>
      ) : (
        byDate(plays).map(([date, day]) => (
          <div key={date} className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold text-ink/60">
              📅 {dayLabel.format(new Date(`${date}T00:00:00Z`))}
            </h3>
            <ul className="grid gap-4 md:grid-cols-2">
              {day.map((play) => (
                <li key={play.id}>
                  <OpenPlayCard play={play} href={`/open-plays/${play.id}`}>
                    {admin && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/players?date=${play.playDate}&openPlay=${play.id}`}
                          className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
                        >
                          Register pairs
                        </Link>
                        <Link
                          href={`/open-plays/${play.id}/hosts`}
                          className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
                        >
                          <span aria-hidden>👥</span>&nbsp;Hosts
                        </Link>
                        <Link
                          href={`/open-plays/${play.id}/details`}
                          className={`${BUTTON} ring-2 ${play.venue ? "ring-ink/10 hover:ring-fuchsia-300" : "bg-amber-100 text-amber-900 ring-amber-300"}`}
                        >
                          <span aria-hidden>{play.venue ? "✏️" : "📍"}</span>
                          &nbsp;{play.venue ? "Venue & banner" : "Add venue"}
                        </Link>
                        {play.pairCount === 0 && !play.live && (
                          <RemoveOpenPlay id={play.id} />
                        )}
                      </div>
                    )}
                  </OpenPlayCard>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

/** Admin: the open plays they host, or every open play. */
function ViewToggle({ all }: { all: boolean }) {
  const tab = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-xl px-4 font-display font-semibold ${on ? "bg-white text-fuchsia-700 shadow-sm" : "text-ink/60 hover:text-fuchsia-600"}`;
  return (
    <nav
      aria-label="Which open plays"
      className="flex rounded-2xl bg-ink/5 p-1"
    >
      <Link
        href="/"
        aria-current={all ? undefined : "page"}
        className={tab(!all)}
      >
        Mine
      </Link>
      <Link
        href="/?view=all"
        aria-current={all ? "page" : undefined}
        className={tab(all)}
      >
        All
      </Link>
    </nav>
  );
}

const dayLabel = new Intl.DateTimeFormat("en", {
  dateStyle: "full",
  timeZone: "UTC",
});

/** Open plays grouped by date, in order. */
function byDate(plays: OpenPlay[]): [string, OpenPlay[]][] {
  const days = new Map<string, OpenPlay[]>();
  for (const p of plays)
    days.set(p.playDate, [...(days.get(p.playDate) ?? []), p]);
  return [...days.entries()];
}
