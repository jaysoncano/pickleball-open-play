"use client";

import { LevelBadge } from "@/components/level-badge";
import { CourtView } from "@/components/dashboard/court-card";
import { QueueView } from "@/components/dashboard/queue-list";
import { UpNextCard } from "@/components/dashboard/up-next-card";
import { stats, upNext } from "@/lib/queue/engine";
import { forecast } from "@/lib/queue/forecast";
import type { QueueState } from "@/lib/queue/schema";
import { LEVELS } from "@/lib/ranking/levels";
import { skillsOnCourt } from "@/lib/registration/roster";
import { useNow } from "@/lib/use-now";

/** Each pair unit's players, so names link to real profiles. */
type Teams = Record<string, { id: string; name: string }[]>;

/**
 * The public board's Courts tab: the host's court view, watch only.
 * Same court cards (live clocks), Up next, and queue, with every button
 * left out. The page refreshes the session; the clocks tick here.
 */
export function PublicCourts({
  session,
  teams,
  link,
}: {
  session: QueueState;
  teams: Teams;
  /** Ranked players have profile pages; Regular guests don't. */
  link: boolean;
}) {
  const now = useNow();
  const cap = session.config.playersPerCourt;
  const preview = upNext(session);
  const summary = stats(session);
  const startsIn = now ? forecast(session, now).startsIn : {};
  const playing = skillsOnCourt(session).flatMap((s) => LEVELS[s] ?? []);
  const likelyCourt = session.courts
    .filter((c) => c.startedAt !== null)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0]?.label;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
      <section aria-labelledby="courts-title" className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="courts-title" className="font-display text-2xl font-bold">
            Courts
          </h2>
          {playing.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 rounded-full bg-white/80 py-1 pr-1.5 pl-3 text-sm font-semibold text-ink/60 ring-2 ring-white">
              Ranks playing now
              {playing.map((level) => (
                <LevelBadge key={level} level={level} size="sm" />
              ))}
            </p>
          )}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {session.courts.map((court, i) => (
            <li key={court.id}>
              <CourtView
                court={court}
                colorIndex={i}
                capacity={cap}
                players={session.players}
                now={now}
                teams={teams}
                link={link}
              />
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-5">
        <UpNextCard
          preview={preview}
          players={session.players}
          capacity={cap}
          likelyCourt={likelyCourt}
          hasOpenCourt={summary.openCourts > 0}
          readyCourts={summary.readyCourts}
          readOnly
        />
        <section
          aria-labelledby="queue-title"
          className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
        >
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="queue-title" className="font-display text-2xl font-bold">
              Queue
            </h2>
            <span className="text-sm font-semibold text-ink/50">
              {session.queue.length} waiting
            </span>
          </div>
          <QueueView
            queue={session.queue}
            players={session.players}
            capacity={cap}
            startsIn={startsIn}
          />
        </section>
      </aside>
    </div>
  );
}
