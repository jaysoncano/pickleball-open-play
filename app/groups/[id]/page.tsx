import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ShareLink } from "@/components/groups/share-link";
import { Loading } from "@/components/loading";
import { OpenPlayCard } from "@/components/open-plays/open-play-card";
import { getDb } from "@/lib/db/client";
import { getGroup, listOpenPlays, type OpenPlay } from "@/lib/db/queries";
import { dateInput } from "@/lib/queue/time";
import { logoUrl } from "@/lib/roles";

export const metadata: Metadata = { title: "Host group" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
/** Past open plays shown on the profile. */
const PAST = 6;

type Props = PageProps<"/groups/[id]">;

/** Public: a host group's profile and the open plays it runs. */
export default function GroupPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← All open plays
      </Link>
      <Suspense fallback={<Loading />}>
        <GroupProfile params={params} />
      </Suspense>
    </main>
  );
}

async function GroupProfile({ params }: Pick<Props, "params">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const [group, plays] = await Promise.all([
    getGroup(db, id),
    listOpenPlays(db, { hostedBy: id }),
  ]);
  if (!group) notFound();

  const since = sinceYesterday();
  const live = plays.filter((p) => p.live);
  const upcoming = plays.filter((p) => !p.live && p.playDate >= since);
  const past = plays
    .filter((p) => !p.live && p.playDate < since)
    .reverse()
    .slice(0, PAST);
  const venues = [...new Set(plays.map((p) => p.venue).filter(Boolean))];
  const name = group.name || "Open play host";
  const logo = logoUrl(group.id, group.logoUpdatedAt);

  return (
    <>
      <AutoRefresh seconds={60} />
      <header className={`${CARD} flex flex-wrap items-center gap-4`}>
        <span className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-fuchsia-50 ring-4 ring-white">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden className="text-5xl">
              🏓
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-wide text-fuchsia-700 uppercase">
            Pickleball open play
          </p>
          <h1 className="font-display text-3xl font-bold break-words">
            {name}
          </h1>
          <p className="font-semibold text-ink/60">
            {plays.length} open play{plays.length === 1 ? "" : "s"} hosted
            {upcoming.length > 0 && ` · ${upcoming.length} coming up`}
          </p>
        </div>
        <ShareLink title={`${name} · POP open plays`} />
      </header>

      {venues.length > 0 && (
        <section aria-label="Courts" className="flex flex-wrap gap-2">
          {venues.map((v) => (
            <span
              key={v}
              className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold ring-2 ring-white"
            >
              <span aria-hidden>📍</span> {v}
            </span>
          ))}
        </section>
      )}

      {live.length > 0 && <Plays emoji="🔴" title="Live now" plays={live} />}
      <Plays
        emoji="🗓️"
        title="Coming up"
        plays={upcoming}
        empty={`${name} has nothing scheduled right now. Check back soon!`}
      />
      {past.length > 0 && <Plays emoji="🕘" title="Recent" plays={past} />}
    </>
  );
}

/** From yesterday, like the home page, so a late open play doesn't vanish. */
function sinceYesterday(): string {
  return dateInput(Date.now() - 24 * 60 * 60 * 1000);
}

function Plays({
  emoji,
  title,
  plays,
  empty,
}: {
  emoji: string;
  title: string;
  plays: OpenPlay[];
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
        <ul className="grid gap-4 md:grid-cols-2">
          {plays.map((play) => (
            <li key={play.id}>
              <OpenPlayCard play={play} href={`/open-plays/${play.id}`} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
