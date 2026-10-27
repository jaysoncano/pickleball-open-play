import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { PlayersDirectory } from "@/components/players/players-directory";
import { getDb } from "@/lib/db/client";
import { listPlayers } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Players" };

export default function PlayersPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>🙌</span> Players
        </h1>
        <p className="text-ink/60">
          Every registered player, their level, and their record. Open a player
          to see their full match history.
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <Directory />
      </Suspense>
    </main>
  );
}

async function Directory() {
  await connection();
  return <PlayersDirectory players={await listPlayers(getDb())} />;
}
