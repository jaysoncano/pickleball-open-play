"use client";

import { useActionState } from "react";
import { saveVenue, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Venue } from "@/lib/roles";
import { VenueFields } from "./create-open-play";

/** Its hosts: set or change the court venue and location. */
export function VenueForm({
  openPlayId,
  current,
  venues,
}: {
  openPlayId: string;
  current: Venue;
  venues: Venue[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveVenue,
    { error: null },
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <VenueFields
        venues={venues}
        initial={current.venue ? current : venues[0]}
      />
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      ) : (
        state.message && (
          <p role="status" className="text-sm font-semibold text-lime-700">
            ✓ {state.message}
          </p>
        )
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save venue"}
      </Button>
    </form>
  );
}
