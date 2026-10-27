"use client";

import { useActionState } from "react";
import { savePlayerLogin, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/** A player's username and password for signing in. */
export function LoginSettings({
  playerId,
  username,
  hasPassword,
}: {
  playerId: string;
  username: string | null;
  hasPassword: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    savePlayerLogin,
    { error: null },
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="playerId" value={playerId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Username</span>
        <input
          name="username"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9._\\-]+"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={username ?? ""}
          className={INPUT}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">
            {hasPassword ? "New password" : "Password"}{" "}
            {hasPassword && (
              <span className="font-semibold text-ink/40">
                (leave empty to keep)
              </span>
            )}
          </span>
          <input
            name="password"
            type="password"
            minLength={8}
            required={!hasPassword}
            autoComplete="new-password"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">
            Confirm password
          </span>
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            className={INPUT}
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p role="status" className="text-sm font-semibold text-lime-700">
          ✓ Saved. Sign in with your username and password next time.
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save sign-in"}
      </Button>
    </form>
  );
}
