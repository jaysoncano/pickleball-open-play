"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  pairRegularSolos,
  pairUpSolos,
  type RegisterState,
} from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { photoUrl } from "@/lib/profile/forms";
import { randomPartner } from "@/lib/registration/desk";
import { formatMoney } from "@/lib/registration/forms";
import type { OpenPlayKind } from "@/lib/registration/open-play";
import type { Member } from "./desk-table";
import { EntryFields, type Fee } from "./entry-fields";
import { Done } from "./register-form";

/**
 * Pair a solo player: pick their partner from the other solos (or let
 * "Shuffle" draw one), then record it. Regular pairs are paid or not;
 * Ranked pairs record the full entry.
 */
export function SoloPairModal({
  kind,
  openPlayId,
  fee,
  solo,
  solos,
  initialPartner,
  onSaved,
  onClose,
}: {
  kind: OpenPlayKind;
  openPlayId: string;
  fee: Fee;
  solo: Member;
  /** Everyone signed up alone, this player included. */
  solos: Member[];
  /** From "Random partner": start with this one picked. */
  initialPartner?: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const others = solos.filter((s) => s.playerId !== solo.playerId);
  const [partner, setPartner] = useState<string | null>(initialPartner ?? null);
  const picked = others.find((s) => s.playerId === partner);

  return (
    <Modal
      wide
      title={`Partner for ${solo.name}`}
      eyebrow="Pair a solo player"
      tone="from-fuchsia-400 to-violet-500"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {others.length === 0 ? (
          <p className="rounded-2xl bg-sky-50 px-3 py-3 text-sky-900 ring-2 ring-sky-100">
            No one else is solo yet. Add another solo player, then pair them.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display font-semibold">Pick a partner</p>
              <button
                type="button"
                onClick={() =>
                  setPartner(
                    randomPartner(solos, solo.playerId, Math.random)
                      ?.playerId ?? null,
                  )
                }
                className="min-h-9 rounded-full bg-violet-100 px-3 text-sm font-bold text-violet-700 hover:bg-violet-200"
              >
                🎲 Shuffle
              </button>
            </div>
            <ul
              role="radiogroup"
              aria-label="Partner"
              className="-m-1 grid max-h-64 gap-1.5 overflow-y-auto p-1 sm:grid-cols-2"
            >
              {others.map((s) => {
                const on = s.playerId === partner;
                return (
                  <li key={s.playerId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPartner(s.playerId)}
                      className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left ring-2 transition-colors ${on ? "bg-fuchsia-50 ring-fuchsia-400" : "bg-white ring-ink/10 hover:ring-fuchsia-300"}`}
                    >
                      <Avatar
                        name={s.name}
                        src={photoUrl(s.playerId, s.photoUpdatedAt)}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate font-bold">
                        {s.name}
                      </span>
                      <LevelBadge level={s.level} size="sm" />
                      <span aria-hidden className="text-fuchsia-500">
                        {on ? "●" : "○"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked && (
              <p className="rounded-2xl bg-fuchsia-50 px-3 py-2 text-center font-display text-lg font-bold ring-2 ring-fuchsia-200">
                🤝 {solo.name} &amp; {picked.name}
              </p>
            )}
            {picked &&
              (kind === "regular" ? (
                <RegularPair
                  key={picked.playerId}
                  openPlayId={openPlayId}
                  fee={fee}
                  a={solo.playerId}
                  b={picked.playerId}
                  onSaved={onSaved}
                  onClose={onClose}
                />
              ) : (
                <RankedPair
                  key={picked.playerId}
                  openPlayId={openPlayId}
                  fee={fee}
                  a={solo.playerId}
                  b={picked.playerId}
                  onSaved={onSaved}
                  onClose={onClose}
                />
              ))}
          </>
        )}
      </div>
    </Modal>
  );
}

type PairProps = {
  openPlayId: string;
  fee: Fee;
  a: string;
  b: string;
  onSaved: () => void;
  onClose: () => void;
};

/** Regular: paid already (the fee, cash) or not. */
function RegularPair({ openPlayId, fee, a, b, onSaved, onClose }: PairProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form
      action={(form) =>
        start(async () => {
          const e = await pairRegularSolos(
            openPlayId,
            a,
            b,
            form.get("paid") === "1",
          );
          setError(e);
          if (!e) {
            onSaved();
            onClose();
          }
        })
      }
      className="flex flex-col gap-2"
    >
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 ring-2 ring-ink/10 has-checked:bg-lime-50 has-checked:ring-lime-400">
        <input
          type="checkbox"
          name="paid"
          value="1"
          className="size-5 accent-lime-600"
        />
        <span className="flex-1 font-semibold">Paid already</span>
        {fee.cents > 0 && (
          <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-sm font-bold text-lime-800">
            {formatMoney(fee.cents, fee.currency)} cash
          </span>
        )}
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Pairing…" : "🤝 Pair up"}
      </Button>
    </form>
  );
}

/** Ranked: the pair's full entry, then receipts go out. */
function RankedPair({ openPlayId, fee, a, b, onSaved, onClose }: PairProps) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    pairUpSolos,
    { error: null },
  );
  const latest = useRef(onSaved);
  useEffect(() => {
    latest.current = onSaved;
  });
  useEffect(() => {
    if (state.done) latest.current();
  }, [state.done]);
  if (state.done) {
    return (
      <div className="flex flex-col gap-2">
        <Done state={state} />
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="openPlayId" value={openPlayId} />
      <input type="hidden" name="a_playerId" value={a} />
      <input type="hidden" name="b_playerId" value={b} />
      <EntryFields fee={fee} />
      <Done state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "🤝 Pair up & record entry"}
      </Button>
    </form>
  );
}
