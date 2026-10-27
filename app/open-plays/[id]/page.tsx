import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { App } from "@/components/app";
import { AutoRefresh } from "@/components/auto-refresh";
import { LevelBadge } from "@/components/level-badge";
import { Loading } from "@/components/loading";
import {
  PlayHeader,
  PlayVenue,
  RankChip,
} from "@/components/open-plays/open-play-card";
import { RankRoster } from "@/components/open-plays/rank-roster";
import { SignupForm } from "@/components/open-plays/signup-form";
import { PublicBoard } from "@/components/public-board";
import { currentAdmin, managesOpenPlay } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getLiveSession,
  getOpenPlay,
  listRegistrations,
  pairMembers,
  type OpenPlay,
} from "@/lib/db/queries";
import { LEVEL_INFO, LevelSchema, type Level } from "@/lib/ranking/levels";
import { formatMoney, openPlayFee, pairLevel } from "@/lib/registration/forms";
import { ranksLabel, spotsLeft, whenLabel } from "@/lib/registration/open-play";

export const metadata: Metadata = { title: "Open play" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-2xl px-4 font-display font-semibold";

type Props = PageProps<"/open-plays/[id]">;

export default function OpenPlayPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <OpenPlayView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OpenPlayView({ params, searchParams }: Props) {
  const { id } = await params;
  const db = getDb();
  const [play, me] = await Promise.all([getOpenPlay(db, id), currentAdmin()]);
  if (!play) notFound();
  const session = await getLiveSession(db, id);

  // Its hosts (and admins) run it; everyone else sees the public page.
  if (await managesOpenPlay(me, id)) {
    return (
      <App
        openPlay={{
          id,
          when: whenLabel(play),
          rank: ranksLabel(play),
          levels: play.levels,
        }}
        initial={session}
      />
    );
  }

  const query = await searchParams;
  if (session && query.view === "courts") {
    const members = await pairMembers(db, Object.keys(session.players));
    return (
      <PublicBoard
        session={session}
        members={Object.fromEntries(members)}
        heading={[ranksLabel(play), whenLabel(play), play.venue]
          .filter(Boolean)
          .join(" · ")}
      />
    );
  }
  const rank = LevelSchema.safeParse(query.rank);
  const view =
    rank.success && play.levels.includes(rank.data) ? rank.data : null;
  return <PublicOpenPlay play={play} live={Boolean(session)} rank={view} />;
}

/** Public: the open play's ranks; tap one to see who's in and how to join. */
async function PublicOpenPlay({
  play,
  live,
  rank,
}: {
  play: OpenPlay;
  live: boolean;
  rank: Level | null;
}) {
  const { pairs, pending, solos } = await listRegistrations(getDb(), play.id);
  const levelOf = (p: (typeof pairs)[number]) =>
    pairLevel(p.members.map((m) => m.level));
  const left = spotsLeft(play.maxPairs, play.pairCount);
  const base = `/open-plays/${play.id}`;
  const fee = formatMoney(play.feeCents, openPlayFee().currency);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <AutoRefresh seconds={30} />
      <Link
        href="/"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← All open plays
      </Link>
      <header className="flex flex-col overflow-hidden rounded-[2rem] bg-white/90 ring-2 ring-white backdrop-blur">
        <PlayHeader play={play} banner="h-36 sm:h-52" logo="size-20">
          <span className="rounded-full bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
            <RankChip play={play} />
          </span>
        </PlayHeader>
        <div className="flex flex-col gap-2 p-4 pt-2 sm:px-5 sm:pb-5">
          <h1 className="font-display text-3xl font-bold">{whenLabel(play)}</h1>
          <PlayVenue play={play} />
          <p className="font-semibold text-ink/60">
            {play.pairCount} pair{play.pairCount === 1 ? "" : "s"} joined
            {left !== null &&
              ` · ${left} spot${left === 1 ? "" : "s"} left`} · {fee} per pair
          </p>
          {live && (
            <Link
              href={`${base}?view=courts`}
              className={`${BUTTON} self-start bg-rose-500 text-white hover:bg-rose-400`}
            >
              🔴 Live now · watch the courts
            </Link>
          )}
        </div>
      </header>

      <section aria-labelledby="ranks-title" className="flex flex-col gap-3">
        <h2 id="ranks-title" className="font-display text-2xl font-bold">
          Pick your rank
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {play.levels.map((level) => {
            const count = pairs.filter((p) => levelOf(p) === level).length;
            const on = rank === level;
            return (
              <li key={level}>
                <Link
                  href={`${base}?rank=${level}`}
                  scroll={false}
                  aria-current={on ? "page" : undefined}
                  className={`group flex h-full flex-col gap-2 rounded-[2rem] p-4 ring-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-20px_rgba(36,28,71,0.4)] focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:outline-none ${on ? "bg-white ring-fuchsia-400" : "bg-white/80 ring-white hover:ring-fuchsia-300"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <LevelBadge level={level} />
                    <span
                      aria-hidden
                      className="text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-fuchsia-500"
                    >
                      →
                    </span>
                  </span>
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {count} pair{count === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm font-semibold text-ink/55">
                    See who&apos;s in and how to join
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {rank && (
        <RankRoster
          level={rank}
          pairs={pairs.filter((p) => levelOf(p) === rank)}
          pending={pending.filter((p) => p.requestedLevel === rank)}
          solos={solos.filter((m) => (m.requestedLevel ?? m.level) === rank)}
        />
      )}
      {rank && (
        <section aria-labelledby="join-title" className={CARD}>
          <h2 id="join-title" className="font-display text-2xl font-bold">
            ✋ Join {LEVEL_INFO[rank].label}
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-ink/80">
            <li>
              Sign up below as a <b>pair</b> or <b>solo</b>. A pair plays at its{" "}
              <b>stronger player&apos;s level</b>, so that should be{" "}
              {LEVEL_INFO[rank].label}.
            </li>
            <li>
              Pay <b>{fee}</b> for your pair (one entry, paid in full) at the{" "}
              <b>management booth</b>.
            </li>
            <li>
              The admin confirms your payment: you&apos;re in the queue, and
              both of you get a receipt email with a link to your profile.
            </li>
            <li>
              No partner? Sign up solo at the booth; they&apos;ll pair you.
            </li>
          </ol>
          {left === 0 ? (
            <p className="mt-3 rounded-2xl bg-rose-100 px-4 py-3 font-semibold text-rose-700">
              This open play is full.
            </p>
          ) : (
            <div className="mt-4">
              <SignupForm openPlayId={play.id} rank={rank} fee={fee} />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
