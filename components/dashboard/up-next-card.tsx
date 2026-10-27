import { Avatar } from "@/components/ui/avatar";
import type { UpNext } from "@/lib/queue/engine";
import type { Player } from "@/lib/queue/schema";

export function UpNextCard({
  preview,
  players,
  capacity,
  likelyCourt,
  hasOpenCourt,
  readyCourts,
  timeWarning,
  onEditTime,
  onAddCourt,
}: {
  preview: UpNext;
  players: Record<string, Player>;
  capacity: number;
  likelyCourt?: string;
  hasOpenCourt: boolean;
  readyCourts: number;
  /** Waiting players likely to miss out before the end time. */
  timeWarning?: { count: number; unplayed: number; endLabel: string };
  onEditTime: () => void;
  onAddCourt: () => void;
}) {
  const hasNext = preview.next.length > 0;

  return (
    <section
      aria-labelledby="up-next-title"
      className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 p-5 text-white shadow-[0_20px_50px_-20px_rgba(162,28,175,0.6)]"
    >
      <span
        aria-hidden
        className="animate-float absolute -top-3 -right-2 text-6xl opacity-30 motion-reduce:animate-none"
      >
        🏓
      </span>
      <h2
        id="up-next-title"
        className="font-display text-sm font-bold tracking-widest uppercase opacity-85"
      >
        Up next
      </h2>

      {timeWarning && (
        <div
          role="status"
          className="mt-3 rounded-2xl bg-white p-3 text-sm font-semibold text-rose-700"
        >
          <p>
            ⚠️ {timeWarning.count} waiting player
            {timeWarning.count === 1 ? "" : "s"} may not get a game before{" "}
            {timeWarning.endLabel}
            {timeWarning.unplayed > 0 &&
              `, including ${timeWarning.unplayed} who ${timeWarning.unplayed === 1 ? "hasn't" : "haven't"} played yet`}
            .
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEditTime}
              className="min-h-10 rounded-full bg-rose-500 px-3 font-display font-semibold text-white hover:bg-rose-400"
            >
              ⏱ Add time
            </button>
            <button
              type="button"
              onClick={onAddCourt}
              className="min-h-10 rounded-full bg-rose-100 px-3 font-display font-semibold text-rose-700 hover:bg-rose-200"
            >
              ＋ Add a court
            </button>
          </div>
        </div>
      )}

      {readyCourts > 0 && (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-amber-950">
          <span aria-hidden>👉</span>
          {readyCourts} court{readyCourts === 1 ? " is" : "s are"} ready — tap
          Start game
        </p>
      )}

      {hasNext ? (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {preview.next.map((pid) => (
              <li
                key={pid}
                className="animate-pop-in flex min-w-0 items-center gap-2 rounded-2xl bg-white/20 p-2 backdrop-blur motion-reduce:animate-none"
              >
                <Avatar name={players[pid].name} size="md" />
                <span className="truncate font-display font-semibold">
                  {players[pid].name}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-white/85">
            {likelyCourt
              ? `Heads to the next court that frees up — likely ${likelyCourt}. Teams are mixed so players meet new partners and opponents.`
              : "Heads to the next court that frees up. Teams are mixed so players meet new partners and opponents."}
          </p>
        </>
      ) : (
        <p className="mt-2 font-display text-xl font-semibold">
          {preview.remainder.length > 0
            ? `${capacity - preview.remainder.length} more player${capacity - preview.remainder.length === 1 ? "" : "s"} needed for the next game`
            : hasOpenCourt
              ? "Courts are open — add players to start a game!"
              : "Everyone's on court. Finished players rejoin here."}
        </p>
      )}

      {preview.onDeck.length > 0 && (
        <div className="mt-4 border-t border-white/25 pt-3">
          <p className="text-xs font-bold tracking-widest uppercase opacity-75">
            On deck
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {preview.onDeck.map((group, g) => (
              <li key={group.join("|")} className="flex items-center gap-2">
                <span className="w-6 font-display text-sm font-bold opacity-75">
                  #{g + 2}
                </span>
                <span className="flex -space-x-2">
                  {group.map((pid) => (
                    <Avatar key={pid} name={players[pid].name} size="sm" />
                  ))}
                </span>
                <span className="min-w-0 truncate text-sm text-white/90">
                  {group.map((pid) => players[pid].name).join(", ")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
