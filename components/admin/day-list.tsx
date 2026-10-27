"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  confirmPayment,
  pairUpSolos,
  registrationsFor,
  removePairEntry,
  type RegisterState,
} from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { photoUrl } from "@/lib/profile/forms";
import {
  formatMoney,
  METHOD_LABEL,
  pairLevel,
  pairName,
} from "@/lib/registration/forms";
import { EntryFields, type Fee } from "./entry-fields";
import { Done } from "./register-form";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

type Day = Awaited<ReturnType<typeof registrationsFor>>;

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
const time = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** Everyone signed up for an open play: paid pairs, then solos to pair. */
export function DayList({
  openPlayId,
  fee,
  version,
  onSaved,
}: {
  openPlayId: string;
  fee: Fee;
  /** Bumped after a registration, to reload the list. */
  version: number;
  onSaved: () => void;
}) {
  const [day, setDay] = useState<Day | null>(null);

  useEffect(() => {
    let live = true;
    registrationsFor(openPlayId)
      .then((d) => live && setDay(d))
      .catch(() => live && setDay({ pairs: [], pending: [], solos: [] }));
    return () => {
      live = false;
    };
  }, [openPlayId, version]);

  if (!day) return <p className={`${CARD} text-ink/50`}>Loading…</p>;
  const total = day.pairs.reduce((n, p) => n + p.amountCents, 0);

  return (
    <>
      {day.pending.length > 0 && (
        <section
          aria-labelledby="pending-title"
          className={`${CARD} ring-amber-200`}
        >
          <h2 id="pending-title" className="font-display text-2xl font-bold">
            <span aria-hidden>⏳</span> Unpaid · confirm payment (
            {day.pending.length})
          </h2>
          <p className="mb-3 text-sm text-ink/60">
            Signed up online or registered to pay later. When they pay, confirm
            it: they can join the queue and get their receipts.
          </p>
          <ul className="flex flex-col gap-2">
            {day.pending.map((p) => (
              <PendingPair key={p.id} pair={p} fee={fee} onSaved={onSaved} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="day-title" className={CARD}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="day-title" className="font-display text-2xl font-bold">
            <span aria-hidden>💳</span> Paid pairs
          </h2>
          <p className="font-display font-bold tabular-nums">
            {day.pairs.length} pair{day.pairs.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(total, fee.currency)}
          </p>
        </div>
        {day.pairs.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
            No pairs for this open play yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {day.pairs.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
              >
                <span className="flex -space-x-2">
                  {p.members.map((m) => (
                    <Avatar
                      key={m.playerId}
                      name={m.name}
                      src={photoUrl(m.playerId, m.photoUpdatedAt)}
                      size="md"
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {pairName(p.members.map((m) => m.name))}
                  </span>
                  <span className="text-xs font-semibold text-ink/50">
                    {formatMoney(p.amountCents, fee.currency)} ·{" "}
                    {METHOD_LABEL[p.method]}
                    {p.reference && ` · ref ${p.reference}`} ·{" "}
                    {time.format(p.createdAt)}
                  </span>
                </span>
                <LevelBadge level={pairLevel(p.members.map((m) => m.level))} />
                <CheckedIn members={p.members} />
                <span className="flex flex-wrap gap-1">
                  {p.members.map((m) => (
                    <Link
                      key={m.playerId}
                      href={`/players/${m.playerId}/edit`}
                      className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-semibold ring-2 ring-ink/10 hover:ring-fuchsia-300"
                    >
                      Edit {m.name}
                    </Link>
                  ))}
                  <RemovePair
                    pairId={p.id}
                    label={`Remove ${pairName(p.members.map((m) => m.name))}`}
                    text="Remove"
                    onSaved={onSaved}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {day.solos.length > 0 && (
        <PairUp
          openPlayId={openPlayId}
          fee={fee}
          solos={day.solos}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function PairUp({
  openPlayId,
  fee,
  solos,
  onSaved,
}: {
  openPlayId: string;
  fee: Fee;
  solos: Day["solos"];
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    pairUpSolos,
    { error: null },
  );

  useEffect(() => {
    if (state.done) onSaved();
  }, [state.done, onSaved]);

  function toggle(id: string) {
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2),
    );
  }

  return (
    <section aria-labelledby="solo-title" className={CARD}>
      <h2 id="solo-title" className="font-display text-2xl font-bold">
        <span aria-hidden>🤝</span> Looking for a partner ({solos.length})
      </h2>
      <p className="mb-3 text-sm text-ink/60">
        Pick two, then record the pair&apos;s full entry.
      </p>
      <ul className="mb-3 flex flex-wrap gap-2">
        {solos.map((s) => {
          const on = picked.includes(s.playerId);
          return (
            <li key={s.playerId}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.playerId)}
                className={`flex min-h-11 items-center gap-2 rounded-full py-1 pr-3 pl-1 font-semibold ring-2 ${on ? "bg-fuchsia-500 text-white ring-fuchsia-600" : "bg-white ring-ink/10 hover:ring-fuchsia-300"}`}
              >
                <Avatar
                  name={s.name}
                  src={photoUrl(s.playerId, s.photoUpdatedAt)}
                  size="sm"
                />
                {s.name}
                <LevelBadge level={s.level} size="sm" />
                <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-black text-rose-700 uppercase">
                  Unpaid
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked.length === 2 && (
        <form
          key={picked.join()}
          action={action}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="openPlayId" value={openPlayId} />
          <input type="hidden" name="a_playerId" value={picked[0]} />
          <input type="hidden" name="b_playerId" value={picked[1]} />
          <EntryFields fee={fee} />
          <ConfirmSubmit
            confirmLabel="Tap again to pair & record"
            disabled={pending}
          >
            {pending ? "Saving…" : "Pair up & record entry"}
          </ConfirmSubmit>
        </form>
      )}
      <div className="mt-2">
        <Done state={state} />
      </div>
    </section>
  );
}

/** A pair that signed up online: confirm their payment, or reject. */
function PendingPair({
  pair,
  fee,
  onSaved,
}: {
  pair: Day["pending"][number];
  fee: Fee;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    confirmPayment,
    { error: null },
  );
  const names = pairName(pair.members.map((m) => m.name));

  useEffect(() => {
    if (state.done) onSaved();
  }, [state.done, onSaved]);

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-rose-50 p-3 ring-2 ring-rose-200">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-black tracking-wide text-white uppercase">
          Unpaid
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{names}</span>
          <span className="text-xs font-semibold text-ink/50">
            {pair.members.map((m) => m.fullName || m.name).join(" · ")} · signed
            up {time.format(pair.createdAt)}
          </span>
        </span>
        <LevelBadge level={pairLevel(pair.members.map((m) => m.level))} />
        <Button onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Confirm payment"}
        </Button>
        <RemovePair
          pairId={pair.id}
          label={`Reject ${names}`}
          text="Reject"
          onSaved={onSaved}
        />
      </div>
      {open && (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="pairId" value={pair.id} />
          <EntryFields fee={fee} />
          <ConfirmSubmit
            confirmLabel="Tap again to confirm payment"
            variant="lime"
            disabled={pending}
          >
            {pending ? "Confirming…" : `✓ Paid · confirm ${names}`}
          </ConfirmSubmit>
        </form>
      )}
      <Done state={state} />
    </li>
  );
}

/** Two-tap remove: rejects a pending sign-up or removes a paid pair. */
function RemovePair({
  pairId,
  label,
  text,
  onSaved,
}: {
  pairId: string;
  label: string;
  text: string;
  onSaved: () => void;
}) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label={label}
        confirmLabel={`${text}?`}
        onConfirm={() =>
          start(async () => {
            const e = await removePairEntry(pairId);
            setError(e);
            if (!e) onSaved();
          })
        }
        className="min-h-11 px-3 text-sm text-ink/55 hover:bg-ink/5"
        armedClassName="min-h-11 text-sm"
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

/** "✓ Checked in", or how many of the pair have arrived. */
function CheckedIn({ members }: { members: Day["pairs"][number]["members"] }) {
  const here = members.filter((m) => m.checkedIn).length;
  return here === members.length ? (
    <span className="rounded-full bg-lime-200 px-2 py-0.5 text-xs font-bold text-lime-900">
      ✓ Checked in
    </span>
  ) : (
    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-bold text-ink/55">
      {here}/{members.length} checked in
    </span>
  );
}
