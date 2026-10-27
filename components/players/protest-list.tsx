import { LevelBadge } from "@/components/level-badge";
import type { ProtestStatus } from "@/lib/ranking/forms";
import type { Level } from "@/lib/ranking/levels";

const STATUS: Record<ProtestStatus, { label: string; tone: string }> = {
  pending: { label: "Waiting", tone: "bg-amber-100 text-amber-900" },
  approved: { label: "Approved", tone: "bg-lime-200 text-lime-900" },
  rejected: { label: "Rejected", tone: "bg-rose-100 text-rose-700" },
};

const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export type ProtestRow = {
  id: string;
  currentLevel: Level;
  requestedLevel: Level;
  reason: string;
  status: ProtestStatus;
  adminNote: string;
  createdAt: Date;
};

/** Past and pending protests for one player. */
export function ProtestList({ protests }: { protests: ProtestRow[] }) {
  if (protests.length === 0) return null;
  return (
    <ol className="mt-4 flex flex-col gap-2 border-t border-ink/5 pt-4">
      {protests.map((p) => (
        <li key={p.id} className="rounded-2xl bg-white p-3 text-sm">
          <span className="flex flex-wrap items-center gap-1.5">
            <LevelBadge level={p.currentLevel} size="sm" />→
            <LevelBadge level={p.requestedLevel} size="sm" />
            <span
              className={`rounded-full px-2 text-xs font-bold ${STATUS[p.status].tone}`}
            >
              {STATUS[p.status].label}
            </span>
            <span className="ml-auto font-semibold text-ink/45">
              {dateLabel.format(p.createdAt)}
            </span>
          </span>
          <p className="mt-1 text-ink/70">“{p.reason}”</p>
          {p.adminNote && (
            <p className="mt-1 font-semibold text-ink/55">
              Admin: {p.adminNote}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
