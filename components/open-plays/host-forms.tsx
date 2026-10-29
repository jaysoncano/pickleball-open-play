"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createCoHostAccount,
  inviteHost,
  type CoHostState,
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
      onConfirm={() => start(() => removeHost(openPlayId, adminId))}
      className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
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
      confirmText="Cancel invitation"
      onConfirm={() => start(() => removeInvite(openPlayId, email))}
      className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
    >
      {busy ? "…" : "Cancel"}
    </ConfirmButton>
  );
}

/** A readable random password: 12 letters and digits, no look-alikes. */
function newPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Make a new host account that co-hosts this open play: username, email,
 * password. Afterwards the details show once, to hand over (passwords
 * are stored scrambled, so this is the only time it's visible).
 */
export function NewCoHostForm({
  openPlayId,
  openPlays,
}: {
  /** From an open play's Manage page: this one. */
  openPlayId?: string;
  /** From Settings: pick one of the open plays you run. */
  openPlays?: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<CoHostState, FormData>(
    createCoHostAccount,
    { error: null },
  );
  const [password, setPassword] = useState("");
  // The password sent with the last submit, for the hand-over card.
  const [sent, setSent] = useState("");
  const [copied, setCopied] = useState(false);
  const made = state.made;
  const details = made
    ? `Username: ${made.username}\nEmail: ${made.email}\nPassword: ${sent}`
    : "";

  return (
    <div className="flex flex-col gap-3">
      <form
        key={made?.username ?? "new"}
        action={action}
        onSubmit={() => {
          setSent(password);
          setCopied(false);
        }}
        className="grid gap-2 sm:grid-cols-3"
      >
        {openPlays ? (
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-sm font-bold text-ink/60">
              Co-hosts which open play
            </span>
            <select
              name="openPlayId"
              required
              defaultValue=""
              className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
            >
              <option value="" disabled>
                Pick an open play you run
              </option>
              {openPlays.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="openPlayId" value={openPlayId} />
        )}
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Username</span>
          <input
            name="username"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. jo.host"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="name@email.com"
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-bold text-ink/60">Password</span>
          <span className="flex gap-1">
            <input
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              className={`${INPUT} min-w-0 font-mono`}
            />
            <button
              type="button"
              onClick={() => setPassword(newPassword())}
              title="Make a random password"
              className="shrink-0 rounded-2xl px-3 text-sm font-bold text-violet-700 ring-2 ring-violet-200 hover:bg-violet-50"
            >
              🎲
            </button>
          </span>
        </label>
        {state.error && (
          <p
            role="alert"
            className="text-sm font-semibold text-rose-600 sm:col-span-3"
          >
            {state.error}
          </p>
        )}
        <div className="sm:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "➕ Create co-host account"}
          </Button>
        </div>
      </form>
      {made && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-2xl bg-lime-50 p-3 ring-2 ring-lime-200"
        >
          <p className="font-display font-semibold text-lime-900">
            ✓ {made.username} can sign in now at /host/login and co-hosts this
            open play. Send them these:
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-white p-3 font-mono text-sm">
            <dt className="text-ink/50">Username</dt>
            <dd className="font-bold">{made.username}</dd>
            <dt className="text-ink/50">Email</dt>
            <dd className="font-bold break-all">{made.email}</dd>
            <dt className="text-ink/50">Password</dt>
            <dd className="font-bold break-all">{sent}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(details)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
              className="min-h-9 rounded-full bg-white px-3 text-sm font-bold text-lime-800 ring-2 ring-lime-300 hover:bg-lime-100"
            >
              {copied ? "✓ Copied" : "📋 Copy all"}
            </button>
            <span className="text-xs text-lime-900/70">
              Shown once: passwords are stored scrambled. They can change it in
              Settings.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
