import Link from "next/link";
import type { ReactNode } from "react";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import type { PlayerProfile } from "@/lib/db/queries";
import { HAND_LABEL, photoUrl } from "@/lib/profile/forms";
import { formatMinutes } from "@/lib/queue/time";
import type { Rank } from "@/lib/ranking/rank";
import type { PlayerRecord } from "@/lib/ranking/record";

const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/**
 * A player's public card: photo, name, level, ranking, and record. Email
 * and phone never appear here.
 */
export function ProfileCard({
  player,
  record,
  rank,
  actions,
}: {
  player: PlayerProfile;
  record: PlayerRecord;
  rank: Rank | undefined;
  /** Admin or owner controls, shown under the name. */
  actions?: ReactNode;
}) {
  const tiles = [
    { label: "Matches", value: record.games, tone: "bg-sky-100 text-sky-800" },
    { label: "Wins", value: record.wins, tone: "bg-lime-200 text-lime-900" },
    {
      label: "Losses",
      value: record.losses,
      tone: "bg-rose-100 text-rose-800",
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
  const facts = [
    player.homeClub && { icon: "📍", text: player.homeClub },
    player.hand && { icon: "🏓", text: HAND_LABEL[player.hand] },
    { icon: "📅", text: `Playing since ${dateLabel.format(player.createdAt)}` },
  ].filter((f): f is { icon: string; text: string } => Boolean(f));

  return (
    <section
      aria-label={`${player.fullName || player.name}'s profile`}
      className="overflow-hidden rounded-[2rem] bg-white/80 ring-2 ring-white backdrop-blur"
    >
      <div className="bg-gradient-to-r from-fuchsia-200 via-sky-200 to-lime-200 px-4 pt-4 pb-14 sm:px-6">
        <div className="flex justify-end">
          <RankBadge rank={rank} />
        </div>
      </div>
      <div className="-mt-12 flex flex-col gap-4 px-4 pb-5 sm:px-6">
        <div className="flex flex-wrap items-end gap-4">
          <Avatar
            name={player.name}
            src={photoUrl(player.id, player.photoUpdatedAt)}
            size="xl"
            className="ring-4"
          />
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="font-display text-3xl leading-tight font-bold break-words">
              {player.fullName || player.name}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink/55">
              {player.fullName && player.fullName !== player.name && (
                <span>“{player.name}”</span>
              )}
              <LevelBadge level={player.level} />
            </p>
          </div>
        </div>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink/60">
          {facts.map((f) => (
            <li key={f.text}>
              <span aria-hidden>{f.icon}</span> {f.text}
            </li>
          ))}
        </ul>
        {player.bio && (
          <p className="rounded-2xl bg-sky-50 px-4 py-3 text-ink/75">
            {player.bio}
          </p>
        )}

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
        {actions}
      </div>
    </section>
  );
}

function RankBadge({ rank }: { rank: Rank | undefined }) {
  if (!rank) {
    return (
      <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-ink/50">
        Unranked
      </span>
    );
  }
  return (
    <Link
      href="/players"
      className="rounded-full bg-white px-3 py-1 font-display font-bold text-ink shadow-sm"
    >
      <span className="sr-only">Ranked </span>
      <span aria-hidden>🏆</span> #{rank.rank}{" "}
      <span className="text-sm font-semibold text-ink/50">of {rank.of}</span>
    </Link>
  );
}
