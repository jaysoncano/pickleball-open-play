import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { courtTheme } from "@/components/court-theme";
import { LevelBadge } from "@/components/level-badge";
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
          <CourtClock
            court={court}
            capacity={capacity}
            now={now}
            overtime={overtime}
          />
          {canClose && !locked && (
            <ConfirmButton
              label={`Close ${court.label}`}
              onConfirm={onClose}
              className="size-9 text-ink/40 hover:bg-white hover:text-rose-600"
            >
              ✕
            </ConfirmButton>
          )}
        </div>
      </div>

      <CourtSurface
        court={court}
        capacity={capacity}
        colorIndex={colorIndex}
        seat={(pid) => (
          <SeatedPlayer
            key={pid}
            name={players[pid].name}
            skill={players[pid].skill}
            actions={
              locked ? (
                <span
                  title="Locked while playing"
                  className="flex size-8 shrink-0 items-center justify-center text-xs opacity-40"
                >
                  <span aria-hidden>🔒</span>
                  <span className="sr-only">Locked while playing</span>
                </span>
              ) : (
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    aria-label={`Swap ${players[pid].name} with another pair`}
                    onClick={() => onSwap(pid)}
                    className="relative flex size-8 items-center justify-center rounded-full text-base font-bold text-sky-500 after:absolute after:-inset-1 hover:bg-sky-100 hover:text-sky-700"
                  >
                    ⇄
                  </button>
                  <ConfirmButton
                    label={`Remove ${players[pid].name}`}
                    onConfirm={() => onRemovePlayer(pid)}
                    className="size-8 text-ink/35 hover:bg-rose-100 hover:text-rose-600"
                  >
                    ×
                  </ConfirmButton>
                </span>
              )
            }
          />
        )}
      />

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
              confirmText="Cancel game"
              onConfirm={onCancel}
              className={`${SECONDARY} w-full hover:text-rose-600`}
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

/**
 * A court for watching: the same card the host sees, with no buttons.
 * Names link to profiles when `team` members are given and `link` is on.
 */
export function CourtView({
  court,
  colorIndex,
  capacity,
  players,
  now,
  teams = {},
  link = false,
}: {
  court: Court;
  colorIndex: number;
  capacity: number;
  players: Record<string, Player>;
  now: number;
  /** Each pair's players, so names can link to profiles. */
  teams?: Record<string, { id: string; name: string }[]>;
  link?: boolean;
}) {
  const theme = courtTheme(colorIndex);
  const rank = court.rank === null ? null : LEVELS[court.rank];
  return (
    <article
      aria-label={court.label}
      className={`flex h-full flex-col gap-3 rounded-[2rem] p-3 ring-2 sm:p-4 ${theme.card}`}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
          <span className={`rounded-xl px-2.5 py-0.5 ${theme.badge}`}>
            {court.label}
          </span>
          {rank && (
            <span
              className={`rounded-xl px-2 py-0.5 font-sans text-sm font-bold ${LEVEL_INFO[rank].tone}`}
            >
              {LEVEL_INFO[rank].label}
            </span>
          )}
        </h3>
        <CourtClock court={court} capacity={capacity} now={now} />
      </div>
      <CourtSurface
        court={court}
        capacity={capacity}
        colorIndex={colorIndex}
        seat={(pid) => (
          <SeatedPlayer
            key={pid}
            name={players[pid]?.name ?? "?"}
            skill={players[pid]?.skill}
            team={teams[pid]}
            link={link}
          />
        )}
      />
    </article>
  );
}

/** The game clock while playing, otherwise the court's status. */
function CourtClock({
  court,
  capacity,
  now,
  overtime = false,
}: {
  court: Court;
  capacity: number;
  now: number;
  overtime?: boolean;
}) {
  const status = courtStatus(court, capacity);
  if (court.startedAt !== null) {
    return (
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
        {/* The clock starts on the client (now is 0 on the server). */}
        {now ? formatClock(now - court.startedAt) : "··:··"}
        {overtime && <span className="sr-only"> (over time)</span>}
      </span>
    );
  }
  const paused = status === "paused";
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${paused ? "bg-amber-500 text-white" : status === "ready" ? "bg-amber-300 text-amber-950" : "bg-white/70 text-ink/50"}`}
    >
      {paused
        ? `⏸ Paused · ${formatClock(court.stoppedAfterMs ?? 0)}`
        : STATUS_LABEL[status]}
    </span>
  );
}

/** Side A over side B, each pair on its own full-width row. */
function CourtSurface({
  court,
  capacity,
  colorIndex,
  seat,
}: {
  court: Court;
  capacity: number;
  colorIndex: number;
  seat: (id: string) => ReactNode;
}) {
  const theme = courtTheme(colorIndex);
  const openSlots = capacity - court.playerIds.length;
  const slots: (string | null)[] = [
    ...court.playerIds,
    ...Array<null>(Math.max(0, openSlots)).fill(null),
  ];
  const perSide = capacity / 2;
  const sides = [slots.slice(0, perSide), slots.slice(perSide)];
  return (
    <div
      className={`relative flex flex-1 flex-col justify-center gap-2 rounded-3xl p-3 ${theme.surface}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-1.5 rounded-[1.25rem] border-2 border-white/70"
      />
      {sides.map((side, s) => (
        <Fragment key={s}>
          {s === 1 && (
            <div aria-hidden className="relative flex items-center gap-2">
              <span className="h-1 flex-1 rounded-full bg-white" />
              <span className="rounded-full bg-white px-2.5 py-0.5 font-display text-xs font-black text-ink/60">
                VS
              </span>
              <span className="h-1 flex-1 rounded-full bg-white" />
            </div>
          )}
          <ul
            aria-label={s === 0 ? "Side A" : "Side B"}
            className="relative flex flex-col gap-2"
          >
            {side.map((pid, i) =>
              pid ? (
                seat(pid)
              ) : (
                <li
                  key={`open-${i}`}
                  className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-dashed border-white/80 text-sm font-semibold text-white"
                >
                  Open
                </li>
              ),
            )}
          </ul>
        </Fragment>
      ))}
    </div>
  );
}

/** A pair on court: both players side by side, names in full. */
function SeatedPlayer({
  name,
  team,
  link = false,
  skill,
  actions,
}: {
  name: string;
  /** The pair's rank, shown as a badge. */
  skill?: number;
  /** The pair's players by id, for profile links. */
  team?: { id: string; name: string }[];
  link?: boolean;
  /** Host buttons (swap, remove) or the lock while playing. */
  actions?: ReactNode;
}) {
  // Pairs are named "Ana & Ben"; show each player with their own avatar.
  const people = team ?? name.split(" & ").map((n) => ({ id: "", name: n }));
  return (
    <li className="animate-pop-in flex min-h-12 items-center gap-2 rounded-2xl bg-white py-1.5 pr-1.5 pl-2 shadow-sm motion-reduce:animate-none">
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        {people.map((person, i) => {
          const body = (
            <>
              <Avatar name={person.name} size="sm" />
              <span
                className="font-display text-base font-bold break-words"
                title={person.name}
              >
                {person.name}
              </span>
            </>
          );
          return link && person.id ? (
            <Link
              key={person.id}
              href={`/players/${person.id}`}
              className="flex min-w-0 items-center gap-1.5 rounded-xl hover:text-fuchsia-600"
            >
              {body}
            </Link>
          ) : (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              {body}
            </span>
          );
        })}
        {skill !== undefined && LEVELS[skill] && (
          <LevelBadge level={LEVELS[skill]} size="sm" />
        )}
      </span>
      {actions}
    </li>
  );
}
