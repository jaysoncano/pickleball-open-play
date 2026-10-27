"use client";

import { useActionState } from "react";
import { changeLevel, type FormState } from "@/app/actions";
import { LEVEL_INFO, LEVELS, type Level } from "@/lib/ranking/levels";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

/** Admin-only: set a player's level directly. */
export function ChangeLevelForm({
  playerId,
  level,
}: {
  playerId: string;
  level: Level;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeLevel,
    { error: null },
  );
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 rounded-3xl bg-violet-50 p-3 ring-2 ring-violet-100"
    >
      <input type="hidden" name="playerId" value={playerId} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-bold tracking-wide text-violet-800 uppercase">
          Admin · set level
        </span>
        <select
          name="level"
          key={level}
          defaultValue={level}
          className="min-h-11 rounded-2xl bg-white px-3 font-semibold ring-2 ring-violet-100 outline-none focus:ring-violet-400"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_INFO[l].label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="sr-only">Note</span>
        <input
          name="note"
          placeholder="Note (optional)"
          maxLength={500}
          className="min-h-11 rounded-2xl bg-white px-3 ring-2 ring-violet-100 outline-none focus:ring-violet-400"
        />
      </label>
      <ConfirmSubmit
        confirmLabel="Tap again to change level"
        variant="secondary"
        disabled={pending}
      >
        Save
      </ConfirmSubmit>
      {state.error && (
        <p role="alert" className="w-full text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
