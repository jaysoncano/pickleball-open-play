"use client";

import { useActionState, useTransition } from "react";
import {
  inviteHost,
  removeHost,
  removeInvite,
  type FormState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";

const INPUT =
  "min-h-12 flex-1 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/**
 * Invite by username or email. An email without an account gets an
 * invitation to sign up as a host; suggestions are accounts not yet in.
 */
export function InviteHostForm({
  openPlayId,
  usernames,
}: {
  openPlayId: string;
  usernames: string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    inviteHost,
    { error: null },
  );
  return (
    <form
      key={String(state.ok && !pending)}
      action={action}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Username or email</span>
        <div className="flex flex-wrap gap-2">
          <input
            name="who"
            required
            list="host-options"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="username or name@email.com"
            className={INPUT}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </label>
      <datalist id="host-options">
        {usernames.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p role="status" className="text-sm font-semibold text-lime-700">
          ✓ {state.message}
        </p>
      )}
    </form>
  );
}

export function RemoveHost({
  openPlayId,
  adminId,
  username,
}: {
  openPlayId: string;
  adminId: string;
  username: string;
}) {
  const [busy, start] = useTransition();
  return (
    <ConfirmButton
      label={`Remove host ${username}`}
      confirmLabel="Remove?"
      onConfirm={() => start(() => removeHost(openPlayId, adminId))}
      className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
      armedClassName="min-h-11 text-sm"
    >
      {busy ? "…" : "Remove"}
    </ConfirmButton>
  );
}

/** Cancel an email invitation nobody has accepted yet. */
export function CancelInvite({
  openPlayId,
  email,
}: {
  openPlayId: string;
  email: string;
}) {
  const [busy, start] = useTransition();
  return (
    <ConfirmButton
      label={`Cancel the invitation for ${email}`}
      confirmLabel="Cancel?"
      onConfirm={() => start(() => removeInvite(openPlayId, email))}
      className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
      armedClassName="min-h-11 text-sm"
    >
      {busy ? "…" : "Cancel"}
    </ConfirmButton>
  );
}
