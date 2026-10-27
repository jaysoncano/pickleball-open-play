import Link from "next/link";
import { courtTheme } from "@/components/court-theme";
import { LevelBadge } from "@/components/level-badge";
import { courtNumber } from "@/lib/queue/history";
import { formatMinutes } from "@/lib/queue/time";
import type { MatchPlayer, PlayerGame } from "@/lib/ranking/record";

const when = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A player's games, newest first, with everyone's level at the time. */
export function MatchList({ games }: { games: PlayerGame[] }) {
  if (games.length === 0) {
    return (
      <p className="rounded-3xl border-2 border-dashed border-ink/15 p-5 text-center text-ink/50">
        No recorded matches yet. 🏓
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {games.map((g) => {
        const m = g.match;
        const theme = courtTheme(courtNumber(m.courtLabel) - 1);
        const minutes = Math.max(
          1,
          Math.round((m.endedAt - m.startedAt) / 60_000),
        );
        return (
          <li
            key={m.id}
            className={`flex flex-col gap-2 rounded-3xl p-3 ring-2 ${theme.card}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink/60">
              <span
                className={`rounded-full px-2.5 py-0.5 font-display font-bold ${g.won ? "bg-lime-500 text-lime-950" : "bg-rose-200 text-rose-800"}`}
              >
                {g.won ? "Won" : "Lost"} {g.pointsFor}–{g.pointsAgainst}
              </span>
              <span
                className={`rounded-xl px-2 py-0.5 font-display font-bold ${theme.badge}`}
              >
                {m.courtLabel}
              </span>
              <span>⏱ {formatMinutes(minutes)}</span>
              <span className="ml-auto">{when.format(m.startedAt)}</span>
            </div>
            <div className="grid gap-1 text-sm sm:grid-cols-2">
              <People label="With" people={g.partners} empty="Singles" />
              <People label="Against" people={g.opponents} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function People({
  label,
  people,
  empty = "—",
}: {
  label: string;
  people: MatchPlayer[];
  empty?: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      <span className="font-bold text-ink/45">{label}</span>
      {people.length === 0 ? (
        <span className="text-ink/50">{empty}</span>
      ) : (
        people.map((p) => (
          <Link
            key={p.playerId}
            href={`/players/${p.playerId}`}
            className="flex items-center gap-1 rounded-full bg-white py-0.5 pr-1 pl-2 font-semibold hover:text-fuchsia-600"
          >
            {p.name}
            <LevelBadge level={p.level} size="sm" />
          </Link>
        ))
      )}
    </p>
  );
}
