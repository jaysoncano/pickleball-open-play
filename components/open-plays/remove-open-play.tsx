"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeOpenPlay } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Two-tap delete, only offered while nobody has signed up. */
export function RemoveOpenPlay({
  id,
  then,
}: {
  id: string;
  /** Where to go once it's removed (its own pages are gone). */
  then?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label="Remove this open play"
        confirmLabel="Remove?"
        onConfirm={() =>
          start(async () => {
            const error = await removeOpenPlay(id);
            setError(error);
            if (!error && then) router.push(then);
          })
        }
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
