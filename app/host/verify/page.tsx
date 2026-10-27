import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HostVerifyForm } from "@/components/host/host-forms";
import { Loading } from "@/components/loading";

export const metadata: Metadata = { title: "Verify your email" };

const CARD =
  "rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8";

export default function HostVerifyPage({
  searchParams,
}: PageProps<"/host/verify">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className={CARD}>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>📬</span> Check your email
        </h1>
        <p className="mt-2 text-ink/60">
          We sent a 6-digit code. Enter it to verify your email and open your
          host account. It expires in 10 minutes.
        </p>
        <Suspense fallback={<Loading />}>
          <Verify searchParams={searchParams} />
        </Suspense>
      </section>
    </main>
  );
}

async function Verify({
  searchParams,
}: Pick<PageProps<"/host/verify">, "searchParams">) {
  const { u } = await searchParams;
  if (typeof u !== "string" || !u) {
    return (
      <p className="mt-4 text-ink/70">
        Nothing to verify here.{" "}
        <Link href="/admin/login" className="font-semibold text-fuchsia-600">
          Sign in
        </Link>{" "}
        to get a new code.
      </p>
    );
  }
  return <HostVerifyForm username={u} />;
}
