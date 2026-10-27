import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Loading } from "@/components/loading";
import { ClaimFlow } from "@/components/profile/claim-flow";
import { profileEditor } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { getPlayer, getPlayerPrivate } from "@/lib/db/queries";
import { maskEmail } from "@/lib/profile/forms";

export const metadata: Metadata = {
  title: "Update your profile",
  robots: { index: false },
};

/** Returning players: a code to their linked email, no QR needed. */
export default function VerifyPage({
  params,
}: PageProps<"/players/[id]/verify">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <Suspense fallback={<Loading />}>
          <Verify params={params} />
        </Suspense>
      </section>
    </main>
  );
}

async function Verify({
  params,
}: Pick<PageProps<"/players/[id]/verify">, "params">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [player, secret, editor] = await Promise.all([
    getPlayer(db, id),
    getPlayerPrivate(db, id),
    profileEditor(id),
  ]);
  if (!player || !secret) notFound();
  if (editor) redirect(`/players/${id}/edit`);
  if (!secret.email) {
    return (
      <>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>📱</span> Get your QR code
        </h1>
        <p className="mt-2 text-ink/60">
          {player.name}&apos;s profile isn&apos;t set up yet. Ask the host at
          open play to show your QR code, then scan it with your phone camera.
        </p>
        <Link
          href={`/players/${id}`}
          className="mt-4 inline-block font-semibold text-fuchsia-600"
        >
          ← Back to profile
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
        Welcome back
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">
        Is this you, {player.name}?
      </h1>
      <p className="mt-2 text-ink/60">
        Enter the email linked to this profile ({maskEmail(secret.email)}) and
        we&apos;ll send a code.
      </p>
      <ClaimFlow playerId={id} />
    </>
  );
}
