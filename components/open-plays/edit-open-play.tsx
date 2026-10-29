"use client";

import { useActionState } from "react";
import { editOpenPlay, type FormState } from "@/app/actions";
import type { OpenPlay } from "@/lib/db/queries";
import { ScheduleFields } from "./create-open-play";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

/** Its hosts: change the date, time, ranks, cap, or entry. */
export function EditOpenPlayForm({ play }: { play: OpenPlay }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    editOpenPlay,
    { error: null },
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="openPlayId" value={play.id} />
      {play.live && (
        <p className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-800">
          🔴 It&apos;s running now: you can change the cap and entry, but the
          date, time, and ranks stay until it ends.
        </p>
      )}
      <ScheduleFields
        defaults={{
          playDate: play.playDate,
          startTime: play.startTime,
          endTime: play.endTime,
          levels: play.levels,
          maxPairs: play.maxPairs,
          fee: play.feeCents / 100,
        }}
      />
      <p className="text-sm text-ink/60">
        Pairs who already paid keep their amount. A rank with sign-ups stays
        until they&apos;re moved.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      ) : (
        state.message &&
        !pending && (
          <p role="status" className="text-sm font-semibold text-lime-700">
            ✓ {state.message}
          </p>
        )
      )}
      <ConfirmSubmit
        confirmLabel="Save changes?"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Saving…" : "Save changes"}
      </ConfirmSubmit>
    </form>
  );
}
