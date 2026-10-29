import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DeskWorkspace, OpenPlayPicker } from "@/components/admin/player-desk";
import { Loading } from "@/components/loading";
import { currentAdmin, managesOpenPlay } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getOpenPlay,
  listClaimTokens,
  managedPlayerIds,
} from "@/lib/db/queries";
import { photoUrl } from "@/lib/profile/forms";
import { missingSteps, profileStatus } from "@/lib/profile/status";
import { openPlayFee } from "@/lib/registration/forms";

export const metadata: Metadata = { title: "Player desk" };

/**
 * The booth: pick an open play, then register pairs and run payments on
 * one screen. Each column scrolls on its own from `lg` up.
 */
export default function PlayerDeskPage({
  searchParams,
}: PageProps<"/admin/players">) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-4 lg:h-[calc(100dvh-4.5rem)] lg:min-h-0">
      <Suspense fallback={<Loading />}>
        <Desk searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Desk({
  searchParams,
}: Pick<PageProps<"/admin/players">, "searchParams">) {
  const me = await currentAdmin();
  if (!me) redirect("/host/login");
  const { date, openPlay } = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const admin = me.role === "admin";
  const currency = openPlayFee().currency;
  const id = one(openPlay);

  if (!id) {
    return (
      <>
        <header>
          <h1 className="font-display text-3xl font-bold">
            <span aria-hidden>🗂️</span> Player desk
          </h1>
          <p className="text-ink/60">
            Pick the open play you&apos;re running to register pairs and take
            payments.
          </p>
        </header>
        <OpenPlayPicker
          admin={admin}
          currency={currency}
          initialDate={one(date)}
        />
      </>
    );
  }

  const db = getDb();
  const play = await getOpenPlay(db, id);
  // Only its hosts (and admins) run an open play's desk.
  if (!play || !(await managesOpenPlay(me, id))) notFound();
  // Ended: nothing to register; its page shows the results.
  if (play.ended) redirect(`/open-plays/${id}`);
  // Players' emails are private: hosts see the players of their own open
  // plays. Returning players from elsewhere link by their email.
  const rows = await listClaimTokens(
    db,
    admin ? undefined : await managedPlayerIds(db, me.id),
  );
  return (
    <DeskWorkspace
      admin={admin}
      play={play}
      currency={currency}
      players={rows.map((r) => ({
        id: r.id,
        name: r.name,
        firstName: r.firstName,
        lastName: r.lastName,
        fullName: r.fullName,
        email: r.email ?? "",
        photo: photoUrl(r.id, r.photoUpdatedAt),
        emailConfirmed: r.emailConfirmed,
        hasEmail: r.hasEmail,
        status: profileStatus(r),
        missing: missingSteps(r),
      }))}
    />
  );
}
