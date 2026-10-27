import Link from "next/link";
import { OpenPlayCard } from "@/components/open-plays/open-play-card";
import { RemoveOpenPlay } from "@/components/open-plays/remove-open-play";
import type { OpenPlay } from "@/lib/db/queries";
import { dateInput } from "@/lib/queue/time";

export const BUTTON =
  "inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold";

/**
 * From yesterday, so a late-night open play doesn't vanish at midnight
 * when the server's clock is in another time zone.
 */
export function sinceYesterday(): string {
  return dateInput(Date.now() - 24 * 60 * 60 * 1000);
}

const dayLabel = new Intl.DateTimeFormat("en", {
  dateStyle: "full",
  timeZone: "UTC",
});

/** Open plays grouped by date, in the order given. */
function byDate(plays: OpenPlay[]): [string, OpenPlay[]][] {
  const days = new Map<string, OpenPlay[]>();
  for (const p of plays)
    days.set(p.playDate, [...(days.get(p.playDate) ?? []), p]);
  return [...days.entries()];
}

/**
 * A titled list of open plays by date. With `manage`, each card gets its
 * hosts' buttons: Register pairs, Manage, and Remove while it's empty.
 */
export function PlaySection({
  title,
  emoji,
  plays,
  manage = false,
  empty,
}: {
  title: string;
  emoji: string;
  plays: OpenPlay[];
  manage?: boolean;
  empty?: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-display text-2xl font-bold">
        <span aria-hidden>{emoji}</span> {title}
      </h2>
      {plays.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          {empty}
        </p>
      ) : (
        byDate(plays).map(([date, day]) => (
          <div key={date} className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold text-ink/60">
              📅 {dayLabel.format(new Date(`${date}T00:00:00Z`))}
            </h3>
            <ul className="grid gap-4 md:grid-cols-2">
              {day.map((play) => (
                <li key={play.id}>
                  <OpenPlayCard play={play} href={`/open-plays/${play.id}`}>
                    {manage && <HostButtons play={play} />}
                  </OpenPlayCard>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function HostButtons({ play }: { play: OpenPlay }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/players?date=${play.playDate}&openPlay=${play.id}`}
        className={`${BUTTON} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
      >
        Register pairs
      </Link>
      <Link
        href={`/open-plays/${play.id}/manage`}
        className={`${BUTTON} ring-2 ${play.venue ? "ring-ink/10 hover:ring-fuchsia-300" : "bg-amber-100 text-amber-900 ring-amber-300"}`}
      >
        <span aria-hidden>{play.venue ? "⚙️" : "📍"}</span>
        &nbsp;{play.venue ? "Manage" : "Manage · add venue"}
      </Link>
      {play.pairCount === 0 && !play.live && <RemoveOpenPlay id={play.id} />}
    </div>
  );
}

/** Admin: the open plays they host, or every open play. */
export function ViewToggle({ all, path }: { all: boolean; path: string }) {
  const tab = (on: boolean) =>
    `inline-flex min-h-11 items-center rounded-xl px-4 font-display font-semibold ${on ? "bg-white text-fuchsia-700 shadow-sm" : "text-ink/60 hover:text-fuchsia-600"}`;
  return (
    <nav
      aria-label="Which open plays"
      className="flex rounded-2xl bg-ink/5 p-1"
    >
      <Link
        href={path}
        aria-current={all ? undefined : "page"}
        className={tab(!all)}
      >
        Mine
      </Link>
      <Link
        href={`${path}?view=all`}
        aria-current={all ? "page" : undefined}
        className={tab(all)}
      >
        All
      </Link>
    </nav>
  );
}
