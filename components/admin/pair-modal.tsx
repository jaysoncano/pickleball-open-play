"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  confirmPayment,
  markRegularPaid,
  markRegularUnpaid,
  removeRegularSolo,
  renameRegularPair,
  renameRegularSolo,
  removePairEntry,
  savePairNotes,
  type RegisterState,
} from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";
import { Modal } from "@/components/ui/modal";
import { rowMembers, type DeskRow } from "@/lib/registration/desk";
import type { OpenPlayKind } from "@/lib/registration/open-play";
import {
  formatMoney,
  MAX_NOTES,
  METHOD_LABEL,
  pairName,
} from "@/lib/registration/forms";
import type { Member } from "./desk-table";
import { EntryFields, INPUT, type Fee } from "./entry-fields";
import { Done } from "./register-form";
import { RegistrationNameForm } from "./registration-name-form";

/** "Oct 29, 1:01 PM": when they signed up or paid. */
export const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TAB =
  "min-h-9 shrink-0 rounded-xl px-3 font-display text-sm font-semibold";

/**
 * Everything for one row in one place: the pair's payment, notes, and
 * removal, and each player's info. Solo rows show just the player.
 */
export function PairModal({
  row,
  fee,
  kind,
  onSaved,
  onClose,
}: {
  row: DeskRow;
  fee: Fee;
  kind: OpenPlayKind;
  onSaved: () => void;
  onClose: () => void;
}) {
  const members = rowMembers(row);
  const solo = row.kind === "solo";
  const [tab, setTab] = useState<string>(solo ? members[0].playerId : "pair");
  // Regular pairs are names only: nothing per player to edit.
  const tabs = [
    ...(solo ? [] : [{ id: "pair", label: "Pair" }]),
    ...(kind === "regular"
      ? []
      : members.map((m) => ({ id: m.playerId, label: m.name }))),
  ];
  const member = members.find((m) => m.playerId === tab);

  return (
    <Modal
      wide
      title={pairName(members.map((m) => m.name))}
      eyebrow={
        row.kind === "paid" ? "Paid" : row.kind === "unpaid" ? "Unpaid" : "Solo"
      }
      tone={
        row.kind === "unpaid"
          ? "from-rose-400 to-fuchsia-500"
          : row.kind === "paid"
            ? "from-lime-400 to-emerald-500"
            : "from-sky-400 to-violet-500"
      }
      onClose={onClose}
    >
      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Edit"
          className="flex gap-1 overflow-x-auto border-b border-ink/5 bg-ink/5 p-1.5"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`${TAB} ${tab === t.id ? "bg-white shadow" : "text-ink/60 hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {row.kind === "solo" && kind === "regular" ? (
          <GuestSoloTab
            member={row.member}
            onSaved={onSaved}
            onRemoved={() => {
              onSaved();
              onClose();
            }}
          />
        ) : row.kind !== "solo" && tab === "pair" ? (
          <PairTab
            row={row}
            fee={fee}
            kind={kind}
            onSaved={onSaved}
            onRemoved={() => {
              onSaved();
              onClose();
            }}
          />
        ) : (
          member && (
            <PlayerTab
              key={member.playerId}
              member={member}
              onSaved={onSaved}
            />
          )
        )}
      </div>
    </Modal>
  );
}

function PairTab({
  row,
  fee,
  kind,
  onSaved,
  onRemoved,
}: {
  row: Extract<DeskRow, { kind: "paid" | "unpaid" }>;
  fee: Fee;
  kind: OpenPlayKind;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const people = rowMembers(row).map((m) => m.name);
  const names = pairName(people);
  return (
    <>
      {kind === "regular" && (
        <GuestNamesForm
          key={people.join("/")}
          pairId={row.id}
          names={people}
          onSaved={onSaved}
        />
      )}
      <section className="flex flex-col gap-2">
        <h3 className="font-display font-bold">Payment</h3>
        {row.kind === "paid" ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-lime-50 px-3 py-2 text-sm ring-2 ring-lime-100">
            <span>
              <b>{formatMoney(row.pair.amountCents, fee.currency)}</b> ·{" "}
              {METHOD_LABEL[row.pair.method]} · paid{" "}
              {stamp.format(row.pair.createdAt)}
            </span>
            {kind === "regular" && (
              <MarkUnpaid pairId={row.id} names={names} onSaved={onSaved} />
            )}
          </div>
        ) : (
          <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm ring-2 ring-rose-100">
            <b>Unpaid</b> · signed up {stamp.format(row.pair.createdAt)}. When
            they pay, tap <b>✓ Mark paid</b> on their row in the list.
          </p>
        )}
      </section>
      <NotesForm pairId={row.id} notes={row.notes} onSaved={onSaved} />
      <section className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-3">
        <span className="text-sm text-ink/55">
          {row.kind === "unpaid"
            ? "Not coming? Reject the sign-up."
            : "Refund and remove the pair."}
        </span>
        <RemovePair
          pairId={row.id}
          label={`${row.kind === "unpaid" ? "Reject" : "Remove"} ${names}`}
          text={row.kind === "unpaid" ? "Reject" : "Remove pair"}
          onRemoved={onRemoved}
        />
      </section>
    </>
  );
}

/** A player's registration names: all a host may change. */
function PlayerTab({
  member,
  onSaved,
}: {
  member: Member;
  onSaved: () => void;
}) {
  return <RegistrationNameForm playerId={member.playerId} onSaved={onSaved} />;
}

/** Regular solos: fix the name, or remove them before they're paired. */
function GuestSoloTab({
  member,
  onSaved,
  onRemoved,
}: {
  member: Member;
  onSaved: () => void;
  onRemoved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <form
        action={(form) =>
          start(async () => {
            const e = await renameRegularSolo(
              member.playerId,
              String(form.get("name") ?? ""),
            );
            setError(e);
            setSaved(!e);
            if (!e) onSaved();
          })
        }
        className="flex flex-col gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="font-display font-bold">Name</span>
          <input
            name="name"
            required
            autoComplete="off"
            defaultValue={member.name}
            onChange={() => setSaved(false)}
            className={`${INPUT} text-lg`}
          />
        </label>
        <span className="flex flex-wrap items-center gap-2">
          <ConfirmSubmit
            confirmLabel="Save the new name?"
            variant="secondary"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save name"}
          </ConfirmSubmit>
          {saved && (
            <span role="status" className="text-sm font-semibold text-lime-700">
              ✓ Saved
            </span>
          )}
        </span>
      </form>
      <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-2 ring-sky-100">
        To pair them, close this, filter <b>Solo</b>, and pick two.
      </p>
      <section className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/5 pt-3">
        <span className="text-sm text-ink/55">Left before pairing?</span>
        <ConfirmButton
          label={`Remove ${member.name}`}
          onConfirm={() =>
            start(async () => {
              const e = await removeRegularSolo(member.playerId);
              setError(e);
              if (!e) onRemoved();
            })
          }
          className="min-h-9 px-3 text-sm text-rose-600 hover:bg-rose-50"
        >
          Remove
        </ConfirmButton>
      </section>
      {error && (
        <span role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </span>
      )}
    </>
  );
}

/** Regular pairs: fix the names, typed like when adding ("gel/son"). */
function GuestNamesForm({
  pairId,
  names,
  onSaved,
}: {
  pairId: string;
  names: string[];
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const e = await renameRegularPair(
            pairId,
            String(form.get("names") ?? ""),
          );
          setError(e);
          setSaved(!e);
          if (!e) onSaved();
        })
      }
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1">
        <span className="font-display font-bold">Names</span>
        <input
          name="names"
          required
          autoComplete="off"
          defaultValue={names.join("/")}
          onChange={() => setSaved(false)}
          className={`${INPUT} text-lg`}
        />
        <span className="text-xs text-ink/50">
          Two names with a slash, e.g. gel/son. Type just one name to make that
          player solo again; the other is removed.
        </span>
      </label>
      <span className="flex flex-wrap items-center gap-2">
        <ConfirmSubmit
          confirmLabel="Save the new names?"
          warning="With one name, they become a solo player and the other is removed, along with the pair's payment."
          variant="secondary"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save names"}
        </ConfirmSubmit>
        {saved && (
          <span role="status" className="text-sm font-semibold text-lime-700">
            ✓ Saved
          </span>
        )}
      </span>
      {error && (
        <span role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </span>
      )}
    </form>
  );
}

/** The host's notes on the pair, paid or not. */
function NotesForm({
  pairId,
  notes,
  onSaved,
}: {
  pairId: string;
  notes: string;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const e = await savePairNotes(
            pairId,
            String(form.get("notes") ?? ""),
          );
          setError(e);
          setSaved(!e);
          if (!e) onSaved();
        })
      }
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-1">
        <span className="font-display font-bold">
          Notes{" "}
          <span className="text-sm font-semibold text-ink/40">
            (only hosts see these)
          </span>
        </span>
        <input
          name="notes"
          defaultValue={notes}
          maxLength={MAX_NOTES}
          placeholder="e.g. paid half, own paddles"
          onChange={() => setSaved(false)}
          className={INPUT}
        />
      </label>
      <span className="flex flex-wrap items-center gap-2">
        <ConfirmSubmit
          confirmLabel="Save changes?"
          disabled={busy}
          variant="secondary"
        >
          {busy ? "Saving…" : "Save notes"}
        </ConfirmSubmit>
        {saved && (
          <span role="status" className="text-sm font-semibold text-lime-700">
            ✓ Saved
          </span>
        )}
      </span>
      {error && (
        <span role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </span>
      )}
    </form>
  );
}

/** "✓ Mark paid" for either kind: Regular confirms; Ranked takes details. */
export function PayButton(props: {
  kind: OpenPlayKind;
  pairId: string;
  names: string;
  notes: string;
  fee: Fee;
  onSaved: () => void;
  className: string;
}) {
  const { kind, ...rest } = props;
  return kind === "regular" ? (
    <RegularMarkPaid {...rest} />
  ) : (
    <MarkPaid {...rest} />
  );
}

/** Regular pairs: confirm, and they're paid (the entry fee, cash). */
function RegularMarkPaid({
  pairId,
  names,
  fee,
  onSaved,
  className,
}: {
  pairId: string;
  names: string;
  fee: Fee;
  onSaved: () => void;
  className: string;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => setAsking(true)}
        aria-label={`Mark ${names} as paid`}
        className={className}
      >
        {busy ? "…" : "✓ Mark paid"}
      </button>
      {error && (
        <span role="alert" className="text-xs font-semibold text-rose-600">
          {error}
        </span>
      )}
      {asking && (
        <ConfirmDialog
          title={`${names} paid?`}
          warning={
            fee.cents > 0
              ? `${formatMoney(fee.cents, fee.currency)} · cash`
              : undefined
          }
          confirmText="✓ Mark paid"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            start(async () => {
              const e = await markRegularPaid(pairId);
              setError(e);
              if (!e) onSaved();
            });
          }}
        />
      )}
    </>
  );
}

/** Regular pairs: they didn't pay after all. */
function MarkUnpaid({
  pairId,
  names,
  onSaved,
}: {
  pairId: string;
  names: string;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <ConfirmButton
        label={`Mark ${names} as unpaid`}
        confirmText="Mark unpaid"
        onConfirm={() =>
          start(async () => {
            const e = await markRegularUnpaid(pairId);
            setError(e);
            if (!e) onSaved();
          })
        }
        className="min-h-9 px-3 text-sm text-rose-600 hover:bg-rose-50"
      >
        {busy ? "…" : "Mark unpaid"}
      </ConfirmButton>
      {error && (
        <span
          role="alert"
          className="w-full text-xs font-semibold text-rose-600"
        >
          {error}
        </span>
      )}
    </>
  );
}

/**
 * The list's "✓ Mark paid": a small popup with the amount (the open play's
 * fee), method, and notes. Confirming there marks the pair paid and emails
 * their receipts; the popup is the confirmation.
 */
export function MarkPaid({
  pairId,
  names,
  notes,
  fee,
  onSaved,
  className,
}: {
  pairId: string;
  names: string;
  notes: string;
  fee: Fee;
  onSaved: () => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Mark ${names} as paid`}
        className={className}
      >
        ✓ Mark paid
      </button>
      {open && (
        <Modal
          title={`${names} paid?`}
          eyebrow="Confirm payment"
          tone="from-lime-400 to-emerald-500"
          onClose={() => setOpen(false)}
        >
          <MarkPaidForm
            pairId={pairId}
            notes={notes}
            fee={fee}
            onSaved={onSaved}
            onClose={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  );
}

function MarkPaidForm({
  pairId,
  notes,
  fee,
  onSaved,
  onClose,
}: {
  pairId: string;
  notes: string;
  fee: Fee;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    confirmPayment,
    { error: null },
  );
  useEffect(() => {
    if (state.done) onSaved();
  }, [state.done, onSaved]);
  if (state.done) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Done state={state} />
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 overflow-y-auto p-4">
      <input type="hidden" name="pairId" value={pairId} />
      <EntryFields fee={fee} notes={notes} />
      <Done state={state} />
      <span className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Go back
        </Button>
        <Button type="submit" variant="lime" disabled={pending}>
          {pending ? "Saving…" : "✓ Confirm paid"}
        </Button>
      </span>
    </form>
  );
}

/** Two-tap remove: rejects an unpaid sign-up or removes a paid pair. */
function RemovePair({
  pairId,
  label,
  text,
  onRemoved,
}: {
  pairId: string;
  label: string;
  text: string;
  onRemoved: () => void;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label={label}
        onConfirm={() =>
          start(async () => {
            const e = await removePairEntry(pairId);
            setError(e);
            if (!e) onRemoved();
          })
        }
        className="min-h-9 px-3 text-sm text-rose-600 hover:bg-rose-50"
      >
        {busy ? "…" : text}
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
