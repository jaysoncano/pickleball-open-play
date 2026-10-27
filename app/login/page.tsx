import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { PlayerLogin } from "@/components/profile/player-login";
import { safeNext } from "@/lib/profile/verify";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

/** Players sign in with their email and a 6-digit code. */
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          Players
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          <span aria-hidden>👤</span> Sign in
        </h1>
        <p className="mt-2 text-ink/60">
          Sign in with your username and password, or get a 6-digit code at the
          email you signed up with.
        </p>
        <Suspense fallback={<Loading />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function Form({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <PlayerLogin next={safeNext(next, "/")} />;
}
