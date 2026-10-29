"use client";

import { useTransition } from "react";
import { newQrCode } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <span aria-hidden>🖨️</span> {label}
    </Button>
  );
}

/** Void the printed code and make a new one (two taps). */
export function NewQrButton({
  playerId,
  name,
}: {
  playerId: string;
  name: string;
}) {
  const [pending, start] = useTransition();
  return (
    <ConfirmButton
      label={`Make a new QR code for ${name}`}
      warning="The old QR code stops working."
      confirmText="Make new code"
      onConfirm={() => start(() => newQrCode(playerId))}
      className="min-h-11 px-4 text-sm text-ink/60 hover:bg-ink/5"
    >
      {pending ? "Making…" : "New code"}
    </ConfirmButton>
  );
}
