"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reopenOpenPlay } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

/**
 * Undo an accidental "End session": the open play runs again with its
 * courts, queue, and games as they were. Hosts only.
 */
export function ReopenSession({ openPlayId }: { openPlayId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <ConfirmButton
        label="Reopen this session"
        warning="Ended it by mistake? The open play goes live again with its courts, queue, and games as they were. Add time in Settings if it's past the end time."
        confirmText="↩ Reopen"
        onConfirm={() =>
          start(async () => {
            const e = await reopenOpenPlay(openPlayId);
            setError(e);
            // The page reloads as the live dashboard.
            if (!e) router.refresh();
          })
        }
        className="min-h-11 bg-white px-4 text-ink ring-2 ring-ink/10 hover:ring-fuchsia-300"
      >
        {busy ? "Reopening…" : "↩ Reopen session"}
      </ConfirmButton>
      {error && (
        <span role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </span>
      )}
    </span>
  );
}
