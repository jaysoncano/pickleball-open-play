"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, type SyntheticEvent } from "react";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import { LEVELS } from "@/lib/ranking/levels";
import { ConfirmButton } from "@/components/ui/confirm-button";
import type { Player } from "@/lib/queue/schema";

const groupTones = [
  "bg-fuchsia-50 ring-fuchsia-200",
  "bg-sky-50 ring-sky-100",
  "bg-lime-50 ring-lime-100",
  "bg-amber-50 ring-amber-100",
];

const MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

export function QueueList({
  queue,
  players,
  capacity,
  onMove,
  onReorder,
  onRemove,
  onRename,
  renameError,
  startsIn,
  atRisk,
}: {
  queue: string[];
  players: Record<string, Player>;
  capacity: number;
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder: (id: string, toIndex: number) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Why a new name can't be used, or null when it can. */
  renameError: (id: string, name: string) => string | null;
  /** Estimated ms until each player is on court. */
  startsIn: Record<string, number>;
  /** Players unlikely to start a game before time is up. */
  atRisk: string[];
}) {
  const sensors = useSensors(
    // Mouse: a small move starts a drag, so clicks on buttons still work.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch: long-press to pick up, so normal swipes keep scrolling.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const nameOf = (id: string | number) => players[String(id)]?.name ?? "";
  const spot = (id: string | number) => queue.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}, spot ${spot(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over spot ${spot(over.id)}.` : "",
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} moved to spot ${spot(over.id)}.`
        : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Move cancelled. ${nameOf(active.id)} stays put.`,
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), queue.indexOf(String(over.id)));
  }

  if (queue.length === 0) {
    return (
      <p className="rounded-3xl border-2 border-dashed border-ink/15 p-5 text-center text-ink/50">
        Nobody waiting. Everyone&apos;s playing! 🎉
      </p>
    );
  }

  return (
    <>
      <p className="mb-2 text-xs font-semibold text-ink/45">
        Drag a card to reorder (long-press on touch), or use the arrows.
      </p>
      <DndContext
        id="queue-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={MODIFIERS}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To pick up a player, press space or enter. Use the up and down arrow keys to move, space or enter to drop, or escape to cancel.",
          },
        }}
      >
        <SortableContext items={queue} strategy={verticalListSortingStrategy}>
          <ol className="relative flex flex-col gap-1.5">
            {queue.map((pid, i) => (
              <QueueItem
                key={pid}
                id={pid}
                player={players[pid]}
                index={i}
                isNext={i < capacity}
                waitMs={startsIn[pid]}
                mayMiss={atRisk.includes(pid)}
                isFirst={i === 0}
                isLast={i === queue.length - 1}
                tone={groupTones[Math.floor(i / capacity) % groupTones.length]}
                onMove={onMove}
                onRemove={onRemove}
                onRename={onRename}
                renameError={renameError}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

function QueueItem({
  id,
  player,
  index,
  isNext,
  waitMs,
  mayMiss,
  isFirst,
  isLast,
  tone,
  onMove,
  onRemove,
  onRename,
  renameError,
}: {
  id: string;
  player: Player;
  index: number;
  isNext: boolean;
  waitMs?: number;
  mayMiss: boolean;
  isFirst: boolean;
  isLast: boolean;
  tone: string;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  renameError: (id: string, name: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  // Pointer drags work anywhere on the card; keyboard drags only from the
  // grip, so Enter on the arrow or remove buttons still presses them.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? "z-10" : ""}`}
    >
      {/* Pop-in lives on an inner wrapper: a CSS animation on the <li>
          would override the drag transform. */}
      <div
        {...pointerListeners}
        className={`animate-pop-in flex cursor-grab touch-manipulation items-center gap-2 rounded-2xl py-1.5 pr-1.5 pl-1 ring-2 transition-[box-shadow,scale,rotate] duration-150 select-none active:cursor-grabbing motion-reduce:animate-none ${tone} ${isDragging ? "scale-[1.03] -rotate-1 shadow-[0_18px_35px_-12px_rgba(36,28,71,0.45)] ring-fuchsia-400" : ""}`}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={(event) => onKeyDown?.(event)}
          aria-label={`Reorder ${player.name}, spot ${index + 1}`}
          className="relative flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink/30 after:absolute after:-inset-1.5 hover:bg-white hover:text-ink/70 focus-visible:outline-4 focus-visible:outline-sky-400 active:cursor-grabbing"
        >
          <GripIcon />
        </button>
        <span className="w-5 text-center font-display text-sm font-bold text-ink/40 tabular-nums">
          {index + 1}
        </span>
        <Avatar name={player.name} size="sm" />
        <span className="min-w-0 flex-1">
          {editing ? (
            <NameEditor
              name={player.name}
              error={(name) => renameError(id, name)}
              onSave={(name) => {
                onRename(id, name);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit name: ${player.name}`}
              title="Edit name"
              className="group/name flex max-w-full items-center gap-1 rounded-md text-left font-bold hover:text-fuchsia-600 focus-visible:outline-4 focus-visible:outline-sky-400"
            >
              <span className="truncate">{player.name}</span>
              <span
                aria-hidden
                className="text-xs text-ink/30 group-hover/name:text-fuchsia-500"
              >
                ✎
              </span>
            </button>
          )}
          <span className="block text-xs font-semibold text-ink/50">
            {player.skill !== undefined && LEVELS[player.skill] && (
              <span className="mr-1.5 align-middle">
                <LevelBadge level={LEVELS[player.skill]} size="sm" />
              </span>
            )}
            {player.gamesPlayed === 0
              ? "Fresh legs"
              : `${player.gamesPlayed} game${player.gamesPlayed === 1 ? "" : "s"}`}
            {waitMs !== undefined && ` · ${waitLabel(waitMs)}`}
            {isNext && (
              <span className="ml-1.5 rounded-full bg-fuchsia-500 px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase">
                Next
              </span>
            )}
            {mayMiss && (
              <span
                title="Likely won't start a game before time is up"
                className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold tracking-wide text-white uppercase"
              >
                May miss
              </span>
            )}
          </span>
        </span>
        <span className="flex items-center">
          <MoveButton
            label={`Move ${player.name} up`}
            disabled={isFirst}
            onClick={() => onMove(id, -1)}
          >
            ↑
          </MoveButton>
          <MoveButton
            label={`Move ${player.name} down`}
            disabled={isLast}
            onClick={() => onMove(id, 1)}
          >
            ↓
          </MoveButton>
          <ConfirmButton
            label={`Remove ${player.name}`}
            confirmLabel="Remove?"
            onConfirm={() => onRemove(id)}
            className="size-9 text-ink/40 hover:bg-rose-100 hover:text-rose-600"
            armedClassName="h-9 text-sm"
          >
            ×
          </ConfirmButton>
        </span>
      </div>
    </li>
  );
}

/** Keep a press inside the editor from starting a card drag. */
const stopDrag = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Inline name field. Enter or leaving the field saves; Escape cancels.
 * A name that can't be used shows why and isn't saved.
 */
function NameEditor({
  name,
  error,
  onSave,
  onCancel,
}: {
  name: string;
  error: (name: string) => string | null;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(name);
  // Closing unmounts the input, which can fire one last blur: ignore it so
  // Escape doesn't turn into a save.
  const closed = useRef(false);
  const problem = draft.trim() === name ? null : error(draft);

  function close(save: boolean) {
    if (closed.current) return;
    closed.current = true;
    if (save && draft.trim() !== name && !problem) onSave(draft);
    else onCancel();
  }

  return (
    <span className="block" onMouseDown={stopDrag} onTouchStart={stopDrag}>
      <input
        autoFocus
        value={draft}
        aria-label={`New name for ${name}`}
        aria-invalid={problem !== null}
        enterKeyHint="done"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => close(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!problem) close(true);
          } else if (event.key === "Escape") {
            close(false);
          }
        }}
        className={`w-full rounded-lg bg-white px-2 py-1 text-base font-bold ring-2 outline-none ${problem ? "ring-rose-400" : "ring-fuchsia-300 focus:ring-fuchsia-500"}`}
      />
      {problem && (
        <span
          role="status"
          className="block text-xs font-semibold text-rose-600"
        >
          {problem}
        </span>
      )}
    </span>
  );
}

/** "any moment" or "~12 min" — estimates, so rounded. */
function waitLabel(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes < 1 ? "any moment" : `~${minutes} min`;
}

function GripIcon() {
  return (
    <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5 fill-current">
      {[2, 8, 14].map((y) =>
        [2, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />),
      )}
    </svg>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="relative flex size-9 items-center justify-center rounded-full font-bold text-ink/40 after:absolute after:-inset-0.5 hover:bg-white hover:text-ink disabled:opacity-20"
    >
      {children}
    </button>
  );
}
