import type { GamesLeft } from "@/lib/queue/forecast";

export function StatsRow({
  total,
  playing,
  waiting,
  games,
  courts,
  estimate,
}: {
  total: number;
  playing: number;
  waiting: number;
  games: number;
  courts: number;
  /** Games that still fit before the end, and about how many each. */
  estimate?: GamesLeft;
}) {
  const tiles = [
    { label: "Players", value: total, tone: "bg-violet-100 text-violet-900" },
    { label: "On court", value: playing, tone: "bg-lime-100 text-lime-900" },
    { label: "Waiting", value: waiting, tone: "bg-amber-100 text-amber-900" },
    {
      label: courts === 1 ? "Court" : "Courts",
      value: courts,
      tone: "bg-sky-100 text-sky-900",
    },
    { label: "Games", value: games, tone: "bg-fuchsia-100 text-fuchsia-900" },
  ];
  const each = estimate?.each ?? 0;

  return (
    <dl
      className={`grid grid-cols-3 gap-2 sm:gap-3 ${estimate ? "sm:grid-cols-6" : "sm:grid-cols-5"}`}
    >
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={`rounded-3xl px-3 py-3 ring-2 ring-white sm:px-4 ${t.tone} ${i >= 3 ? "max-sm:hidden" : ""}`}
        >
          <dt className="text-xs font-bold tracking-wide uppercase opacity-70">
            {t.label}
          </dt>
          <dd className="font-display text-3xl font-bold">{t.value}</dd>
        </div>
      ))}
      {estimate && (
        <div
          title="Estimate from the average game length and the time left"
          className="col-span-3 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-violet-500 px-3 py-3 text-white ring-2 ring-white sm:col-span-1 sm:px-4"
        >
          <dt className="text-xs font-bold tracking-wide uppercase opacity-80">
            Games left (est.)
          </dt>
          <dd className="flex items-baseline gap-2 sm:block">
            <span className="font-display text-3xl font-bold tabular-nums">
              ~{estimate.games}
            </span>
            <span className="block text-xs font-semibold opacity-90">
              {estimate.games === 0
                ? "No time for another game"
                : `≈ ${each} more game${each === 1 ? "" : "s"} each`}
            </span>
          </dd>
        </div>
      )}
    </dl>
  );
}
