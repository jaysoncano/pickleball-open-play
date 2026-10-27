import Link from "next/link";
import { Fragment } from "react";
import { courtTheme } from "@/components/court-theme";
import { Avatar } from "@/components/ui/avatar";
import { courtStatus, upNext } from "@/lib/queue/engine";
import type { QueueState } from "@/lib/queue/schema";
import { formatTimeLabel } from "@/lib/queue/time";
import { AutoRefresh } from "./auto-refresh";

const STATUS = {
  open: "Open",
  filling: "Filling",
  ready: "Up now",
  playing: "Playing",
  paused: "Paused",
} as const;

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

/** Read-only view of the running session for players. Refreshes itself. */
/** Each pair unit's players, so names link to real profiles. */
export type UnitMembers = Record<string, { id: string; name: string }[]>;

export function PublicBoard({
  session,
  members = {},
  heading,
}: {
  session: QueueState | null;
  members?: UnitMembers;
  /** Which open play this is, e.g. "Novice – Intermediate · Tue, Oct 27…". */
  heading?: string;
}) {
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <AutoRefresh seconds={30} />
        <span aria-hidden className="text-6xl">
          🏓
        </span>
        <h1 className="font-display text-3xl font-bold">
          No open play running
        </h1>
        <p className="text-ink/60">
          This page updates by itself when the host starts a session. Meanwhile,
          check out the{" "}
          <Link href="/players" className="font-bold text-fuchsia-600">
            players and their records
          </Link>
          .
        </p>
      </main>
    );
  }

  const cap = session.config.playersPerCourt;
  const { next, onDeck, remainder } = upNext(session);
  const name = (id: string) => session.players[id]?.name ?? "?";
  const later = [...onDeck.flat(), ...remainder];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:py-8">
      <AutoRefresh />
      {heading && (
        <p className="self-start rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-ink/70 ring-2 ring-white">
          <Link href="/" className="hover:text-fuchsia-600">
            ← Open plays
          </Link>{" "}
          · {heading}
        </p>
      )}
      <header className={`${CARD} flex flex-wrap items-baseline gap-x-3`}>
        <h1 className="font-display text-2xl font-bold">
          <span aria-hidden>🏓</span> Open play
        </h1>
        <span className="font-semibold text-ink/50">
          {formatTimeLabel(session.config.startTime)} –{" "}
          {formatTimeLabel(session.config.endTime)} · live, updates every 15s
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <ul className="grid gap-4 sm:grid-cols-2">
          {session.courts.map((court, i) => {
            const theme = courtTheme(i);
            const half = Math.ceil(court.playerIds.length / 2);
            return (
              <li
                key={court.id}
                className={`rounded-[2rem] p-4 ring-2 ${theme.card}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`rounded-xl px-2.5 py-0.5 font-display font-bold ${theme.badge}`}
                  >
                    {court.label}
                  </span>
                  <span className="text-sm font-bold text-ink/60">
                    {STATUS[courtStatus(court, cap)]}
                  </span>
                </div>
                {court.playerIds.length === 0 ? (
                  <p className="py-4 text-center text-ink/45">
                    Waiting for players
                  </p>
                ) : (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Names
                      ids={court.playerIds.slice(0, half)}
                      name={name}
                      members={members}
                    />
                    <span className="rounded-full bg-ink px-2 py-0.5 font-display text-xs font-bold text-white">
                      VS
                    </span>
                    <Names
                      ids={court.playerIds.slice(half)}
                      name={name}
                      members={members}
                      end
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="flex flex-col gap-5">
          <section aria-labelledby="next-title" className={CARD}>
            <h2
              id="next-title"
              className="mb-3 font-display text-2xl font-bold"
            >
              Up next
            </h2>
            {next.length ? (
              <Names ids={next} name={name} members={members} />
            ) : (
              <p className="text-ink/50">Not enough players waiting yet.</p>
            )}
          </section>
          <section aria-labelledby="queue-title" className={CARD}>
            <h2
              id="queue-title"
              className="mb-3 font-display text-2xl font-bold"
            >
              Queue{" "}
              <span className="text-base text-ink/50">
                {session.queue.length} waiting
              </span>
            </h2>
            {later.length ? (
              <ol className="flex flex-col gap-1.5">
                {later.map((id, i) => (
                  <li key={id} className="flex items-center gap-2">
                    <span className="w-6 text-right font-display font-bold text-ink/40 tabular-nums">
                      {next.length + i + 1}
                    </span>
                    <PlayerLink id={id} name={name(id)} team={members[id]} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink/50">Nobody else is waiting.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function Names({
  ids,
  name,
  members,
  end = false,
}: {
  ids: string[];
  name: (id: string) => string;
  members: UnitMembers;
  end?: boolean;
}) {
  return (
    <ul className={`flex min-w-0 flex-col gap-1 ${end ? "items-end" : ""}`}>
      {ids.map((id) => (
        <li key={id} className="max-w-full min-w-0">
          <PlayerLink
            id={id}
            name={name(id)}
            team={members[id]}
            reverse={end}
          />
        </li>
      ))}
    </ul>
  );
}

function PlayerLink({
  id,
  name,
  team,
  reverse = false,
}: {
  id: string;
  name: string;
  /** Set when this queue unit is a pair. */
  team?: { id: string; name: string }[];
  reverse?: boolean;
}) {
  if (team) {
    // A pair: link each player to their own profile.
    return (
      <span
        className={`flex min-w-0 flex-wrap items-center gap-x-1 ${reverse ? "flex-row-reverse" : ""}`}
      >
        {team.map((m, i) => (
          <Fragment key={m.id}>
            {i > 0 && <span className="text-ink/40">&</span>}
            <PersonLink id={m.id} name={m.name} reverse={reverse} />
          </Fragment>
        ))}
      </span>
    );
  }
  return <PersonLink id={id} name={name} reverse={reverse} />;
}

function PersonLink({
  id,
  name,
  reverse,
}: {
  id: string;
  name: string;
  reverse: boolean;
}) {
  return (
    <Link
      href={`/players/${id}`}
      className={`flex min-w-0 items-center gap-1.5 rounded-xl hover:text-fuchsia-600 ${reverse ? "flex-row-reverse" : ""}`}
    >
      <Avatar name={name} size="sm" />
      <span className="truncate font-bold">{name}</span>
    </Link>
  );
}
