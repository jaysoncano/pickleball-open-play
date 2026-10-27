import Link from "next/link";
import type { ReactNode } from "react";
import type { OpenPlay } from "@/lib/db/queries";
import { ranksLabel, spotsLeft, whenLabel } from "@/lib/registration/open-play";
import { LEVEL_INFO, LEVELS } from "@/lib/ranking/levels";
import { initials } from "@/lib/banner";
import { logoUrl } from "@/lib/roles";
import { PlayBanner } from "./play-banner";

/** The open play's ranks: one colored chip per level, or "All levels". */
export function RankChip({ play }: { play: Pick<OpenPlay, "levels"> }) {
  if (play.levels.length === LEVELS.length) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-800">
        <span aria-hidden>🏅</span> {ranksLabel(play)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex flex-wrap items-center gap-1"
      aria-label={`Ranks: ${ranksLabel(play)}`}
    >
      <span aria-hidden>🏅</span>
      {play.levels.map((l) => (
        <span
          key={l}
          className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${LEVEL_INFO[l].tone}`}
        >
          {LEVEL_INFO[l].label}
        </span>
      ))}
    </span>
  );
}

/**
 * The hosting group's logo; without one, its initials (when named) or a
 * paddle.
 */
export function GroupLogo({
  play,
  size = "size-10",
}: {
  play: Pick<OpenPlay, "createdBy" | "groupLogoUpdatedAt" | "groupName">;
  size?: string;
}) {
  const src = play.createdBy
    ? logoUrl(play.createdBy, play.groupLogoUpdatedAt)
    : null;
  const letters = initials(play.groupName);
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-100 to-sky-100 font-display font-bold text-fuchsia-700 ring-4 ring-white`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{letters || "🏓"}</span>
      )}
    </span>
  );
}

/** "Hosted by {group}" linking to its public page, or a POP placeholder. */
export function HostedBy({ play }: { play: OpenPlay }) {
  if (!play.groupName) {
    return <span className="text-ink/50">POP open play</span>;
  }
  return (
    <span>
      <span className="text-ink/50">Hosted by </span>
      {play.createdBy ? (
        // Above a card's stretched link, so it stays tappable.
        <Link
          href={`/groups/${play.createdBy}`}
          className="relative z-10 text-fuchsia-700 underline-offset-2 hover:underline"
        >
          {play.groupName}
        </Link>
      ) : (
        play.groupName
      )}
    </span>
  );
}

/** Court venue and location: where players need to go. */
export function PlayVenue({ play }: { play: OpenPlay }) {
  if (!play.venue) {
    return (
      <p className="text-sm font-semibold text-amber-700">
        <span aria-hidden>📍</span> Venue to be announced
      </p>
    );
  }
  return (
    <div className="min-w-0">
      <p className="truncate font-display text-lg font-bold">
        <span aria-hidden>📍</span> {play.venue}
      </p>
      {play.location && (
        <p className="truncate pl-6 text-sm font-semibold text-ink/60">
          {play.location}
        </p>
      )}
    </div>
  );
}

/** The banner with the group's logo and name over its bottom edge. */
export function PlayHeader({
  play,
  banner,
  logo = "size-14",
  children,
}: {
  play: OpenPlay;
  /** Banner height classes. */
  banner?: string;
  logo?: string;
  /** Chips on the banner's top edge. */
  children?: ReactNode;
}) {
  return (
    <>
      <PlayBanner play={play} className={banner}>
        {children && (
          <div className="flex flex-wrap items-start justify-between gap-2 p-3">
            {children}
          </div>
        )}
      </PlayBanner>
      <div className="relative -mt-7 flex items-end gap-3 px-4 sm:px-5">
        <GroupLogo play={play} size={logo} />
        <p className="min-w-0 truncate pb-1 font-display font-semibold">
          <HostedBy play={play} />
        </p>
      </div>
    </>
  );
}

/** One open play: rank, when, how full, and whether it's live. */
export function OpenPlayCard({
  play,
  href,
  children,
}: {
  play: OpenPlay;
  /** Where the card goes when tapped. */
  href: string;
  /** Extra actions (admin): they sit above the card's link. */
  children?: ReactNode;
}) {
  const left = spotsLeft(play.maxPairs, play.pairCount);
  return (
    // The whole card is the link: the title's link stretches over it, and
    // any actions are lifted above so they stay tappable.
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-white/90 ring-2 ring-white backdrop-blur transition-all hover:-translate-y-0.5 hover:ring-fuchsia-300 hover:shadow-[0_16px_40px_-20px_rgba(36,28,71,0.4)] has-[a:focus-visible]:ring-4 has-[a:focus-visible]:ring-sky-400">
      <PlayHeader play={play}>
        <span className="rounded-full bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
          <RankChip play={play} />
        </span>
        {play.live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-sm font-bold text-white shadow-sm">
            <span
              aria-hidden
              className="size-2 animate-pulse rounded-full bg-white"
            />
            Live now
          </span>
        ) : (
          left === 0 && (
            <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-ink/60 shadow-sm">
              Full
            </span>
          )
        )}
      </PlayHeader>
      <div className="flex flex-1 flex-col gap-2 p-4 pt-2 sm:px-5 sm:pb-5">
        <Link
          href={href}
          className="flex items-center justify-between gap-2 font-display text-2xl font-bold outline-none group-hover:text-fuchsia-600 after:absolute after:inset-0 after:rounded-[2rem]"
        >
          {whenLabel(play)}
          <span
            aria-hidden
            className="text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-fuchsia-500"
          >
            →
          </span>
        </Link>
        <PlayVenue play={play} />
        <p className="text-sm font-semibold text-ink/60">
          <span className="tabular-nums">{play.pairCount}</span> pair
          {play.pairCount === 1 ? "" : "s"} signed up
          {play.maxPairs !== null && (
            <>
              {" "}
              of {play.maxPairs} ·{" "}
              <span className={left ? "text-lime-700" : "text-rose-600"}>
                {left
                  ? `${left} spot${left === 1 ? "" : "s"} left`
                  : "no spots left"}
              </span>
            </>
          )}
        </p>
        {children && <div className="relative z-10 mt-auto">{children}</div>}
      </div>
    </article>
  );
}
