import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { CreateOpenPlay } from "@/components/open-plays/create-open-play";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { getAdmin, venueSuggestions } from "@/lib/db/queries";
import { openPlayFee } from "@/lib/registration/forms";
import { logoUrl } from "@/lib/roles";

export const metadata: Metadata = { title: "New open play" };

/** Staff: schedule an open play on its own page. */
export default function NewOpenPlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/host"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← My open plays
      </Link>
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>🗓️</span> New open play
        </h1>
        <p className="text-ink/60">
          Where and when, the ranks it runs, and the entry per pair. You&apos;ll
          be its main host.
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <NewOpenPlay />
      </Suspense>
    </main>
  );
}

async function NewOpenPlay() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  const db = getDb();
  const [venues, account] = await Promise.all([
    venueSuggestions(db, {
      managedBy: me.role === "admin" ? undefined : me.id,
    }),
    getAdmin(db, me.id),
  ]);
  return (
    <CreateOpenPlay
      feeCents={openPlayFee().cents}
      venues={venues}
      group={{
        name: account?.groupName ?? "",
        logo: logoUrl(me.id, account?.logoUpdatedAt ?? null),
      }}
    />
  );
}
