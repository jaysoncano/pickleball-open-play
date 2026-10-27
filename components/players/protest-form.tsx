"use client";

import { useActionState } from "react";
import { fileProtest, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PROTEST_REASON } from "@/lib/ranking/forms";
import { LEVEL_INFO, LEVELS, type Level } from "@/lib/ranking/levels";

export function ProtestForm({
  playerId,
  currentLevel,
}: {
  playerId: string;
  currentLevel: Level;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    fileProtest,
    { error: null },
  );
  if (state.ok) {
    return (
      <p
        role="status"
        className="mt-3 rounded-2xl bg-lime-100 px-4 py-3 text-sm font-semibold text-lime-900"
      >
        ✓ Sent. An admin will review it against the match history.
      </p>
    );
  }
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="currentLevel" value={currentLevel} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Should be</span>
        <select
          name="requestedLevel"
          required
          defaultValue=""
          className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
        >
          <option value="" disabled>
            Pick a level…
          </option>
          {LEVELS.filter((l) => l !== currentLevel).map((l) => (
            <option key={l} value={l}>
              {LEVEL_INFO[l].label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Why?</span>
        <textarea
          name="reason"
          required
          minLength={PROTEST_REASON.min}
          maxLength={PROTEST_REASON.max}
          rows={3}
          placeholder="e.g. Won 8 of the last 10 against intermediate players."
          className="rounded-2xl bg-sky-50 px-4 py-3 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send protest"}
      </Button>
    </form>
  );
}
