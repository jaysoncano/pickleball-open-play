"use client";

import { useState, useTransition } from "react";
import { removeOpenPlay } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Two-tap delete, only offered while nobody has signed up. */
export function RemoveOpenPlay({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label="Remove this open play"
        confirmLabel="Remove?"
        onConfirm={() => start(async () => setError(await removeOpenPlay(id)))}
        className="min-h-11 px-4 text-sm text-ink/55 hover:bg-ink/5"
        armedClassName="min-h-11 text-sm"
      >
        {pending ? "Removing…" : "Remove"}
      </ConfirmButton>
      {error && (
        <span role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </span>
      )}
    </>
  );
}
