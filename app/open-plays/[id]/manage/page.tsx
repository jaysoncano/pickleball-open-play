import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { BannerForm } from "@/components/open-plays/banner-forms";
import { EditOpenPlayForm } from "@/components/open-plays/edit-open-play";
import {
  CancelInvite,
  InviteHostForm,
  RemoveHost,
} from "@/components/open-plays/host-forms";
import { PlayHeader, RankChip } from "@/components/open-plays/open-play-card";
import { RemoveOpenPlay } from "@/components/open-plays/remove-open-play";
import { VenueForm } from "@/components/open-plays/venue-form";
import { currentAdmin, invitesHosts, managesOpenPlay } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getOpenPlay,
  listAdmins,
  listOpenPlayHosts,
  listOpenPlayInvites,
  listRegistrations,
  venueSuggestions,
} from "@/lib/db/queries";
import { formatMoney, openPlayFee } from "@/lib/registration/forms";
import { spotsLeft, whenLabel, KIND_INFO } from "@/lib/registration/open-play";
import { ROLE_INFO, venueLabel } from "@/lib/roles";

export const metadata: Metadata = { title: "Manage open play" };

const CARD =
  "flex flex-col gap-3 rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";
const BUTTON =
  "inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold";

type Props = PageProps<"/open-plays/[id]/manage">;

/**
 * Its hosts: everything about one open play in one place. Every host
 * edits it and runs it; only its main host (or an admin) picks the hosts.
 */
export default function ManagePage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/host"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← My open plays
      </Link>
      <Suspense fallback={<Loading />}>
        <Manage params={params} />
      </Suspense>
    </main>
  );
}

async function Manage({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const me = await currentAdmin();
  if (!me) redirect("/host/login");
  const db = getDb();
  const play = await getOpenPlay(db, id);
  if (!play) notFound();
  if (!(await managesOpenPlay(me, id))) redirect(`/open-plays/${id}`);
  const mainHost = await invitesHosts(me, id);
  const [hosts, accounts, invites, signups, venues] = await Promise.all([
    listOpenPlayHosts(db, id),
    mainHost ? listAdmins(db) : [],
    mainHost ? listOpenPlayInvites(db, id) : [],
    listRegistrations(db, id),
    venueSuggestions(db, {
      managedBy: me.role === "admin" ? undefined : me.id,
    }),
  ]);
  const taken = new Set(hosts.map((h) => h.id));
  const owner = hosts.find((h) => h.owner);
  const left = spotsLeft(play.maxPairs, play.pairCount);
  const fee = formatMoney(play.feeCents, openPlayFee().currency);

  return (
    <>
      <header className="flex flex-col overflow-hidden rounded-[2rem] bg-white/90 ring-2 ring-white backdrop-blur">
        <PlayHeader play={play} banner="h-32 sm:h-44" logo="size-16">
          <span className="rounded-full bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
            <RankChip play={play} />
          </span>
          {play.live && (
            <span className="rounded-full bg-rose-500 px-3 py-1 text-sm font-bold text-white">
              🔴 Live now
            </span>
          )}
        </PlayHeader>
        <div className="flex flex-col gap-3 p-4 pt-2 sm:px-6 sm:pb-6">
          <div>
            <p className="text-sm font-bold tracking-wide text-fuchsia-600 uppercase">
              ⚙️ Manage open play
            </p>
            <h1 className="font-display text-3xl font-bold">
              {whenLabel(play)}
            </h1>
            <p className="font-semibold text-ink/60">
              <span className="mr-2 rounded-full bg-fuchsia-100 px-2 py-0.5 text-sm font-bold text-fuchsia-800">
                {KIND_INFO[play.kind].label}
              </span>
              {venueLabel(play) || "Venue to be announced"}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Paid pairs" value={play.pairCount} />
            <Stat label="Waiting to pay" value={signups.pending.length} />
            <Stat label="Solo" value={signups.solos.length} />
            <Stat
              label={left === null ? "No cap" : "Spots left"}
              value={left ?? "∞"}
            />
          </dl>
          <p className="text-sm font-semibold text-ink/55">
            {fee} per pair · you&apos;re{" "}
            {me.role === "admin"
              ? "an admin"
              : owner?.id === me.id
                ? "the main host"
                : "a co-host"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/open-plays/${id}`}
              className={`${BUTTON} bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400`}
            >
              {play.live ? "🎾 Open the courts" : "▶️ Check in & start"}
            </Link>
            <Link
              href={`/admin/players?date=${play.playDate}&openPlay=${id}`}
              className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
            >
              Register pairs
            </Link>
          </div>
        </div>
      </header>

      <section aria-labelledby="edit-title" className={CARD}>
        <h2 id="edit-title" className="font-display text-xl font-bold">
          <span aria-hidden>🗓️</span> Date, ranks &amp; entry
        </h2>
        <EditOpenPlayForm play={play} />
      </section>

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

      <section aria-labelledby="hosts-title" className={CARD}>
        <div>
          <h2 id="hosts-title" className="font-display text-xl font-bold">
            <span aria-hidden>👥</span> Hosts
          </h2>
          <p className="text-sm text-ink/60">
            Every host can edit this open play, register pairs, take payments,
            and run the courts.{" "}
            {mainHost
              ? "As its main host, you choose who else hosts it."
              : `Only its main host${owner ? ` (${owner.username})` : ""} or an admin can invite or remove hosts.`}
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {hosts.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
            >
              <span className="flex-1 font-bold">
                {h.username}
                {h.id === me.id && (
                  <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-px text-xs text-fuchsia-800">
                    you
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-ink/45">
                {h.owner
                  ? "👑 Main host"
                  : `Co-host · ${ROLE_INFO[h.role].label}`}
              </span>
              {mainHost && !h.owner && (
                <RemoveHost
                  openPlayId={id}
                  adminId={h.id}
                  username={h.username}
                />
              )}
            </li>
          ))}
          {hosts.length === 0 && <li className="text-ink/50">No hosts yet.</li>}
        </ul>

        {mainHost && (
          <div className="mt-2 flex flex-col gap-2 border-t-2 border-ink/5 pt-4">
            <h3 className="font-display text-lg font-semibold">
              ✉️ Invite a co-host
            </h3>
            <p className="text-sm text-ink/60">
              Type a host&apos;s username, or anyone&apos;s email. No account
              yet? We email them an invitation to sign up as a host; once they
              verify their email, they co-host this open play.
            </p>
            <InviteHostForm
              openPlayId={id}
              usernames={accounts
                .filter((a) => a.verified && !taken.has(a.id))
                .map((a) => a.username)}
            />
            {invites.length > 0 && (
              <>
                <h4 className="mt-2 font-display font-semibold">
                  Waiting to sign up ({invites.length})
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {invites.map((email) => (
                    <li
                      key={email}
                      className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        ✉️ {email}
                      </span>
                      <CancelInvite openPlayId={id} email={email} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {play.pairCount === 0 && !play.live && signups.pending.length === 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] p-4 ring-2 ring-ink/10">
          <p className="text-sm font-semibold text-ink/60">
            Nobody has signed up yet, so it can still be removed.
          </p>
          <RemoveOpenPlay id={id} then="/host" />
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-sky-50 px-3 py-2 ring-2 ring-sky-100">
      <dt className="text-xs font-bold tracking-wide text-ink/50 uppercase">
        {label}
      </dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}
