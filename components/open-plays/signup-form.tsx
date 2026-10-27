"use client";

import { useActionState, useState } from "react";
import { signUpOnline, type SignupState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PROFILE_LIMITS } from "@/lib/profile/forms";
import { MAX_NAME_LENGTH } from "@/lib/queue/schema";
import { LEVEL_INFO, type Level } from "@/lib/ranking/levels";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

function Person({ prefix, label }: { prefix: "a" | "b"; label: string }) {
  const field = (name: string) => `${prefix}_${name}`;
  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-2 ring-ink/5">
      <legend className="px-1 font-display font-semibold">{label}</legend>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">
          Name on the queue{" "}
          <span className="font-semibold text-ink/40">
            (already a player? use the same name)
          </span>
        </span>
        <input
          name={field("name")}
          required
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          className={INPUT}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">First name</span>
          <input
            name={field("firstName")}
            required
            maxLength={PROFILE_LIMITS.firstName}
            autoComplete={prefix === "a" ? "given-name" : "off"}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Last name</span>
          <input
            name={field("lastName")}
            required
            maxLength={PROFILE_LIMITS.lastName}
            autoComplete={prefix === "a" ? "family-name" : "off"}
            className={INPUT}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">
          Email <span className="font-semibold text-ink/40">(private)</span>
        </span>
        <input
          name={field("email")}
          type="email"
          required
          maxLength={PROFILE_LIMITS.email}
          autoComplete={prefix === "a" ? "email" : "off"}
          className={INPUT}
        />
      </label>
    </fieldset>
  );
}

/**
 * Sign up for one rank, as a pair or solo. A pair is pending until the
 * admin confirms payment at the booth; a solo player waits to be paired.
 */
export function SignupForm({
  openPlayId,
  rank,
  fee,
}: {
  openPlayId: string;
  rank: Level;
  /** e.g. "₱300.00" */
  fee: string;
}) {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    signUpOnline,
    { error: null },
  );
  const [kind, setKind] = useState<"pair" | "solo">("pair");
  const solo = kind === "solo";
  if (state.ok && state.solo) {
    return (
      <div
        role="status"
        className="rounded-2xl bg-sky-100 px-4 py-4 text-sky-900"
      >
        <p className="font-display text-xl font-bold">
          ✓ {state.names?.[0]} is on the list!
        </p>
        <p className="mt-1">
          You&apos;re <b>looking for a partner</b> for {LEVEL_INFO[rank].label}.
          Come to the management booth: the desk pairs you, your pair pays{" "}
          <b>{fee}</b>, and once the admin confirms it you both get a receipt
          email with a link to your profile.
        </p>
      </div>
    );
  }
  if (state.ok) {
    return (
      <div
        role="status"
        className="rounded-2xl bg-lime-100 px-4 py-4 text-lime-900"
      >
        <p className="font-display text-xl font-bold">
          ✓ {state.names?.join(" & ")} signed up!
        </p>
        <p className="mt-1">
          You&apos;re <b>pending payment</b>. Pay <b>{fee}</b> at the management
          booth; once the admin confirms it, you&apos;re in the{" "}
          {LEVEL_INFO[rank].label} queue and both of you get a receipt email
          with a link to your profile.
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <input type="hidden" name="rank" value={rank} />
      <input type="hidden" name="kind" value={kind} />
      <div
        role="radiogroup"
        aria-label="How are you joining?"
        className="grid grid-cols-2 gap-2 rounded-2xl bg-ink/5 p-1"
      >
        {(
          [
            ["pair", "👥 Pair", "Two players, one entry"],
            ["solo", "🙋 Solo", "Find me a partner"],
          ] as const
        ).map(([value, title, hint]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-3 py-2 ${kind === value ? "bg-white shadow ring-2 ring-fuchsia-400" : "text-ink/60 hover:bg-white/60"}`}
          >
            <span className="font-display font-bold">{title}</span>
            <span className="text-xs font-semibold opacity-70">{hint}</span>
          </button>
        ))}
      </div>
      <div className={`grid gap-3 ${solo ? "" : "md:grid-cols-2"}`}>
        <Person prefix="a" label={solo ? "You" : "Player 1"} />
        {!solo && <Person prefix="b" label="Player 2" />}
      </div>
      <p className="flex gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-2 ring-amber-100">
        <span aria-hidden className="text-lg leading-5">
          💳
        </span>
        <span>
          <b>Payment at the booth.</b>{" "}
          {solo
            ? `Once the desk pairs you, your pair pays ${fee} (one entry, paid in full).`
            : `Your pair pays ${fee} (one entry, paid in full). You're in once the admin confirms it.`}
        </span>
      </p>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "Signing up…"
          : solo
            ? `Sign up solo for ${LEVEL_INFO[rank].label}`
            : `Sign up for ${LEVEL_INFO[rank].label}`}
      </Button>
    </form>
  );
}
