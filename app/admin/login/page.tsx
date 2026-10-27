import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Staff sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          Admins and hosts
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          <span aria-hidden>🔑</span> Staff sign in
        </h1>
        <p className="mt-2 text-ink/60">
          Hosts run their open plays: pairs, payments, and courts. Admins also
          set levels, review protests, and manage accounts. Sign in with your
          username and password.
        </p>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-ink/60">
          Want to host your own open plays?{" "}
          <Link
            href="/host/signup"
            className="font-semibold text-fuchsia-600 hover:underline"
          >
            Sign up as a host
          </Link>
        </p>
      </section>
    </main>
  );
}
