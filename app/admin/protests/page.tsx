import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { resolveProtest } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Loading } from "@/components/loading";
import { ProtestList } from "@/components/players/protest-list";
import { RecordCard } from "@/components/players/record-card";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getOpenPlay,
  listProtests,
  playerMatches,
  sharedOpenPlay,
  type OpenPlay,
} from "@/lib/db/queries";
import { ranksLabel, whenLabel } from "@/lib/registration/open-play";
import { playerGames, playerRecord } from "@/lib/ranking/record";

export const metadata: Metadata = { title: "Protests" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

const when = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ProtestsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>📣</span> Level protests
        </h1>
        <p className="text-ink/60">
          Check each player&apos;s record, then approve to move them or reject
          with a note. Every decision is kept on their profile.
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <Protests />
      </Suspense>
    </main>
  );
}

async function Protests() {
  if (!(await isAdmin())) redirect("/admin/login");
  const db = getDb();
  const all = await listProtests(db);
  const pending = all.filter((p) => p.status === "pending");
  const resolved = all.filter((p) => p.status !== "pending").slice(0, 20);
  const records = new Map(
    await Promise.all(
      pending.map(
        async (p) =>
          [
            p.id,
            playerRecord(
              playerGames(p.playerId, await playerMatches(db, p.playerId)),
            ),
          ] as const,
      ),
    ),
  );

  // Where the filer and the player met: the evidence that it's genuine.
  const shared = new Map(
    await Promise.all(
      pending.map(
        async (p) =>
          [
            p.id,
            p.filedById
              ? await getOpenPlay(
                  db,
                  (await sharedOpenPlay(db, p.filedById, p.playerId))?.id ?? "",
                )
              : null,
          ] as const,
      ),
    ),
  );

  return (
    <>
      {pending.length === 0 ? (
        <p className={`${CARD} text-center text-ink/50`}>
          No protests waiting. 🎉
        </p>
      ) : (
        <ol className="flex flex-col gap-5">
          {pending.map((p) => (
            <li key={p.id} className={`${CARD} flex flex-col gap-4`}>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/players/${p.playerId}`}
                  className="font-display text-2xl font-bold hover:text-fuchsia-600"
                >
                  {p.playerName}
                </Link>
                <LevelBadge level={p.currentLevel} />→
                <LevelBadge level={p.requestedLevel} />
                <span className="ml-auto text-sm font-semibold text-ink/45">
                  {when.format(p.createdAt)}
                </span>
              </div>
              <p className="rounded-2xl bg-white p-3 text-ink/80">
                “{p.reason}”
              </p>
              <FiledBy
                name={p.filedByName}
                email={p.filedByEmail}
                id={p.filedById}
                shared={shared.get(p.id) ?? null}
              />
              <RecordCard record={records.get(p.id)!} />
              <form
                action={resolveProtest}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input type="hidden" name="protestId" value={p.id} />
                <label className="flex-1">
                  <span className="sr-only">Note to the player</span>
                  <input
                    name="note"
                    maxLength={500}
                    placeholder="Note to the player (optional)"
                    className="min-h-11 w-full rounded-2xl bg-sky-50 px-4 ring-2 ring-sky-100 outline-none focus:ring-sky-400"
                  />
                </label>
                <Button
                  type="submit"
                  name="decision"
                  value="approve"
                  variant="lime"
                >
                  ✓ Approve
                </Button>
                <Button
                  type="submit"
                  name="decision"
                  value="reject"
                  variant="secondary"
                >
                  Reject
                </Button>
              </form>
            </li>
          ))}
        </ol>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-title" className={CARD}>
          <h2 id="resolved-title" className="font-display text-2xl font-bold">
            Recently decided
          </h2>
          <ProtestList protests={resolved} />
        </section>
      )}
    </>
  );
}

/** Who filed the protest (admins only see the email) and where they met. */
function FiledBy({
  id,
  name,
  email,
  shared,
}: {
  id: string | null;
  name: string | null;
  email: string | null;
  shared: OpenPlay | null;
}) {
  if (!id || !name) {
    return (
      <p className="rounded-2xl bg-ink/5 px-4 py-2 text-sm font-semibold text-ink/60">
        Filed before sign-in was required (anonymous).
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 rounded-2xl bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">
      <span>
        📝 Filed by{" "}
        <Link href={`/players/${id}`} className="underline">
          {name}
        </Link>
      </span>
      {email && <span className="text-sky-900/70">{email}</span>}
      <span className="text-sky-900/70">
        {shared
          ? `· played together: ${ranksLabel(shared)}, ${whenLabel(shared)}`
          : "· no shared open play found"}
      </span>
    </p>
  );
}
