import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { ConfirmLink } from "@/components/profile/confirm-link";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false },
};

/**
 * The link in the registration receipt. Confirming takes a tap, so email
 * scanners that open links don't confirm on the player's behalf.
 */
export default function ConfirmPage({ params }: PageProps<"/confirm/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          You&apos;re registered
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          <span aria-hidden>🎾</span> Confirm your email
        </h1>
        <p className="mt-2 text-ink/60">
          Then add your photo and info to your POP profile. It takes a minute.
        </p>
        <Suspense fallback={<Loading />}>
          <Confirm params={params} />
        </Suspense>
      </section>
    </main>
  );
}

async function Confirm({
  params,
}: Pick<PageProps<"/confirm/[token]">, "params">) {
  return <ConfirmLink token={(await params).token} />;
}
