import { LevelBadge } from "@/components/level-badge";
import { formatMinutes } from "@/lib/queue/time";
import type { PlayerRecord } from "@/lib/ranking/record";

export function RecordCard({ record }: { record: PlayerRecord }) {
  const tiles = [
    { label: "Games", value: record.games, tone: "bg-sky-100 text-sky-800" },
    {
      label: "Won – lost",
      value: `${record.wins} – ${record.losses}`,
      tone: "bg-lime-200 text-lime-900",
    },
    {
      label: "Win rate",
      value: `${record.winRate}%`,
      tone: "bg-fuchsia-100 text-fuchsia-800",
    },
    {
      label: "Point diff",
      value: record.pointDiff > 0 ? `+${record.pointDiff}` : record.pointDiff,
      tone: "bg-amber-100 text-amber-900",
    },
    {
      label: "Court time",
      value: formatMinutes(record.minutes),
      tone: "bg-violet-100 text-violet-800",
    },
  ];
  return (
    <section
      aria-label="Record"
      className="flex flex-col gap-4 rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label} className={`rounded-3xl p-3 ${t.tone}`}>
            <p className="text-xs font-bold tracking-wide uppercase opacity-70">
              {t.label}
            </p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {t.value}
            </p>
          </li>
        ))}
      </ul>
      {record.byOpponentLevel.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold tracking-wide text-ink/50 uppercase">
            Results by toughest opponent&apos;s level
          </h2>
          <ul className="flex flex-wrap gap-2">
            {record.byOpponentLevel.map((r) => (
              <li
                key={r.level}
                className="flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 text-sm font-semibold ring-2 ring-ink/5"
              >
                <LevelBadge level={r.level} />
                <span className="tabular-nums">
                  {r.wins}W – {r.losses}L
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
