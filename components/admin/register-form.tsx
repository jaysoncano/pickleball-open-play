"use client";

import { useActionState, useEffect, useState } from "react";
import {
  registerPairEntry,
  registerSoloEntry,
  type RegisterState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PROFILE_LIMITS } from "@/lib/profile/forms";
import { nameKey } from "@/lib/queue/names";
import { MAX_NAME_LENGTH } from "@/lib/queue/schema";
import { EntryFields, INPUT, type Fee } from "./entry-fields";

export type KnownPlayer = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
};

/**
 * One player's fields. Typing a registered name links that player and
 * fills in what's on file; any other name registers someone new.
 */
function PersonFields({
  prefix,
  label,
  known,
}: {
  prefix: "a" | "b";
  label: string;
  known: KnownPlayer[];
}) {
  const [name, setName] = useState("");
  const match = known.find((p) => nameKey(p.name) === nameKey(name));
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  function pick(value: string) {
    setName(value);
    const found = known.find((p) => nameKey(p.name) === nameKey(value));
    if (found) {
      setFirstName(found.firstName);
      setLastName(found.lastName);
      setEmail(found.email);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-2 ring-ink/5">
      <legend className="px-1 font-display font-semibold">
        {label}
        {match ? (
          <span className="ml-2 rounded-full bg-sky-100 px-2 py-px text-xs font-bold text-sky-800">
            Registered player
          </span>
        ) : (
          name.trim() && (
            <span className="ml-2 rounded-full bg-lime-200 px-2 py-px text-xs font-bold text-lime-900">
              New player
            </span>
          )
        )}
      </legend>
      <input
        type="hidden"
        name={`${prefix}_playerId`}
        value={match?.id ?? ""}
      />
      <input type="hidden" name={`${prefix}_name`} value={match ? "" : name} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Name on the queue</span>
        <input
          list="desk-known-players"
          required
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          value={name}
          onChange={(e) => pick(e.target.value)}
          placeholder="Search or type a new name"
          className={INPUT}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">First name</span>
          <input
            name={`${prefix}_firstName`}
            required
            maxLength={PROFILE_LIMITS.firstName}
            autoComplete="off"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Last name</span>
          <input
            name={`${prefix}_lastName`}
            required
            maxLength={PROFILE_LIMITS.lastName}
            autoComplete="off"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={INPUT}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">
          Email{" "}
          <span className="font-semibold text-ink/40">(receipt goes here)</span>
        </span>
        <input
          name={`${prefix}_email`}
          type="email"
          required
          maxLength={PROFILE_LIMITS.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
        />
      </label>
    </fieldset>
  );
}

export function Done({ state }: { state: RegisterState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-rose-600">
        {state.error}
      </p>
    );
  }
  if (!state.done) return null;
  if (state.done.unpaid) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900"
      >
        ✓ {state.done.names.join(" & ")} registered as <b>UNPAID</b>. Confirm
        their payment below when they pay; receipts go out then.
      </p>
    );
  }
  return (
    <p
      role="status"
      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state.done.emailed ? "bg-lime-100 text-lime-900" : "bg-amber-100 text-amber-900"}`}
    >
      ✓ {state.done.names.join(" & ")} registered.{" "}
      {state.done.emailed
        ? "Receipt emailed."
        : `Saved, but the email failed: ${state.done.note}`}
    </p>
  );
}

const MODES = {
  pair: "Pair · paid now",
  later: "Pair · pay later",
  solo: "Solo, needs partner",
} as const;

/**
 * Register a pair (paid now, or unpaid until the host confirms) or a solo
 * player looking for a partner.
 */
export function RegisterForm({
  openPlay,
  fee,
  known,
  onSaved,
}: {
  openPlay: { id: string; label: string };
  fee: Fee;
  known: KnownPlayer[];
  /** Called after each successful sign-up, to refresh the day's list. */
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<keyof typeof MODES>("pair");
  const [pairState, pairAction, pairPending] = useActionState<
    RegisterState,
    FormData
  >(registerPairEntry, { error: null });
  const [soloState, soloAction, soloPending] = useActionState<
    RegisterState,
    FormData
  >(registerSoloEntry, { error: null });
  useEffect(() => {
    if (pairState.done || soloState.done) onSaved();
  }, [pairState.done, soloState.done, onSaved]);
  const solo = mode === "solo";
  const state = solo ? soloState : pairState;
  const pending = solo ? soloPending : pairPending;
  // A fresh form after each success, so the next pair starts blank.
  const formKey = `${mode}-${solo ? soloState.done?.names : pairState.done?.names}`;
  const later = mode === "later";

  return (
    <section
      aria-labelledby="register-title"
      className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="register-title" className="font-display text-2xl font-bold">
          <span aria-hidden>📝</span> Register
          <span className="mt-1 block text-base font-semibold text-ink/55">
            {openPlay.label}
          </span>
        </h2>
        <div
          role="radiogroup"
          aria-label="Sign-up type"
          className="flex gap-1 rounded-2xl bg-ink/5 p-1"
        >
          {(Object.keys(MODES) as (keyof typeof MODES)[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-10 rounded-xl px-3 font-display font-semibold ${mode === m ? "bg-white shadow" : "text-ink/60"}`}
            >
              {MODES[m]}
            </button>
          ))}
        </div>
      </div>
      <datalist id="desk-known-players">
        {known.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <form
        key={formKey}
        action={solo ? soloAction : pairAction}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="openPlayId" value={openPlay.id} />
        {later && <input type="hidden" name="payLater" value="1" />}
        <div className={`grid gap-3 ${solo ? "" : "md:grid-cols-2"}`}>
          <PersonFields
            prefix="a"
            label={solo ? "Player" : "Player 1"}
            known={known}
          />
          {!solo && <PersonFields prefix="b" label="Player 2" known={known} />}
        </div>
        {later ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-2 ring-rose-200">
            Saved as <b>UNPAID</b>: they can check in, but join the queue only
            after you confirm their payment.
          </p>
        ) : solo ? (
          <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
            No payment yet. Pair them with another solo player below; the pair
            then pays the full entry.
          </p>
        ) : (
          <EntryFields fee={fee} />
        )}
        <Done state={state} />
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : solo
              ? "Sign up solo & email"
              : later
                ? "Register as unpaid"
                : "Record entry & email receipts"}
        </Button>
      </form>
    </section>
  );
}
