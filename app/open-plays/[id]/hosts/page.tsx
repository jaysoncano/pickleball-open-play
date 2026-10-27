import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { RankChip } from "@/components/open-plays/open-play-card";
import {
  CancelInvite,
  InviteHostForm,
  RemoveHost,
} from "@/components/open-plays/host-forms";
import { currentAdmin, managesOpenPlay } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getOpenPlay,
  listAdmins,
  listOpenPlayHosts,
  listOpenPlayInvites,
} from "@/lib/db/queries";
import { whenLabel } from "@/lib/registration/open-play";
import { ROLE_INFO, venueLabel } from "@/lib/roles";

export const metadata: Metadata = { title: "Hosts" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";

/** Who runs an open play, and inviting others to help. */
export default function HostsPage({
  params,
}: PageProps<"/open-plays/[id]/hosts">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <Link
        href="/"
        className="self-start rounded-xl font-semibold text-ink/60 hover:text-fuchsia-600"
      >
        ← Open plays
      </Link>
      <Suspense fallback={<Loading />}>
        <Hosts params={params} />
      </Suspense>
    </main>
  );
}

async function Hosts({
  params,
}: Pick<PageProps<"/open-plays/[id]/hosts">, "params">) {
  const { id } = await params;
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  const db = getDb();
  const play = await getOpenPlay(db, id);
  if (!play) notFound();
  if (!(await managesOpenPlay(me, id))) redirect(`/open-plays/${id}`);
  const [hosts, accounts, invites] = await Promise.all([
    listOpenPlayHosts(db, id),
    listAdmins(db),
    listOpenPlayInvites(db, id),
  ]);
  const taken = new Set(hosts.map((h) => h.id));

  return (
    <>
      <header className="flex flex-col gap-2">
        <RankChip play={play} />
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>👥</span> Hosts
        </h1>
        <p className="font-semibold text-ink/60">
          {whenLabel(play)}
          {venueLabel(play) && ` · ${venueLabel(play)}`}
        </p>
      </header>

      <section aria-labelledby="hosts-title" className={CARD}>
        <h2 id="hosts-title" className="mb-1 font-display text-xl font-bold">
          Running this open play
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Hosts see it on their open plays list and can register pairs, take
          payments, and run the courts. Admins can always help.
        </p>
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
                  ? "Created it"
                  : `Invited · ${ROLE_INFO[h.role].label}`}
              </span>
              {!h.owner && (
                <RemoveHost
                  openPlayId={id}
                  adminId={h.id}
                  username={h.username}
                />
              )}
            </li>
          ))}
          {hosts.length === 0 && (
            <li className="text-ink/50">No hosts yet. Invite one below.</li>
          )}
        </ul>
      </section>

      <section aria-labelledby="invite-title" className={CARD}>
        <h2 id="invite-title" className="mb-1 font-display text-xl font-bold">
          Invite a host
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Type a host&apos;s username, or anyone&apos;s email. No account yet?
          We email them an invitation to sign up as a host; once they verify
          their email, this open play is on their list.
        </p>
        <InviteHostForm
          openPlayId={id}
          usernames={accounts
            .filter((a) => a.verified && !taken.has(a.id))
            .map((a) => a.username)}
        />
        {invites.length > 0 && (
          <>
            <h3 className="mt-4 mb-2 font-display font-semibold">
              Waiting to sign up ({invites.length})
            </h3>
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
      </section>
    </>
  );
}
