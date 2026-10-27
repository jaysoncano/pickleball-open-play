"use client";

import { useActionState, useState } from "react";
import {
  confirmEmailCode,
  sendEmailCode,
  type CodeFormState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/**
 * Email → code → (server redirects to the edit page). First time: by the
 * QR `token`. Returning players with a linked email: by `playerId`.
 */
export function ClaimFlow({
  token,
  playerId,
  next,
}: {
  token?: string;
  playerId?: string;
  /** Sign-in by email (no token or id): where to go afterwards. */
  next?: string;
}) {
  const [field, value] = token
    ? (["token", token] as const)
    : playerId
      ? (["playerId", playerId] as const)
      : (["byEmail", "1"] as const);
  const [sent, send, sending] = useActionState<CodeFormState, FormData>(
    sendEmailCode,
    { error: null },
  );
  const [checked, check, checking] = useActionState<CodeFormState, FormData>(
    confirmEmailCode,
    { error: null },
  );
  // "Use another email" hides the code step until the next send returns.
  const [changedFrom, setChangedFrom] = useState<CodeFormState | null>(null);
  const email = sent.ok && changedFrom !== sent ? sent.email : undefined;

  if (!email) {
    return (
      <form action={send} className="mt-5 flex flex-col gap-3">
        <input type="hidden" name={field} value={value} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue={sent.email}
            placeholder="you@example.com"
            className={INPUT}
          />
        </label>
        {sent.error && (
          <p role="alert" className="text-sm font-semibold text-rose-600">
            {sent.error}
          </p>
        )}
        <Button type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <form action={check} className="mt-5 flex flex-col gap-3">
      <p
        role="status"
        className="rounded-2xl bg-lime-100 px-4 py-3 text-sm font-semibold text-lime-900"
      >
        ✓ Code sent to {email}. It expires in 10 minutes.
      </p>
      <input type="hidden" name={field} value={value} />
      <input type="hidden" name="email" value={email} />
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">6-digit code</span>
        <input
          name="code"
          required
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          className={`${INPUT} text-center font-display text-2xl tracking-[0.5em]`}
        />
      </label>
      {checked.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {checked.error}
        </p>
      )}
      <Button type="submit" disabled={checking}>
        {checking ? "Checking…" : "Verify"}
      </Button>
      <Button variant="ghost" onClick={() => setChangedFrom(sent)}>
        Use another email or resend
      </Button>
    </form>
  );
}
