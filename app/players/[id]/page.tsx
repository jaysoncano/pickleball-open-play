import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { LevelBadge } from "@/components/level-badge";
import { Loading } from "@/components/loading";
import { ChangeLevelForm } from "@/components/players/change-level-form";
import { MatchList } from "@/components/players/match-list";
import { ProtestForm } from "@/components/players/protest-form";
import { ProtestList } from "@/components/players/protest-list";
import { ProfileCard } from "@/components/players/profile-card";
import { QrCard } from "@/components/profile/qr-card";
import { currentAdmin, currentPlayer, staffFor } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getPlayer,
  getPlayerPrivate,
  protestProblem,
  levelHistory,
  listPlayers,
  listProtests,
  playerMatches,
} from "@/lib/db/queries";
import { LEVEL_INFO } from "@/lib/ranking/levels";
import { rankPlayers } from "@/lib/ranking/rank";
import { playerGames, playerRecord } from "@/lib/ranking/record";

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function PlayerPage({ params }: PageProps<"/players/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/players"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← All players
      </Link>
      <Suspense fallback={<Loading />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<PageProps<"/players/[id]">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [player, staff, me] = await Promise.all([
    getPlayer(db, id),
    currentAdmin(),
    currentPlayer(),
  ]);
  if (!player) notFound();
  // Admins set levels and see QR codes; hosts edit players they signed up.
  const admin = staff?.role === "admin";
  const [matches, protests, changes, everyone] = await Promise.all([
    playerMatches(db, id),
    listProtests(db, { playerId: id }),
    levelHistory(db, id),
    listPlayers(db),
  ]);
  const games = playerGames(id, matches);
  const record = playerRecord(games);
  const rank = rankPlayers(everyone).get(id);
  const pending = protests.find((p) => p.status === "pending");
  // Who may protest: a signed-in player who shared an open play with them.
  const protestBlock = me ? await protestProblem(db, me.playerId, id) : null;
  const myName = me ? (await getPlayer(db, me.playerId))?.name : null;
  const canEdit = (await staffFor(staff, id)) || me?.playerId === id;
  const secret = await getPlayerPrivate(db, id);
  const token = admin ? secret?.claimToken : undefined;

  return (
    <>
      <ProfileCard
        player={player}
        record={record}
        rank={rank}
        actions={
          canEdit && (
            <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink/5 pt-4">
              {canEdit && (
                <Link
                  href={`/players/${id}/edit`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-fuchsia-500 px-5 font-display font-semibold text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400"
                >
                  <span aria-hidden>✏️</span> Edit info
                </Link>
              )}
              {admin && <ChangeLevelForm playerId={id} level={player.level} />}
            </div>
          )
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="matches-title" className={CARD}>
          <h2
            id="matches-title"
            className="mb-3 font-display text-2xl font-bold"
          >
            Match history
          </h2>
          <MatchList games={games} />
        </section>

        <aside className="flex flex-col gap-5">
          {!canEdit && (
            <section
              aria-labelledby="mine-title"
              className={`${CARD} flex flex-col gap-2`}
            >
              <h2 id="mine-title" className="font-display text-xl font-bold">
                <span aria-hidden>🙋</span> Is this you?
              </h2>
              <p className="text-sm text-ink/60">
                {secret?.email
                  ? "Update your info and photo. We'll email you a code."
                  : "Ask the host for your QR code to set up your profile and photo."}
              </p>
              {secret?.email && (
                <Link
                  href={`/players/${id}/verify`}
                  className="self-start rounded-2xl bg-white px-4 py-2 font-display font-semibold ring-2 ring-ink/10 hover:ring-fuchsia-300"
                >
                  This is me → update info
                </Link>
              )}
            </section>
          )}
          {token && <QrCard playerId={id} name={player.name} token={token} />}
          <section aria-labelledby="protest-title" className={CARD}>
            <h2 id="protest-title" className="font-display text-2xl font-bold">
              <span aria-hidden>📣</span> Protest this level
            </h2>
            {pending ? (
              <p className="mt-2 rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
                A request to move to {LEVEL_INFO[pending.requestedLevel].label}{" "}
                is waiting for an admin.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-ink/60">
                  Think {player.name} belongs at another level? Ask an admin to
                  review. Only signed-in players who were in an open play with{" "}
                  {player.name} can file one.
                </p>
                {!me ? (
                  <Link
                    href={`/login?next=/players/${id}`}
                    className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-fuchsia-500 px-4 font-display font-semibold text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400"
                  >
                    👤 Sign in to protest
                  </Link>
                ) : protestBlock ? (
                  <p className="mt-3 rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold text-ink/70">
                    {protestBlock}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold text-ink/50">
                      Filing as {myName}
                    </p>
                    <ProtestForm playerId={id} currentLevel={player.level} />
                  </>
                )}
              </>
            )}
            {/* Public page: only the protest itself, never who filed it. */}
            <ProtestList
              protests={protests.map((p) => ({
                id: p.id,
                currentLevel: p.currentLevel,
                requestedLevel: p.requestedLevel,
                reason: p.reason,
                status: p.status,
                adminNote: p.adminNote,
                createdAt: p.createdAt,
              }))}
            />
          </section>

          {changes.length > 0 && (
            <section aria-labelledby="levels-title" className={CARD}>
              <h2
                id="levels-title"
                className="mb-3 font-display text-2xl font-bold"
              >
                Level history
              </h2>
              <ol className="flex flex-col gap-2">
                {changes.map((c) => (
                  <li key={c.id} className="rounded-2xl bg-white p-3 text-sm">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <LevelBadge level={c.fromLevel} size="sm" />→
                      <LevelBadge level={c.toLevel} size="sm" />
                      <span className="ml-auto font-semibold text-ink/45">
                        {dateLabel.format(c.createdAt)}
                      </span>
                    </span>
                    {c.note && <p className="mt-1 text-ink/60">{c.note}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
