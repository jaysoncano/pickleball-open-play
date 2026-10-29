"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  registerPairEntry,
  registerSoloEntry,
  type RegisterState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PROFILE_LIMITS } from "@/lib/profile/forms";
import { nameKey } from "@/lib/queue/names";
import { MAX_NAME_LENGTH } from "@/lib/queue/schema";
import { splitName } from "@/lib/registration/desk";
import {
  EntryFields,
  INPUT,
  NotesField,
  type EntryDefaults,
  type Fee,
} from "./entry-fields";

export type KnownPlayer = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
};

/**
 * One player's fields. Typing a registered name links that player and
 * fills in what's on file; a new name fills first and last name from it.
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
  // Once the host types a first or last name, stop filling it in.
  const [typed, setTyped] = useState(false);

  function pick(value: string) {
    setName(value);
    const found = known.find((p) => nameKey(p.name) === nameKey(value));
    if (found) {
      setFirstName(found.firstName);
      setLastName(found.lastName);
      setEmail(found.email);
    } else if (!typed) {
      const split = splitName(value);
      setFirstName(split.firstName);
      setLastName(split.lastName);
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
      <input
        list="desk-known-players"
        required
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        aria-label={`${label}: name on the queue`}
        value={name}
        onChange={(e) => pick(e.target.value)}
        placeholder="Name on the queue (search or new)"
        className={INPUT}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name={`${prefix}_firstName`}
          required
          maxLength={PROFILE_LIMITS.firstName}
          autoComplete="off"
          aria-label={`${label}: first name`}
          placeholder="First name"
          value={firstName}
          onChange={(e) => {
            setTyped(true);
            setFirstName(e.target.value);
          }}
          className={INPUT}
        />
        <input
          name={`${prefix}_lastName`}
          required
          maxLength={PROFILE_LIMITS.lastName}
          autoComplete="off"
          aria-label={`${label}: last name`}
          placeholder="Last name"
          value={lastName}
          onChange={(e) => {
            setTyped(true);
            setLastName(e.target.value);
          }}
          className={INPUT}
        />
      </div>
      <input
        name={`${prefix}_email`}
        type="email"
        required
        maxLength={PROFILE_LIMITS.email}
        aria-label={`${label}: email (receipt goes here)`}
        placeholder="Email (receipt goes here)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={INPUT}
      />
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
  if (state.done.guest && state.done.solo) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-900"
      >
        ✓ {state.done.names[0]} added as solo. Pair them from the list (filter{" "}
        <b>Solo</b>).
      </p>
    );
  }
  if (state.done.guest) {
    return (
      <p
        role="status"
        className={`rounded-2xl px-4 py-3 text-sm font-semibold ${state.done.unpaid ? "bg-rose-100 text-rose-900" : "bg-lime-100 text-lime-900"}`}
      >
        ✓ {state.done.names.join(" & ")} added
        {state.done.unpaid ? (
          <>
            {" "}
            as <b>UNPAID</b>. Mark them paid when they pay.
          </>
        ) : (
          " as paid."
        )}
      </p>
    );
  }
  if (state.done.unpaid) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-rose-100 px-4 py-3 text-sm font-semibold text-rose-900"
      >
        ✓ {state.done.names.join(" & ")} registered as <b>UNPAID</b>. Confirm
        their payment in the list when they pay; receipts go out then.
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

// Pay later first: most pairs register, then pay when they're ready.
const TABS = {
  later: "Pay later",
  pair: "Paid now",
  solo: "Solo",
  players: "Players",
} as const;
type Tab = keyof typeof TABS;

const STORE = "pop.desk";

/** Per-device memory of the last payment method, per open play. */
function readStore(): { entry?: Record<string, EntryDefaults> } {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}");
  } catch {
    return {};
  }
}

function writeStore(next: ReturnType<typeof readStore>) {
  try {
    localStorage.setItem(STORE, JSON.stringify({ ...readStore(), ...next }));
  } catch {
    // Private mode or blocked storage: the form still works, just forgets.
  }
}

/**
 * The desk's left column: register a pair (paid now or later) or a solo
 * player, or find any player to edit. Opens on "Pay later"; the amount is
 * the open play's fee, and the last payment method is remembered here.
 */
export function DeskForms({
  openPlayId,
  fee,
  known,
  onSaved,
  players,
}: {
  openPlayId: string;
  fee: Fee;
  known: KnownPlayer[];
  /** Called after each successful sign-up, to refresh the list. */
  onSaved: () => void;
  /** The "Players" tab: the player directory. No tab without it. */
  players?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("later");
  const [defaults, setDefaults] = useState<EntryDefaults | undefined>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const saved = readStore();
    /* eslint-disable react-hooks/set-state-in-effect -- browser storage loads after hydration */
    setDefaults(saved.entry?.[openPlayId]);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [openPlayId]);

  const tabs = (Object.keys(TABS) as Tab[]).filter(
    (t) => t !== "players" || players,
  );

  function remember(next: EntryDefaults) {
    setDefaults(next);
    writeStore({ entry: { ...readStore().entry, [openPlayId]: next } });
  }

  return (
    <section
      aria-label="Register"
      className="flex flex-col gap-3 rounded-[2rem] bg-white/80 p-3 ring-2 ring-white backdrop-blur sm:p-4"
    >
      <div
        role="tablist"
        aria-label="Sign-up type"
        className={`grid gap-1 rounded-2xl bg-ink/5 p-1 ${tabs.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}
      >
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-10 rounded-xl px-1 font-display text-sm font-semibold sm:text-base ${tab === t ? "bg-white shadow" : "text-ink/60 hover:text-ink"}`}
          >
            {TABS[t]}
          </button>
        ))}
      </div>
      {tab === "players" ? (
        players
      ) : (
        <RegisterForm
          key={`${tab}-${loaded}`}
          mode={tab}
          openPlayId={openPlayId}
          fee={fee}
          known={known}
          defaults={defaults}
          onDefaults={remember}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

function RegisterForm({
  mode,
  openPlayId,
  fee,
  known,
  defaults,
  onDefaults,
  onSaved,
}: {
  mode: Exclude<Tab, "players">;
  openPlayId: string;
  fee: Fee;
  known: KnownPlayer[];
  defaults?: EntryDefaults;
  onDefaults: (next: EntryDefaults) => void;
  onSaved: () => void;
}) {
  const solo = mode === "solo";
  const later = mode === "later";
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    solo ? registerSoloEntry : registerPairEntry,
    { error: null },
  );
  // Once per successful save, even if the caller passes a new callback
  // each render (it may re-render us as a result).
  const latest = useRef(onSaved);
  useEffect(() => {
    latest.current = onSaved;
  });
  useEffect(() => {
    if (state.done) latest.current();
  }, [state.done]);
  // A fresh form after each success, so the next pair starts blank.
  const formKey = String(state.done?.names);

  return (
    <>
      <datalist id="desk-known-players">
        {known.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <form key={formKey} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="openPlayId" value={openPlayId} />
        {later && <input type="hidden" name="payLater" value="1" />}
        <PersonFields
          prefix="a"
          label={solo ? "Player" : "Player 1"}
          known={known}
        />
        {!solo && <PersonFields prefix="b" label="Player 2" known={known} />}
        {later ? (
          <>
            <NotesField />
            <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-2 ring-rose-200">
              Saved as <b>UNPAID</b>. They join the queue once you confirm the
              payment in the list.
            </p>
          </>
        ) : solo ? (
          <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
            No payment yet. Pair them with another solo player in the list
            (filter <b>Solo</b>); the pair then pays the full entry.
          </p>
        ) : (
          <EntryFields fee={fee} defaults={defaults} onChange={onDefaults} />
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
    </>
  );
}
