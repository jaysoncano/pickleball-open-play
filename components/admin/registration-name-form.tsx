"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  deskPlayerInfo,
  saveRegistrationName,
  type FormState,
} from "@/app/actions";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { PROFILE_LIMITS } from "@/lib/profile/forms";
import { MAX_NAME_LENGTH } from "@/lib/queue/schema";
import { INPUT } from "./entry-fields";

/**
 * The names a player registered with: queue name, first and last. All a
 * host may change; admins also get a link to the whole profile.
 */
export function RegistrationNameForm({
  playerId,
  onSaved,
}: {
  playerId: string;
  /** After a save, to refresh the list. */
  onSaved: () => void;
}) {
  const [info, setInfo] =
    useState<Awaited<ReturnType<typeof deskPlayerInfo>>>();
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveRegistrationName,
    { error: null },
  );
  useEffect(() => {
    let live = true;
    deskPlayerInfo(playerId)
      .then((i) => live && setInfo(i))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [playerId]);
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state, onSaved]);

  if (info === undefined) return <p className="text-ink/50">Loading…</p>;
  if (info === null) {
    return <p className="text-ink/60">You can&apos;t edit this player.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="playerId" value={playerId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Name on the queue</span>
        <input
          name="name"
          required
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          defaultValue={info.name}
          className={INPUT}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">First name</span>
          <input
            name="firstName"
            required
            maxLength={PROFILE_LIMITS.firstName}
            autoComplete="off"
            defaultValue={info.firstName}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Last name</span>
          <input
            name="lastName"
            required
            maxLength={PROFILE_LIMITS.lastName}
            autoComplete="off"
            defaultValue={info.lastName}
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
          ✓ Saved
        </p>
      )}
      <span className="flex flex-wrap items-center justify-between gap-2">
        <ConfirmSubmit confirmLabel="Save changes?" disabled={pending}>
          {pending ? "Saving…" : "Save names"}
        </ConfirmSubmit>
        {info.fullProfile && (
          <Link
            href={`/players/${playerId}/edit`}
            className="text-sm font-semibold text-sky-700 hover:underline"
          >
            Full profile (admin) →
          </Link>
        )}
      </span>
    </form>
  );
}
