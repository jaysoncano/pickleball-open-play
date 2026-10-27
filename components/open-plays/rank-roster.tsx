import Link from "next/link";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { DayMember, DayPair, PendingPair } from "@/lib/db/queries";
import { photoUrl } from "@/lib/profile/forms";
import { LEVEL_INFO, type Level } from "@/lib/ranking/levels";

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

function Person({ m }: { m: DayMember }) {
  return (
    <Link
      href={`/players/${m.playerId}`}
      className="flex min-w-0 items-center gap-2 rounded-xl hover:text-fuchsia-600"
    >
      <Avatar
        name={m.name}
        src={photoUrl(m.playerId, m.photoUpdatedAt)}
        size="md"
      />
      <span className="min-w-0">
        <span className="block truncate font-bold">{m.name}</span>
        {m.fullName && (
          <span className="block truncate text-xs font-semibold text-ink/50">
            {m.fullName}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Who joined one rank: its pairs, and solo players at that level. */
export function RankRoster({
  level,
  pairs,
  pending = [],
  solos,
}: {
  level: Level;
  pairs: DayPair[];
  /** Signed up online, waiting for the admin to confirm payment. */
  pending?: PendingPair[];
  solos: DayMember[];
}) {
  return (
    <section aria-labelledby="roster-title" className={CARD}>
      <h2
        id="roster-title"
        className="mb-3 flex flex-wrap items-center gap-2 font-display text-2xl font-bold"
      >
        <LevelBadge level={level} /> {pairs.length} pair
        {pairs.length === 1 ? "" : "s"} joined
      </h2>
      {pairs.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          No {LEVEL_INFO[level].label} pairs yet. Be the first!
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {pairs.map((p, i) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
            >
              <span className="w-6 text-right font-display font-bold text-ink/40 tabular-nums">
                {i + 1}
              </span>
              <span className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                {p.members.map((m) => (
                  <Person key={m.playerId} m={m} />
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}
      {pending.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-ink/50 uppercase">
            ⏳ Awaiting payment
          </h3>
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="grid gap-2 rounded-2xl bg-amber-50 px-3 py-2 sm:grid-cols-2"
              >
                {p.members.map((m) => (
                  <Person key={m.playerId} m={m} />
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
      {solos.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold tracking-wide text-ink/50 uppercase">
            🤝 Looking for a partner
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {solos.map((m) => (
              <li key={m.playerId} className="rounded-2xl bg-white px-3 py-2">
                <Person m={m} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
