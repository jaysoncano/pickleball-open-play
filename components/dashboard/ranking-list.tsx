import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import { LEVELS } from "@/lib/ranking/levels";
import type { Standing } from "@/lib/ranking/standings";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * Pairs ranked best first: medals for the top three, both players, rank,
 * rating, W–L, and point difference. Shared by the host's Rankings tab
 * and the public board, so both read the same.
 */
export function RankingList({ rows }: { rows: Standing[] }) {
  return (
    <ol className="-m-1 flex flex-col gap-1.5 overflow-y-auto p-1">
      {rows.map((r) => (
        <li
          key={r.id}
          className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 rounded-2xl px-3 py-2 ring-2 ${r.rank <= 3 ? "bg-amber-50 ring-amber-200" : "bg-white ring-ink/5"}`}
        >
          <span className="text-center font-display text-lg font-bold tabular-nums">
            {MEDALS[r.rank - 1] ?? r.rank}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {r.name.split(" & ").map((person, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <Avatar name={person} size="sm" />
                <span className="font-bold">{person}</span>
              </span>
            ))}
            <LevelBadge level={LEVELS[r.skill ?? 0] ?? LEVELS[0]} size="sm" />
          </span>
          <span className="text-right text-sm tabular-nums">
            <span className="block font-bold">{r.rating.toFixed(2)}</span>
            <span className="text-xs font-semibold text-ink/50">
              {r.wins}–{r.losses} · {r.pointDiff > 0 ? "+" : ""}
              {r.pointDiff}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
