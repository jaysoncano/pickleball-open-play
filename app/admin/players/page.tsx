import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlayerDesk } from "@/components/admin/player-desk";
import { Loading } from "@/components/loading";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { listClaimTokens, managedPlayerIds } from "@/lib/db/queries";
import { photoUrl } from "@/lib/profile/forms";
import { missingSteps, profileStatus } from "@/lib/profile/status";
import { openPlayFee } from "@/lib/registration/forms";

export const metadata: Metadata = { title: "Player desk" };

/** The management booth: find or register a player and fill in for them. */
export default function PlayerDeskPage({
  searchParams,
}: PageProps<"/admin/players">) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>🗂️</span> Player desk
        </h1>
        <p className="text-ink/60">
          The management booth. Pick the open play, register pairs (paid now or
          pay later), confirm payments, and receipts are emailed. Returning
          player? Type their email: their level and history come with them.
          Players without a phone or data? Tap <b>Edit</b> and fill in their
          info for them.
        </p>
      </header>
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
  if (!me) redirect("/admin/login");
  const { date, openPlay } = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const db = getDb();
  // Players' emails are private: hosts see the players of their own open
  // plays. Returning players from elsewhere link by their email.
  const admin = me.role === "admin";
  const rows = await listClaimTokens(
    db,
    admin ? undefined : await managedPlayerIds(db, me.id),
  );
  return (
    <PlayerDesk
      admin={admin}
      currency={openPlayFee().currency}
      initialDate={one(date)}
      initialOpenPlay={one(openPlay)}
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
