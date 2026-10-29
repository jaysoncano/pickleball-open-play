"use client";

import { useTransition } from "react";
import { removeProtestEntry } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

/** Admins: remove a protest. A level it changed stays as it is. */
export function RemoveProtest({ id, name }: { id: string; name: string }) {
  const [busy, start] = useTransition();
  return (
    <ConfirmButton
      label={`Remove the protest about ${name}`}
      warning="Any level it changed stays as it is."
      confirmText="Remove protest"
      onConfirm={() => start(() => removeProtestEntry(id))}
      className="min-h-9 px-3 text-sm text-rose-600 hover:bg-rose-50"
    >
      {busy ? "…" : "Remove protest"}
    </ConfirmButton>
  );
}
