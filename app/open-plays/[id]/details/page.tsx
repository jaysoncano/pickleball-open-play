import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { BannerForm } from "@/components/open-plays/banner-forms";
import { RankChip } from "@/components/open-plays/open-play-card";
import { VenueForm } from "@/components/open-plays/venue-form";
import { currentAdmin, managesOpenPlay } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { getOpenPlay, venueSuggestions } from "@/lib/db/queries";
import { whenLabel } from "@/lib/registration/open-play";

export const metadata: Metadata = { title: "Venue & banner" };

const CARD =
  "flex flex-col gap-3 rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";

type Props = PageProps<"/open-plays/[id]/details">;

/** Its hosts: where it's played and the banner players see. */
export default function DetailsPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← Open plays
      </Link>
      <Suspense fallback={<Loading />}>
        <Details params={params} />
      </Suspense>
    </main>
  );
}

async function Details({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  const db = getDb();
  const play = await getOpenPlay(db, id);
  if (!play) notFound();
  if (!(await managesOpenPlay(me, id))) redirect(`/open-plays/${id}`);
  const venues = await venueSuggestions(db, {
    managedBy: me.role === "admin" ? undefined : me.id,
  });

  return (
    <>
      <header className="flex flex-col gap-2">
        <RankChip play={play} />
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>✏️</span> Venue &amp; banner
        </h1>
        <p className="text-ink/60">{whenLabel(play)}</p>
      </header>
      <section aria-labelledby="venue-title" className={CARD}>
        <h2 id="venue-title" className="font-display text-xl font-bold">
          <span aria-hidden>📍</span> Court venue
        </h2>
        {!play.venue && (
          <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
            This open play has no venue yet, so players see &ldquo;Venue to be
            announced&rdquo;. Add it below.
          </p>
        )}
        <VenueForm
          openPlayId={id}
          current={{ venue: play.venue, location: play.location }}
          venues={venues}
        />
      </section>
      <section aria-labelledby="banner-title" className={CARD}>
        <h2 id="banner-title" className="font-display text-xl font-bold">
          <span aria-hidden>🖼️</span> Banner
        </h2>
        <BannerForm play={play} />
      </section>
    </>
  );
}
