import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/ui/staff-login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white backdrop-blur sm:p-8">
        <p className="text-sm font-bold tracking-widest text-fuchsia-500 uppercase">
          Admins
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold">
          <span aria-hidden>🔑</span> Admin sign in
        </h1>
        <p className="mt-2 text-ink/60">
          Set levels, review protests, and manage accounts.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
