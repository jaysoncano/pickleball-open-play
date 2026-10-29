"use client";

import { useState, useTransition } from "react";
import { pairAllRegularSolos, pairUpSolos } from "@/app/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { photoUrl } from "@/lib/profile/forms";
import { shufflePairs } from "@/lib/registration/desk";
import { formatMoney } from "@/lib/registration/forms";
import type { OpenPlayKind } from "@/lib/registration/open-play";
import type { Member } from "./desk-table";
import { EntryFields, type Fee } from "./entry-fields";

/**
 * "Pair all solos": every solo paired at random, previewed first. Shuffle
 * until it looks right, then pair them all. With an odd count, one waits.
 */
export function PairAllModal({
  kind,
  openPlayId,
  fee,
  solos,
  onSaved,
  onClose,
}: {
  kind: OpenPlayKind;
  openPlayId: string;
  fee: Fee;
  solos: Member[];
  onSaved: () => void;
  onClose: () => void;
}) {
  // Held players sit this round out: not shuffled, not paired.
  const [held, setHeld] = useState<string[]>([]);
  const [draw, setDraw] = useState(() => shufflePairs(solos, Math.random));
  // Bumped on every draw, so the new pairs pop in visibly.
  const [round, setRound] = useState(0);
  const heldPlayers = solos.filter((s) => held.includes(s.playerId));

  function reshuffle(nextHeld = held) {
    setDraw(
      shufflePairs(
        solos.filter((s) => !nextHeld.includes(s.playerId)),
        Math.random,
      ),
    );
    setRound((r) => r + 1);
  }

  function hold(playerId: string, on: boolean) {
    const next = on
      ? [...held, playerId]
      : held.filter((id) => id !== playerId);
    setHeld(next);
    reshuffle(next);
  }
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<number | null>(null);
  const [busy, start] = useTransition();

  function pairAll(data: FormData) {
    setError(null);
    start(async () => {
      const couples = draw.pairs.map(
        ([a, b]) => [a.playerId, b.playerId] as [string, string],
      );
      if (kind === "regular") {
        const r = await pairAllRegularSolos(
          openPlayId,
          couples,
          data.get("paid") === "1",
        );
        setMade(r.made);
        setError(r.error);
      } else {
        // Ranked: the same entry for each pair; each gets its receipts.
        let count = 0;
        for (const [a, b] of couples) {
          const one = new FormData();
          for (const [k, v] of data) one.set(k, v);
          one.set("openPlayId", openPlayId);
          one.set("a_playerId", a);
          one.set("b_playerId", b);
          const r = await pairUpSolos({ error: null }, one);
          if (r.error) {
            setError(r.error);
            break;
          }
          count++;
        }
        setMade(count);
      }
      onSaved();
    });
  }

  return (
    <Modal
      wide
      title="Pair all solos"
      eyebrow={`${solos.length} solo players`}
      tone="from-violet-500 to-fuchsia-500"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 overflow-y-auto p-4">
        {made !== null ? (
          <>
            <p
              role="status"
              className={`rounded-2xl px-4 py-3 font-semibold ${error ? "bg-amber-100 text-amber-900" : "bg-lime-100 text-lime-900"}`}
            >
              ✓ Paired {made} pair{made === 1 ? "" : "s"}.
              {error && ` Stopped: ${error}`}
            </p>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display font-semibold">
                Preview · {draw.pairs.length} pair
                {draw.pairs.length === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={() => reshuffle()}
                className="min-h-9 rounded-full bg-violet-100 px-3 text-sm font-bold text-violet-700 hover:bg-violet-200"
              >
                🎲 Shuffle
              </button>
            </div>
            {draw.pairs.length === 0 && (
              <p className="rounded-2xl border-2 border-dashed border-ink/15 p-4 text-center text-sm text-ink/55">
                Fewer than two players left to pair. Include someone from On
                hold.
              </p>
            )}
            <ol className="-m-1 flex max-h-72 flex-col gap-1.5 overflow-y-auto p-1">
              {draw.pairs.map(([a, b], i) => (
                <li
                  key={`${round}-${i}`}
                  className="animate-pop-in flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-2 ring-fuchsia-100 motion-reduce:animate-none"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 font-display text-sm font-black text-fuchsia-700">
                    {i + 1}
                  </span>
                  <Person m={a} onHold={() => hold(a.playerId, true)} />
                  <span aria-hidden className="text-ink/30">
                    &amp;
                  </span>
                  <Person m={b} onHold={() => hold(b.playerId, true)} />
                </li>
              ))}
            </ol>
            {draw.left && (
              <p
                key={`left-${round}`}
                className="animate-pop-in flex flex-wrap items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-2 ring-sky-100 motion-reduce:animate-none"
              >
                <span className="flex-1">
                  🙋 <b>{draw.left.name}</b> waits for a partner (odd number).
                </span>
                <HoldButton
                  name={draw.left.name}
                  onClick={() => hold(draw.left!.playerId, true)}
                />
              </p>
            )}
            {heldPlayers.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-2xl bg-amber-50 p-3 ring-2 ring-amber-100">
                <p className="text-sm font-bold text-amber-900">
                  ⏸ On hold · left out of this round
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {heldPlayers.map((m) => (
                    <li key={m.playerId}>
                      <button
                        type="button"
                        onClick={() => hold(m.playerId, false)}
                        aria-label={`Include ${m.name} again`}
                        className="flex min-h-9 items-center gap-1.5 rounded-full bg-white py-1 pr-3 pl-1 text-sm font-semibold ring-2 ring-amber-200 hover:ring-amber-400"
                      >
                        <Avatar
                          name={m.name}
                          src={photoUrl(m.playerId, m.photoUpdatedAt)}
                          size="sm"
                        />
                        {m.name}
                        <span className="text-xs font-bold text-amber-700">
                          ▶ Include
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form action={pairAll} className="flex flex-col gap-2">
              {kind === "regular" ? (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white px-3 ring-2 ring-ink/10 has-checked:bg-lime-50 has-checked:ring-lime-400">
                  <input
                    type="checkbox"
                    name="paid"
                    value="1"
                    className="size-5 accent-lime-600"
                  />
                  <span className="flex-1 font-semibold">All paid already</span>
                  {fee.cents > 0 && (
                    <span className="rounded-full bg-lime-100 px-2.5 py-0.5 text-sm font-bold text-lime-800">
                      {formatMoney(fee.cents, fee.currency)} each
                    </span>
                  )}
                </label>
              ) : (
                <EntryFields fee={fee} />
              )}
              {error && (
                <p role="alert" className="text-sm font-semibold text-rose-600">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || draw.pairs.length === 0}>
                {busy ? "Pairing…" : `🤝 Pair them all (${draw.pairs.length})`}
              </Button>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}

function Person({ m, onHold }: { m: Member; onHold: () => void }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <Avatar
        name={m.name}
        src={photoUrl(m.playerId, m.photoUpdatedAt)}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate font-bold">{m.name}</span>
      <HoldButton name={m.name} onClick={onHold} />
    </span>
  );
}

/** Leave a player out of this round of pairing. */
function HoldButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Hold ${name} out of this round`}
      title="Hold: leave out of this round"
      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-amber-700 ring-2 ring-amber-200 hover:bg-amber-50"
    >
      ⏸ Hold
    </button>
  );
}
