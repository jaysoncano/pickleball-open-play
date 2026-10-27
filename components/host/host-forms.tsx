"use client";

import { useActionState } from "react";
import {
  hostSignUp,
  resendHostCode,
  verifyHostCode,
  type FormState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink/60">{label}</span>
      <input required className={INPUT} {...input} />
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}

function Message({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-rose-600">
        {state.error}
      </p>
    );
  }
  return state.message ? (
    <p role="status" className="text-sm font-semibold text-lime-700">
      ✓ {state.message}
    </p>
  ) : null;
}

/** Group, email, username, password. A code is emailed next. */
export function HostSignupForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    hostSignUp,
    { error: null },
  );
  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      <Field
        label="Group name"
        name="groupName"
        maxLength={60}
        autoComplete="organization"
        placeholder="e.g. Makati Dinkers"
        hint="Shown on your open plays. You can add a logo after signing in."
      />
      <Field
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        defaultValue={email}
        hint="We'll email you a 6-digit code to verify it."
      />
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
        <Field
          label="Confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
        />
      </div>
      <Message state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Sign up & email my code"}
      </Button>
    </form>
  );
}

/** Enter the emailed code; or send another. */
export function HostVerifyForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    verifyHostCode,
    { error: null },
  );
  const [resent, resend, resending] = useActionState<FormState, FormData>(
    resendHostCode,
    { error: null },
  );
  return (
    <div className="mt-5 flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="username" value={username} />
        <Field
          label="6-digit code"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
          className={`${INPUT} text-center font-display text-2xl tracking-[0.5em] tabular-nums`}
        />
        <Message state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Checking…" : "Verify & sign in"}
        </Button>
      </form>
      <form action={resend} className="flex flex-col items-center gap-1">
        <input type="hidden" name="username" value={username} />
        <button
          type="submit"
          disabled={resending}
          className="min-h-11 rounded-xl px-3 text-sm font-semibold text-fuchsia-600 hover:underline disabled:opacity-50"
        >
          {resending ? "Sending…" : "Didn't get it? Send a new code"}
        </button>
        <Message state={resent} />
      </form>
    </div>
  );
}
