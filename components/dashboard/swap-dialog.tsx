"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import type { SwapCandidate } from "@/lib/queue/engine";
import { nameKey } from "@/lib/queue/names";

/**
 * Pick who replaces a seated player. Mount with a `key` per player so the
 * search resets each time it opens.
 */
export function SwapDialog({
  playerName,
  courtLabel,
  candidates,
  onPick,
  onClose,
}: {
  playerName: string;
  courtLabel: string;
  candidates: SwapCandidate[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const key = nameKey(query);
  const matches = candidates.filter((c) => nameKey(c.name).includes(key));
  const waiting = matches.filter((c) => c.where.kind === "queue");
  const seated = matches.filter((c) => c.where.kind === "court");

  return (
    <Modal
      eyebrow={`${courtLabel} · swap player`}
      title={`Replace ${playerName}`}
      onClose={onClose}
    >
      <div className="border-b border-ink/5 p-4">
        <label htmlFor="swap-search" className="sr-only">
          Search players
        </label>
        <input
          id="swap-search"
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players not playing…"
          autoComplete="off"
          className="min-h-12 w-full rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-3">
        {matches.length === 0 ? (
          <p className="p-6 text-center text-ink/50">
            {candidates.length === 0
              ? "Nobody is free to swap in right now."
              : `No free player matches "${query.trim()}".`}
          </p>
        ) : (
          <>
            <Group title="Waiting in line" items={waiting} onPick={onPick} />
            <Group
              title="On courts not started (they trade spots)"
              items={seated}
              onPick={onPick}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

function Group({
  title,
  items,
  onPick,
}: {
  title: string;
  items: SwapCandidate[];
  onPick: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mb-2">
      <h3 className="px-2 pt-1 pb-2 text-xs font-bold tracking-widest text-ink/45 uppercase">
        {title}
      </h3>
      <ul className="flex flex-col gap-1">
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition-colors hover:bg-fuchsia-50 focus-visible:bg-fuchsia-50 focus-visible:outline-none"
            >
              <Avatar name={c.name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{c.name}</span>
                <span className="block text-xs font-semibold text-ink/50">
                  {c.where.kind === "queue"
                    ? `#${c.where.position} in line`
                    : c.where.label}
                  {" · "}
                  {c.gamesPlayed === 0
                    ? "fresh legs"
                    : `${c.gamesPlayed} game${c.gamesPlayed === 1 ? "" : "s"}`}
                </span>
              </span>
              <span
                aria-hidden
                className="rounded-full bg-fuchsia-500 px-3 py-1 font-display text-sm font-semibold text-white"
              >
                Swap in
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
