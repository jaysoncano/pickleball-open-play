"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  registerGuestEntry,
  registerGuestSoloEntry,
  type RegisterState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { MAX_NAME_LENGTH } from "@/lib/queue/schema";
import { LEVEL_INFO, type Level } from "@/lib/ranking/levels";
import { formatMoney } from "@/lib/registration/forms";
import { INPUT, NotesField, type Fee } from "./entry-fields";
import { Done } from "./register-form";

const MODES = {
  pair: { emoji: "👥", label: "Pair" },
  solo: { emoji: "🙋", label: "Solo" },
} as const;
type Mode = keyof typeof MODES;

/**
 * A Regular open play's sign-up: a pair in one line ("gel/son"), paid or
 * not, or a player who came alone, paired later from the list. No email,
 * no account. New entries save in one tap.
 */
export function GuestForm({
  openPlayId,
  fee,
  levels,
  onSaved,
}: {
  openPlayId: string;
  fee: Fee;
  /** The open play's ranks: with more than one, the host picks. */
  levels: Level[];
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>("pair");
  const [rank, setRank] = useState<Level>(levels[0] ?? "beginner");
  const ranks = <RankPicker levels={levels} value={rank} onChange={setRank} />;
  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Who's signing up"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-ink/5 p-1"
      >
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl font-display font-semibold transition-colors ${mode === m ? "bg-white text-fuchsia-600 shadow" : "text-ink/55 hover:text-ink"}`}
          >
            <span aria-hidden>{MODES[m].emoji}</span>
            {MODES[m].label}
          </button>
        ))}
      </div>
      {mode === "pair" ? (
        <PairForm
          openPlayId={openPlayId}
          fee={fee}
          ranks={ranks}
          onSaved={onSaved}
        />
      ) : (
        <SoloForm openPlayId={openPlayId} ranks={ranks} onSaved={onSaved} />
      )}
    </div>
  );
}

/** Calls `onSaved` once per successful save. */
function useSaved(state: RegisterState, onSaved: () => void) {
  const latest = useRef(onSaved);
  useEffect(() => {
    latest.current = onSaved;
  });
  useEffect(() => {
    if (state.done) latest.current();
  }, [state.done]);
}

function PairForm({
  openPlayId,
  fee,
  ranks,
  onSaved,
}: {
  openPlayId: string;
  fee: Fee;
  ranks: ReactNode;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerGuestEntry,
    { error: null },
  );
  useSaved(state, onSaved);
  return (
    <form
      // A fresh form after each pair, ready for the next.
      key={String(state.done?.names)}
      action={action}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Pair names</span>
        <input
          name="names"
          required
          autoComplete="off"
          autoFocus
          placeholder="gel/son"
          className={`${INPUT} min-h-13 text-lg font-semibold`}
        />
        <span className="text-xs text-ink/50">
          Two names with a slash. No email needed.
        </span>
      </label>
      {ranks}
      <label className="flex min-h-13 cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 ring-2 ring-ink/10 transition-colors has-checked:bg-lime-50 has-checked:ring-lime-400">
        <input
          type="checkbox"
          name="paid"
          value="1"
          className="size-5 accent-lime-600"
        />
        <span className="flex-1 font-semibold">Paid already</span>
        {fee.cents > 0 && (
          <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-sm font-bold text-lime-800">
            {formatMoney(fee.cents, fee.currency)} cash
          </span>
        )}
      </label>
      <NotesField />
      <Done state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "👥 Add pair"}
      </Button>
    </form>
  );
}

function SoloForm({
  openPlayId,
  ranks,
  onSaved,
}: {
  openPlayId: string;
  ranks: ReactNode;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerGuestSoloEntry,
    { error: null },
  );
  useSaved(state, onSaved);
  return (
    <form
      key={String(state.done?.names)}
      action={action}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Name</span>
        <input
          name="name"
          required
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          autoFocus
          placeholder="e.g. gel"
          className={`${INPUT} min-h-13 text-lg font-semibold`}
        />
      </label>
      {ranks}
      <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-2 ring-sky-100">
        Came alone? Add them here. In the list, filter <b>Solo</b>, pick two,
        and pair them up; the pair pays then.
      </p>
      <Done state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "🙋 Add solo player"}
      </Button>
    </form>
  );
}

/**
 * Which of the open play's ranks they join, as chips. One rank: nothing to
 * pick, it's sent as is.
 */
function RankPicker({
  levels,
  value,
  onChange,
}: {
  levels: Level[];
  value: Level;
  onChange: (level: Level) => void;
}) {
  if (levels.length < 2) {
    return <input type="hidden" name="rank" value={levels[0] ?? ""} />;
  }
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-bold text-ink/60">
        Rank they join
      </legend>
      <input type="hidden" name="rank" value={value} />
      <div role="radiogroup" className="flex flex-wrap gap-1.5">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            onClick={() => onChange(l)}
            className={`min-h-10 rounded-full px-4 font-display font-semibold ring-2 transition-colors ${value === l ? `${LEVEL_INFO[l].tone} ring-fuchsia-400` : "bg-white text-ink/55 ring-ink/10 hover:ring-fuchsia-300"}`}
          >
            {value === l && <span aria-hidden>✓ </span>}
            {LEVEL_INFO[l].label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
