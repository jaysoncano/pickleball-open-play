"use client";

import { useActionState } from "react";
import { saveProfile, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { HAND_LABEL, HANDS, PROFILE_LIMITS } from "@/lib/profile/forms";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400 disabled:text-ink/50";

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeClub: string;
  bio: string;
  hand: string;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink/60">
        {label}
        {hint && <span className="ml-1 font-semibold text-ink/40">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ProfileForm({
  playerId,
  initial,
  emailLocked,
  emailConfirmed,
}: {
  playerId: string;
  initial: Values;
  /** Players keep the email they verified; admins can change it. */
  emailLocked: boolean;
  /** False when an admin typed the email and the player hasn't proved it. */
  emailConfirmed: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveProfile,
    { error: null },
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={playerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input
            name="firstName"
            required
            maxLength={PROFILE_LIMITS.firstName}
            autoComplete="given-name"
            defaultValue={initial.firstName}
            className={INPUT}
          />
        </Field>
        <Field label="Last name">
          <input
            name="lastName"
            required
            maxLength={PROFILE_LIMITS.lastName}
            autoComplete="family-name"
            defaultValue={initial.lastName}
            className={INPUT}
          />
        </Field>
      </div>
      <Field
        label="Email"
        hint={
          emailConfirmed
            ? "(confirmed · private)"
            : "(private · player confirms it with a code next time)"
        }
      >
        <input
          name="email"
          type="email"
          required
          maxLength={PROFILE_LIMITS.email}
          autoComplete="email"
          defaultValue={initial.email}
          disabled={emailLocked}
          className={INPUT}
        />
      </Field>
      <Field label="Phone" hint="(optional · private)">
        <input
          name="phone"
          type="tel"
          maxLength={PROFILE_LIMITS.phone}
          autoComplete="tel"
          defaultValue={initial.phone}
          className={INPUT}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Home club or city" hint="(optional)">
          <input
            name="homeClub"
            maxLength={PROFILE_LIMITS.homeClub}
            defaultValue={initial.homeClub}
            className={INPUT}
          />
        </Field>
        <Field label="Plays" hint="(optional)">
          <select
            name="hand"
            defaultValue={initial.hand}
            className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
          >
            <option value="">Prefer not to say</option>
            {HANDS.map((h) => (
              <option key={h} value={h}>
                {HAND_LABEL[h]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label="About you"
        hint={`(optional · up to ${PROFILE_LIMITS.bio})`}
      >
        <textarea
          name="bio"
          rows={3}
          maxLength={PROFILE_LIMITS.bio}
          defaultValue={initial.bio}
          placeholder="e.g. Weekend dinker, loves a third-shot drop."
          className="rounded-2xl bg-sky-50 px-4 py-3 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      {state.ok && !pending && (
        <p role="status" className="text-sm font-semibold text-lime-700">
          ✓ Saved
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save info"}
      </Button>
    </form>
  );
}
