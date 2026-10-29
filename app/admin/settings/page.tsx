import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  AddAdminForm,
  ChangePasswordForm,
  GroupForm,
  RemoveAdmin,
  RoleSelect,
  StartPassword,
} from "@/components/admin/account-forms";
import { Loading } from "@/components/loading";
import { currentAdmin } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import {
  getAdmin,
  listAdmins,
  listCreatedAccounts,
  listOpenPlays,
} from "@/lib/db/queries";
import { whenLabel } from "@/lib/registration/open-play";
import { NewCoHostForm } from "@/components/open-plays/host-forms";
import { logoUrl, ROLE_INFO } from "@/lib/roles";

export const metadata: Metadata = { title: "Settings" };

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6";

const TABS = {
  group: { emoji: "🏓", label: "Group", admin: false },
  account: { emoji: "🔑", label: "Account", admin: false },
  accounts: { emoji: "👥", label: "Accounts", admin: false },
  add: { emoji: "➕", label: "Add account", admin: false },
} as const;
type Tab = keyof typeof TABS;

export default function SettingsPage({
  searchParams,
}: PageProps<"/admin/settings">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <header className="mx-auto w-full max-w-2xl">
        <h1 className="font-display text-3xl font-bold">
          <span aria-hidden>⚙️</span> Settings
        </h1>
        <p className="text-ink/60">
          Admins control everything. Hosts schedule and run their own open
          plays, and ones they&apos;re invited to.
        </p>
      </header>
      <Suspense fallback={<Loading />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const joined = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

async function Settings({
  searchParams,
}: Pick<PageProps<"/admin/settings">, "searchParams">) {
  const me = await currentAdmin();
  if (!me) redirect("/host/login");
  const admin = me.role === "admin";
  // Hosts only get their own tabs; admin tabs aren't even rendered.
  const tabs = (Object.keys(TABS) as Tab[]).filter(
    (t) => admin || !TABS[t].admin,
  );
  const asked = (await searchParams).tab;
  const tab: Tab = tabs.find((t) => t === asked) ?? "group";
  const db = getDb();
  // Admins see every account; hosts, the ones they made.
  const [admins, account, managed] = await Promise.all([
    me.role === "admin" ? listAdmins(db) : listCreatedAccounts(db, me.id),
    getAdmin(db, me.id),
    admin ? [] : listOpenPlays(db, { managedBy: me.id }),
  ]);
  // Hosts add co-host accounts to open plays they made (and aren't over).
  const mine = managed
    .filter((p) => p.createdBy === me.id && !p.ended)
    .map((p) => ({
      id: p.id,
      label: [whenLabel(p), p.venue].filter(Boolean).join(" · "),
    }));
  const adminCount = admins.filter((a) => a.role === "admin").length;
  // The accounts table gets the room; forms stay a readable width.
  const narrow = "mx-auto w-full max-w-2xl";
  return (
    <>
      <nav
        aria-label="Settings"
        className={`${narrow} grid grid-cols-2 gap-1.5 rounded-2xl bg-white/80 p-1.5 ring-2 ring-white sm:grid-cols-4`}
      >
        {tabs.map((t) => (
          <Link
            key={t}
            href={
              t === "group" ? "/admin/settings" : `/admin/settings?tab=${t}`
            }
            aria-current={tab === t ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 font-display font-semibold whitespace-nowrap transition-colors ${tab === t ? "bg-fuchsia-500 text-white shadow-[0_3px_0_0_#a21caf]" : "text-ink/60 hover:bg-fuchsia-50 hover:text-fuchsia-600"}`}
          >
            <span aria-hidden>{TABS[t].emoji}</span>
            {TABS[t].label}
            {t === "accounts" && (
              <span
                className={`min-w-6 rounded-full px-1.5 text-center text-sm tabular-nums ${tab === t ? "bg-white/25" : "bg-ink/5"}`}
              >
                {admins.length}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "group" && (
        <section aria-labelledby="group-title" className={`${narrow} ${CARD}`}>
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
      )}

      {tab === "account" && (
        <section aria-labelledby="me-title" className={`${narrow} ${CARD}`}>
          <h2 id="me-title" className="font-display text-xl font-bold">
            Your account ·{" "}
            <span className="text-fuchsia-600">{me.username}</span>
            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 align-middle text-sm text-violet-800">
              {ROLE_INFO[me.role].label}
            </span>
          </h2>
          <p className="mb-3 text-sm text-ink/60">
            Changing your password signs out your other devices.
          </p>
          <ChangePasswordForm />
        </section>
      )}

      {tab === "accounts" && (
        <section aria-labelledby="admins-title" className={CARD}>
          <h2 id="admins-title" className="mb-1 font-display text-xl font-bold">
            {admin ? "All accounts" : "Accounts you made"} ({admins.length})
          </h2>
          <p className="mb-3 text-sm text-ink/60">
            {admin ? (
              <>
                Hosts can sign up themselves at <b>/host/signup</b>, or you can
                add them in <b>Add account</b>.{" "}
              </>
            ) : (
              "Co-host accounts you made from an open play's Hosts page. "
            )}
            You can show the password you set for accounts you made, until they
            change it.
          </p>
          {admins.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-ink/15 p-5 text-center text-sm text-ink/55">
              None yet. Make one from an open play&apos;s ⚙️ Manage → Hosts.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white ring-2 ring-ink/5">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead className="text-[11px] font-bold tracking-wide text-ink/50 uppercase">
                  <tr className="border-b-2 border-ink/5">
                    <th scope="col" className="px-3 py-2">
                      Username
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Password
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Level
                    </th>
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => {
                    const mine = a.createdBy === me.id;
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-ink/5 align-middle"
                      >
                        <td className="px-3 py-2">
                          <span className="font-bold whitespace-nowrap">
                            {a.username}
                          </span>
                          {a.id === me.id && (
                            <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-px text-xs text-fuchsia-800">
                              you
                            </span>
                          )}
                          <span className="block text-xs font-semibold whitespace-nowrap text-ink/45">
                            {a.groupName || "No group yet"}
                          </span>
                          <span className="block text-xs whitespace-nowrap text-ink/40">
                            since {joined.format(a.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ink/70">
                          {a.email ? (
                            <span
                              title={a.email}
                              className="block max-w-60 truncate"
                            >
                              {a.email}
                            </span>
                          ) : (
                            <span className="text-ink/30">—</span>
                          )}
                          {!a.verified && (
                            <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-1.5 text-xs whitespace-nowrap text-amber-900">
                              not verified
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {mine ? (
                            <StartPassword
                              id={a.id}
                              username={a.username}
                              canShow={a.hasStartPassword}
                            />
                          ) : (
                            <span className="text-xs text-ink/30">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {admin && a.id !== me.id ? (
                            <RoleSelect
                              id={a.id}
                              username={a.username}
                              role={a.role}
                            />
                          ) : (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                              {ROLE_INFO[a.role].label}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {admin &&
                            a.id !== me.id &&
                            (a.role === "host" || adminCount > 1) && (
                              <RemoveAdmin id={a.id} username={a.username} />
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "add" && (
        <section aria-labelledby="add-title" className={`${narrow} ${CARD}`}>
          <h2 id="add-title" className="mb-1 font-display text-xl font-bold">
            <span aria-hidden>➕</span> Add an account
          </h2>
          {admin ? (
            <>
              <p className="mb-3 text-sm text-ink/60">
                Pick the level, then share the username and password with them.
              </p>
              <AddAdminForm />
            </>
          ) : mine.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-ink/15 p-5 text-center text-sm text-ink/55">
              Schedule an open play first: accounts you make here co-host one of
              yours.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink/60">
                A co-host account for one of your open plays: they can sign in
                right away and help run only that one. It shows in Accounts,
                where you can see the password you set.
              </p>
              <NewCoHostForm openPlays={mine} />
            </>
          )}
        </section>
      )}
    </>
  );
}
