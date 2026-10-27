"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/** Username and password sign-in, for admins and players. */
export function PasswordSignIn({
  action: signIn,
  next,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  /** Where to go afterwards (players). */
  next?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {
    error: null,
  });
  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Username</span>
        <input
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={INPUT}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
