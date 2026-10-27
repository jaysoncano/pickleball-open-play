import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HostSignupForm } from "@/components/host/host-forms";

export const metadata: Metadata = { title: "Host sign up" };

const CARD =
  "rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8";

/** Anyone can host their own open plays: sign up, verify the email, go. */
export default function HostSignupPage({
  searchParams,
}: PageProps<"/host/signup">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className={CARD}>
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          Host your own open play
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          <span aria-hidden>🎾</span> Become a host
        </h1>
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-5 text-ink/70">
          <li>Sign up with your group and email.</li>
          <li>Enter the 6-digit code we email you.</li>
          <li>Schedule open plays, invite co-hosts, and run the courts.</li>
        </ol>
        <Suspense fallback={<HostSignupForm />}>
          <Prefilled searchParams={searchParams} />
        </Suspense>
        <p className="mt-4 text-center text-sm text-ink/60">
          Already a host?{" "}
          <Link
            href="/admin/login"
            className="font-semibold text-fuchsia-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

/** An emailed invitation links here with the invited email filled in. */
async function Prefilled({
  searchParams,
}: Pick<PageProps<"/host/signup">, "searchParams">) {
  const { email } = await searchParams;
  return <HostSignupForm email={typeof email === "string" ? email : ""} />;
}
