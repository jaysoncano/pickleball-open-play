import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AddAdminForm,
  ChangePasswordForm,
  GroupForm,
  RemoveAdmin,
  RoleSelect,
} from "@/components/admin/account-forms";
import { Loading } from "@/components/loading";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { getAdmin, listAdmins } from "@/lib/db/queries";
import { logoUrl, ROLE_INFO } from "@/lib/roles";

export const metadata: Metadata = { title: "Settings" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header>
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>⚙️</span> Settings
        </h1>
        <p className="text-ink/60">
          Admins control everything. Hosts schedule and run their own open
          plays, and ones they&apos;re invited to.
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <Settings />
      </Suspense>
    </main>
  );
}

const joined = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

async function Settings() {
  const me = await currentAdmin();
  if (!me) redirect("/admin/login");
  const db = getDb();
  const [admins, account] = await Promise.all([
    me.role === "admin" ? listAdmins(db) : [],
    getAdmin(db, me.id),
  ]);
  const adminCount = admins.filter((a) => a.role === "admin").length;
  return (
    <>
      <section aria-labelledby="group-title" className={CARD}>
        <h2 id="group-title" className="font-display text-xl font-bold">
          <span aria-hidden>🏓</span> Your group
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Your open plays are hosted under this name and logo
          {account?.groupName ? "." : ". Add it before scheduling one."}
        </p>
        <GroupForm
          groupName={account?.groupName ?? ""}
          logo={account ? logoUrl(account.id, account.logoUpdatedAt) : null}
        />
      </section>

      <section aria-labelledby="me-title" className={CARD}>
        <h2 id="me-title" className="font-display text-xl font-bold">
          Your account · <span className="text-fuchsia-600">{me.username}</span>
          <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 align-middle text-sm text-violet-800">
            {ROLE_INFO[me.role].label}
          </span>
        </h2>
        <p className="mb-3 text-sm text-ink/60">
          Changing your password signs out your other devices.
        </p>
        <ChangePasswordForm />
      </section>

      {me.role === "admin" && (
        <section aria-labelledby="admins-title" className={CARD}>
          <h2 id="admins-title" className="mb-1 font-display text-xl font-bold">
            Accounts ({admins.length})
          </h2>
          <p className="mb-3 text-sm text-ink/60">
            Hosts can sign up themselves at <b>/host/signup</b> (email verified
            with a code), or you can add them here. Hosts invite each other from
            an open play&apos;s Hosts page.
          </p>
          <ul className="mb-4 flex flex-col gap-1.5">
            {admins.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1 font-bold">
                  {a.username}
                  <span className="block truncate text-xs font-semibold text-ink/50">
                    {[a.groupName, a.email].filter(Boolean).join(" · ") ||
                      "No group yet"}
                    {!a.verified && (
                      <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-900">
                        email not verified
                      </span>
                    )}
                  </span>
                  {a.id === me.id && (
                    <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-px text-xs text-fuchsia-800">
                      you
                    </span>
                  )}
                </span>
                <span className="text-sm font-semibold text-ink/45">
                  since {joined.format(a.createdAt)}
                </span>
                {a.id === me.id ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-sm font-semibold text-violet-800">
                    {ROLE_INFO[a.role].label}
                  </span>
                ) : (
                  <RoleSelect id={a.id} username={a.username} role={a.role} />
                )}
                {a.id !== me.id && (a.role === "host" || adminCount > 1) && (
                  <RemoveAdmin id={a.id} username={a.username} />
                )}
              </li>
            ))}
          </ul>
          <h3 className="mb-2 font-display font-semibold">Add an account</h3>
          <AddAdminForm />
        </section>
      )}
    </>
  );
}
