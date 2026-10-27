"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addAdmin,
  changeAdminPassword,
  removeAdminAccount,
  saveGroup,
  setAccountRole,
  type FormState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ROLE_INFO, ROLES, type Role } from "@/lib/roles";

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

function Field({
  label,
  name,
  type = "password",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink/60">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        className={INPUT}
      />
    </label>
  );
}

function Result({ state, ok }: { state: FormState; ok: string }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm font-semibold text-rose-600">
        {state.error}
      </p>
    );
  }
  return state.ok ? (
    <p role="status" className="text-sm font-semibold text-lime-700">
      ✓ {ok}
    </p>
  ) : null;
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeAdminPassword,
    { error: null },
  );
  return (
    <form
      key={String(state.ok)}
      action={action}
      className="flex flex-col gap-3"
    >
      <Field
        label="Current password"
        name="current"
        autoComplete="current-password"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="New password"
          name="password"
          autoComplete="new-password"
        />
        <Field label="Confirm" name="confirm" autoComplete="new-password" />
      </div>
      <Result state={state} ok="Password changed" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}

export function AddAdminForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addAdmin,
    { error: null },
  );
  return (
    <form
      key={String(state.ok)}
      action={action}
      className="flex flex-col gap-3"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold text-ink/60">
          Account level
        </legend>
        {ROLES.toReversed().map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3 ring-2 ring-ink/5 has-checked:ring-fuchsia-400"
          >
            <input
              type="radio"
              name="role"
              value={r}
              defaultChecked={r === "host"}
              className="mt-1 size-5 accent-fuchsia-500"
            />
            <span>
              <span className="font-display font-semibold">
                {ROLE_INFO[r].label}
              </span>
              <span className="block text-sm text-ink/60">
                {ROLE_INFO[r].blurb}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Username" name="username" type="text" autoComplete="off" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Password" name="password" autoComplete="new-password" />
        <Field label="Confirm" name="confirm" autoComplete="new-password" />
      </div>
      <Result
        state={state}
        ok="Account added. Share the username and password with them."
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add account"}
      </Button>
    </form>
  );
}

export function RemoveAdmin({
  id,
  username,
}: {
  id: string;
  username: string;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label={`Remove account ${username}`}
        confirmLabel="Remove?"
        onConfirm={() =>
          start(async () => setError(await removeAdminAccount(id)))
        }
        className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
        armedClassName="min-h-11 text-sm"
      >
        {busy ? "…" : "Remove"}
      </ConfirmButton>
      {error && (
        <span
          role="alert"
          className="w-full text-sm font-semibold text-rose-600"
        >
          {error}
        </span>
      )}
    </>
  );
}

/** Switch another account between admin and host. */
export function RoleSelect({
  id,
  username,
  role,
}: {
  id: string;
  username: string;
  role: Role;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <select
        aria-label={`Account level for ${username}`}
        defaultValue={role}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            const problem = await setAccountRole(id, next);
            setError(problem);
            if (problem) e.target.value = role;
          });
        }}
        className="min-h-11 rounded-xl bg-sky-50 px-2 font-semibold ring-2 ring-sky-100 outline-none focus:ring-sky-400"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_INFO[r].label}
          </option>
        ))}
      </select>
      {error && (
        <span
          role="alert"
          className="w-full text-sm font-semibold text-rose-600"
        >
          {error}
        </span>
      )}
    </>
  );
}

/** Name the group that hosts your open plays, and set its logo. */
export function GroupForm({
  groupName,
  logo,
}: {
  groupName: string;
  /** Current logo URL, if any. */
  logo: string | null;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveGroup,
    { error: null },
  );
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? logo;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-fuchsia-50 ring-2 ring-fuchsia-100">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden className="text-3xl">
              🏓
            </span>
          )}
        </span>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">
            Logo (JPEG, PNG, or WebP, up to 300 KB)
          </span>
          <input
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-sky-100 file:px-3 file:font-semibold file:text-sky-900"
          />
          {logo && !preview && (
            <span className="flex items-center gap-2 text-sm text-ink/60">
              <input
                id="remove-logo"
                type="checkbox"
                name="removeLogo"
                value="1"
                className="size-4 accent-rose-500"
              />
              <label htmlFor="remove-logo">Remove the logo</label>
            </span>
          )}
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Group name</span>
        <input
          name="groupName"
          required
          maxLength={60}
          defaultValue={groupName}
          placeholder="e.g. Makati Dinkers"
          className={INPUT}
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      ) : (
        state.message && (
          <p role="status" className="text-sm font-semibold text-lime-700">
            ✓ {state.message}
          </p>
        )
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save group"}
      </Button>
    </form>
  );
}
