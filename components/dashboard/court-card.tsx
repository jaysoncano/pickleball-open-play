import { courtTheme } from "@/components/court-theme";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { courtStatus } from "@/lib/queue/engine";
import type { Court, Player } from "@/lib/queue/schema";
import { formatClock } from "@/lib/queue/time";
import { LEVEL_INFO, LEVELS, type Level } from "@/lib/ranking/levels";

const STATUS_LABEL = {
  open: "Open",
  filling: "Filling",
  ready: "Ready",
  playing: "Playing",
  paused: "Paused",
} as const;

const PRIMARY =
  "min-h-12 rounded-2xl bg-lime-400 font-display text-lg font-semibold text-lime-950 shadow-[0_4px_0_0_#4d7c0f] ring-4 ring-lime-200 transition-all hover:bg-lime-300 active:translate-y-[3px] active:shadow-[0_1px_0_0_#4d7c0f]";

const SECONDARY =
  "min-h-11 rounded-2xl bg-white px-2 font-display text-sm font-semibold text-ink shadow-[0_3px_0_0_rgba(36,28,71,0.12)] ring-2 ring-ink/10 transition-all hover:ring-ink/20 active:translate-y-[2px] sm:text-base";

export function CourtCard({
  court,
  colorIndex,
  capacity,
  players,
  now,
  overtime,
  canClose,
  onStart,
  onPause,
  onResume,
  onCancel,
  onFinish,
  onClose,
  onSwap,
  onRemovePlayer,
  ranks = [],
  onRankChange,
}: {
  court: Court;
  colorIndex: number;
  capacity: number;
  players: Record<string, Player>;
  now: number;
  /** Game has run past the overtime limit. */
  overtime: boolean;
  canClose: boolean;
  /** Start from 00:00 (also restarts a paused game). */
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onFinish: () => void;
  onClose: () => void;
  onSwap: (id: string) => void;
  onRemovePlayer: (id: string) => void;
  /** The open play's ranks; with more than one, the court picks its rank. */
  ranks?: Level[];
  onRankChange?: (level: Level) => void;
}) {
  const theme = courtTheme(colorIndex);
  const status = courtStatus(court, capacity);
  // A running game is locked; pause it to change who's on court.
  const locked = status === "playing";
  const paused = status === "paused";
  const pausedAt = formatClock(court.stoppedAfterMs ?? 0);
  const openSlots = capacity - court.playerIds.length;
  const slots: (string | null)[] = [
    ...court.playerIds,
    ...Array<null>(Math.max(0, openSlots)).fill(null),
  ];
  const perSide = capacity / 2;
  const sides = [slots.slice(0, perSide), slots.slice(perSide)];

  return (
    <article
      aria-label={court.label}
      className={`flex h-full flex-col gap-3 rounded-[2rem] p-3 ring-2 sm:p-4 ${theme.card} ${overtime ? "ring-4 ring-rose-400" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
          <span className={`rounded-xl px-2.5 py-0.5 ${theme.badge}`}>
            {court.label}
          </span>
          {ranks.length > 1 && onRankChange && (
            <label className="text-sm">
              <span className="sr-only">Rank on {court.label}</span>
              <select
                value={court.rank === null ? "" : LEVELS[court.rank]}
                onChange={(e) => onRankChange(e.target.value as Level)}
                title={
                  locked
                    ? "Switches after this game"
                    : "Which rank plays on this court"
                }
                className={`min-h-9 rounded-xl px-2 font-sans font-bold ring-2 ring-white outline-none focus:ring-sky-400 ${court.rank === null ? "bg-white" : LEVEL_INFO[LEVELS[court.rank]].tone}`}
              >
                {court.rank === null && <option value="">Any rank</option>}
                {ranks.map((r) => (
                  <option key={r} value={r}>
                    {LEVEL_INFO[r].label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {court.startedAt !== null ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ${overtime ? "bg-rose-500 text-white" : "bg-white"}`}
              title={overtime ? "Over the time limit" : "Game time"}
            >
              {overtime ? (
                <span aria-hidden>⏰</span>
              ) : (
                <span
                  aria-hidden
                  className="size-2 animate-pulse-soft rounded-full bg-lime-500 motion-reduce:animate-none"
                />
              )}
              {formatClock(now - court.startedAt)}
              {overtime && <span className="sr-only"> (over time)</span>}
            </span>
          ) : (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${paused ? "bg-amber-500 text-white" : status === "ready" ? "bg-amber-300 text-amber-950" : "bg-white/70 text-ink/50"}`}
            >
              {paused ? `⏸ Paused · ${pausedAt}` : STATUS_LABEL[status]}
            </span>
          )}
          {canClose && !locked && (
            <ConfirmButton
              label={`Close ${court.label}`}
              confirmLabel="Close?"
              onConfirm={onClose}
              className="size-9 text-ink/40 hover:bg-white hover:text-rose-600"
              armedClassName="h-9 text-sm"
            >
              ✕
            </ConfirmButton>
          )}
        </div>
      </div>

      <div
        className={`relative grid flex-1 grid-cols-2 gap-3 rounded-3xl p-3 sm:gap-4 ${theme.surface}`}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-1.5 rounded-[1.25rem] border-2 border-white/70"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1.5 left-1/2 w-1 -translate-x-1/2 rounded-full bg-white"
        />
        {sides.map((side, s) => (
          <ul
            key={s}
            aria-label={s === 0 ? "Side A" : "Side B"}
            className="relative flex flex-col justify-center gap-2"
          >
            {side.map((pid, i) =>
              pid ? (
                <SeatedPlayer
                  key={pid}
                  name={players[pid].name}
                  locked={locked}
                  onSwap={() => onSwap(pid)}
                  onRemove={() => onRemovePlayer(pid)}
                />
              ) : (
                <li
                  key={`open-${i}`}
                  className="flex min-h-11 items-center justify-center rounded-full border-2 border-dashed border-white/80 text-sm font-semibold text-white"
                >
                  Open
                </li>
              ),
            )}
          </ul>
        ))}
      </div>

      {paused ? (
        <p
          role="status"
          className="rounded-2xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900"
        >
          ⏸ Paused at {pausedAt}. Change players with ⇄ or × if needed, then
          resume, restart from 00:00, finish, or cancel the game.
        </p>
      ) : (
        court.playerIds.length > 0 && (
          <p className="px-1 text-xs font-semibold text-ink/55">
            {locked
              ? "🔒 Players are locked while the game runs. Pause to edit."
              : "✏️ Edit before starting: ⇄ swaps in another player, × removes."}
          </p>
        )
      )}

      {locked ? (
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onPause}
            aria-label={`Pause the game on ${court.label}`}
            className="min-h-12 rounded-2xl bg-white px-4 font-display text-base font-semibold text-ink shadow-[0_4px_0_0_rgba(36,28,71,0.12)] ring-2 ring-ink/10 transition-all hover:text-amber-600 hover:ring-amber-200 active:translate-y-[3px]"
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            onClick={onFinish}
            className={`min-h-12 rounded-2xl font-display text-lg font-semibold transition-all active:translate-y-[3px] ${theme.button}`}
          >
            Game done ↻
          </button>
        </div>
      ) : paused ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            disabled={openSlots > 0}
            className={`${PRIMARY} disabled:pointer-events-none disabled:opacity-40`}
          >
            {openSlots > 0
              ? `Fill ${openSlots} spot${openSlots === 1 ? "" : "s"} to resume`
              : `▶ Resume from ${pausedAt}`}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onStart}
              disabled={openSlots > 0}
              className={`${SECONDARY} disabled:pointer-events-none disabled:opacity-40`}
            >
              ↻ Restart
            </button>
            <button type="button" onClick={onFinish} className={SECONDARY}>
              ✓ Done
            </button>
            <ConfirmButton
              label={`Cancel the game on ${court.label}`}
              confirmLabel="Cancel it?"
              onConfirm={onCancel}
              className={`${SECONDARY} w-full hover:text-rose-600`}
              armedClassName="min-h-11 rounded-2xl text-sm"
            >
              ✕ Cancel
            </ConfirmButton>
          </div>
        </div>
      ) : status === "ready" ? (
        <button type="button" onClick={onStart} className={PRIMARY}>
          ▶ Start game · timer from 00:00
        </button>
      ) : (
        <button
          type="button"
          disabled
          className={`min-h-12 rounded-2xl font-display text-lg font-semibold opacity-40 ${theme.button}`}
        >
          Waiting for {openSlots} more player{openSlots === 1 ? "" : "s"}
        </button>
      )}
    </article>
  );
}

function SeatedPlayer({
  name,
  locked,
  onSwap,
  onRemove,
}: {
  name: string;
  locked: boolean;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const showSwap = !locked;
  return (
    <li className="animate-pop-in flex min-h-11 min-w-0 items-center gap-1.5 rounded-full bg-white py-1 pr-1 pl-1 shadow-sm motion-reduce:animate-none">
      {/* Make room for both edit buttons on narrow phones. */}
      <Avatar
        name={name}
        size="sm"
        className={showSwap ? "max-sm:hidden" : ""}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm font-bold ${showSwap ? "max-sm:pl-2" : ""}`}
      >
        {name}
      </span>
      {locked ? (
        <span
          title="Locked while playing"
          className="flex size-7 shrink-0 items-center justify-center text-xs opacity-40"
        >
          <span aria-hidden>🔒</span>
          <span className="sr-only">Locked while playing</span>
        </span>
      ) : (
        <>
          {showSwap && (
            <button
              type="button"
              aria-label={`Swap ${name} with another player`}
              onClick={onSwap}
              className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-sky-500 after:absolute after:-inset-1 hover:bg-sky-100 hover:text-sky-700"
            >
              ⇄
            </button>
          )}
          <ConfirmButton
            label={`Remove ${name}`}
            confirmLabel="Out?"
            onConfirm={onRemove}
            className="size-7 shrink-0 text-ink/35 hover:bg-rose-100 hover:text-rose-600"
            armedClassName="h-7 text-xs"
          >
            ×
          </ConfirmButton>
        </>
      )}
    </li>
  );
}
