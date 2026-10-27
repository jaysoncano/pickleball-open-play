export function StatsRow({
  total,
  playing,
  waiting,
  games,
  courts,
}: {
  total: number;
  playing: number;
  waiting: number;
  games: number;
  courts: number;
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

  return (
    <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
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
    </dl>
  );
}
