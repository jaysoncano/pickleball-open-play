import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { Loading } from "@/components/loading";
import { ClaimFlow } from "@/components/profile/claim-flow";
import { getDb } from "@/lib/db/client";
import { playerByClaimToken } from "@/lib/db/queries";
import { maskEmail } from "@/lib/profile/forms";

export const metadata: Metadata = {
  title: "Update your profile",
  robots: { index: false },
};

export default function ClaimPage({ params }: PageProps<"/claim/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <Suspense fallback={<Loading />}>
          <Claim params={params} />
        </Suspense>
      </section>
    </main>
  );
}

async function Claim({ params }: Pick<PageProps<"/claim/[token]">, "params">) {
  const { token } = await params;
  const player = z.uuid().safeParse(token).success
    ? await playerByClaimToken(getDb(), token)
    : null;
  if (!player) {
    return (
      <>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>🤔</span> QR code not valid
        </h1>
        <p className="mt-2 text-ink/60">
          This code was replaced or mistyped. Ask an admin for your current QR
          code.
        </p>
        <Link
          href="/players"
          className="mt-4 inline-block font-semibold text-fuchsia-600"
        >
          See all players →
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
        Player profile
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold">
        Hi, {player.name}! <span aria-hidden>👋</span>
      </h1>
      <p className="mt-2 text-ink/60">
        {player.email
          ? `Your profile is linked to ${maskEmail(player.email)}. We'll email a code there to check it's you.`
          : "Verify your email to fill in your info and photo. We'll send a 6-digit code. Your email stays private."}
      </p>
      <ClaimFlow token={token} />
    </>
  );
}
