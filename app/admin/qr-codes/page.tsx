import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { PrintButton } from "@/components/profile/qr-actions";
import { QrCode } from "@/components/profile/qr-code";
import { isAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { listClaimTokens } from "@/lib/db/queries";
import { profileStatus, STATUS_INFO } from "@/lib/profile/status";

export const metadata: Metadata = { title: "Player QR codes" };

export default function QrCodesPage({
  searchParams,
}: PageProps<"/admin/qr-codes">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-3xl font-bold">
            <span aria-hidden>📱</span> Player QR codes
          </h1>
          <p className="text-ink/60">
            Print and hand out. Scanning one lets that player verify their email
            and fill in their info and photo.
          </p>
        </div>
        <PrintButton label="Print all" />
      </header>
      <Suspense fallback={<Loading />}>
        <Sheet searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const FILTER =
  "inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold";

async function Sheet({
  searchParams,
}: Pick<PageProps<"/admin/qr-codes">, "searchParams">) {
  if (!(await isAdmin())) redirect("/admin/login");
  const all = (await searchParams).show === "all";
  const everyone = (await listClaimTokens(getDb())).map((p) => ({
    ...p,
    status: profileStatus(p),
  }));
  const rows = all ? everyone : everyone.filter((p) => p.status === "new");
  const pending = everyone.filter((p) => p.status === "new").length;
  const filters = (
    <nav aria-label="Which players" className="flex gap-2 print:hidden">
      <a
        href="/admin/qr-codes"
        aria-current={all ? undefined : "page"}
        className={`${FILTER} ${all ? "text-ink/60 hover:bg-white" : "bg-fuchsia-500 text-white"}`}
      >
        Needs setup ({pending})
      </a>
      <a
        href="/admin/qr-codes?show=all"
        aria-current={all ? "page" : undefined}
        className={`${FILTER} ${all ? "bg-fuchsia-500 text-white" : "text-ink/60 hover:bg-white"}`}
      >
        Everyone ({everyone.length})
      </a>
    </nav>
  );
  if (rows.length === 0) {
    if (everyone.length > 0) {
      return (
        <>
          {filters}
          <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
            Everyone has verified their email. 🎉 Returning players use “This is
            me” on their profile; no QR needed.
          </p>
        </>
      );
    }
    return (
      <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
        No players yet. They&apos;re registered when a host adds them to open
        play.
      </p>
    );
  }
  return (
    <>
      {filters}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex break-inside-avoid flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center ring-2 ring-ink/5"
          >
            <QrCode
              token={p.claimToken}
              label={`QR code for ${p.name}`}
              className="w-full max-w-40"
            />
            <p className="font-display text-lg leading-tight font-bold">
              {p.fullName || p.name}
            </p>
            <p className="text-xs font-semibold text-ink/50">
              Scan to update your POP profile
            </p>
            <p
              className={`rounded-full px-2 py-0.5 text-xs font-bold print:hidden ${STATUS_INFO[p.status].tone}`}
            >
              {STATUS_INFO[p.status].label}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
