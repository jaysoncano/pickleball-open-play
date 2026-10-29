import Link from "next/link";
import { logout, signOutPlayer } from "@/app/actions";
import { Brand } from "@/components/brand";
import { NavMenu } from "@/components/nav-menu";
import { currentAdmin, currentPlayer } from "@/lib/auth-server";
import { getDb } from "@/lib/db/client";
import { getPlayer, pendingProtestCount } from "@/lib/db/queries";

const LINK =
  "flex min-h-11 items-center gap-1.5 rounded-2xl px-3 font-display font-semibold text-ink/70 transition-colors hover:bg-fuchsia-50 hover:text-fuchsia-600";

/** Static part of the nav, also the fallback while admin status loads. */
export function SiteNavShell({ children }: { children?: React.ReactNode }) {
  return (
    <nav
      aria-label="Main"
      className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pt-4 print:hidden"
    >
      <Link href="/" aria-label="POP home" className="rounded-2xl">
        <Brand />
      </Link>
      <NavMenu>
        <Link href="/" className={LINK}>
          <span aria-hidden>🎾</span> Open plays
        </Link>
        <Link href="/players" className={LINK}>
          <span aria-hidden>🙌</span> Players
        </Link>
        {children}
      </NavMenu>
    </nav>
  );
}

export async function SiteNav() {
  const me = await currentAdmin();
  if (!me) {
    const me = await currentPlayer();
    const name = me && (await getPlayer(getDb(), me.playerId))?.name;
    return (
      <SiteNavShell>
        {me && name ? (
          <>
            <Link href={`/players/${me.playerId}`} className={LINK}>
              <span aria-hidden>🙂</span> {name}
            </Link>
            <form action={signOutPlayer}>
              <button type="submit" className={`${LINK} w-full`}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className={LINK}>
            <span aria-hidden>👤</span> Sign in
          </Link>
        )}
        <Link href="/host/login" className={LINK}>
          <span aria-hidden>🏓</span> Host
        </Link>
        <Link href="/admin/login" className={LINK}>
          <span aria-hidden>🔑</span> Admin
        </Link>
      </SiteNavShell>
    );
  }
  // Hosts run their own open plays; levels and protests are for admins.
  const pending = me.role === "admin" ? await pendingProtestCount(getDb()) : 0;
  return (
    <SiteNavShell>
      <Link href="/host" className={LINK}>
        <span aria-hidden>🏓</span> My open plays
      </Link>
      {me.role === "admin" && (
        <Link href="/admin/protests" className={LINK}>
          <span aria-hidden>📣</span> Protests
          {pending > 0 && (
            <span className="min-w-6 rounded-full bg-fuchsia-500 px-1.5 text-center text-sm text-white tabular-nums">
              {pending}
            </span>
          )}
        </Link>
      )}
      <Link href="/admin/players" className={LINK}>
        <span aria-hidden>🗂️</span> Player desk
      </Link>
      <Link href="/admin/settings" className={LINK}>
        <span aria-hidden>⚙️</span> Settings
      </Link>
      <form action={logout}>
        <button type="submit" className={`${LINK} w-full`}>
          Sign out
        </button>
      </form>
    </SiteNavShell>
  );
}
