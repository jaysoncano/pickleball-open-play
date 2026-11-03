"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { entryFee, registrationsFor } from "@/app/actions";
import { People, type Day } from "@/components/admin/desk-table";
import type { Fee } from "@/components/admin/entry-fields";
import {
  MarkUnpaid,
  PairModal,
  PayButton,
  stamp,
} from "@/components/admin/pair-modal";
import {
  deskRows,
  paymentTotals,
  rowMembers,
  type DeskRow,
} from "@/lib/registration/desk";
import { formatMoney, METHOD_LABEL, pairName } from "@/lib/registration/forms";
import type { OpenPlayKind } from "@/lib/registration/open-play";

const REFRESH_MS = 20_000;
const CARD =
  "flex min-w-0 flex-col rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
const SMALL =
  "inline-flex min-h-9 items-center rounded-lg bg-white px-3 text-sm font-semibold whitespace-nowrap ring-2 ring-ink/10 hover:ring-fuchsia-300";
const MARK_PAID =
  "inline-flex min-h-9 items-center rounded-lg bg-lime-300 px-3 text-sm font-semibold whitespace-nowrap text-lime-950 ring-2 ring-lime-500 hover:bg-lime-200";

type PairRow = Extract<DeskRow, { kind: "paid" | "unpaid" }>;
type Info = NonNullable<Awaited<ReturnType<typeof entryFee>>>;

/**
 * The Payments tab: what this open play has collected and what it's still
 * owed, then the paid and the unpaid pairs side by side, each with its
 * actions (mark paid or unpaid, notes, edit). The only place the app
 * shows money totals.
 */
export function PaymentsPanel({
  openPlayId,
  active,
  onChanged,
}: {
  openPlayId: string;
  /** The tab is showing: keep it fresh while it is. */
  active: boolean;
  /** A payment changed: the dashboard refreshes its badge and reminders. */
  onChanged: () => void;
}) {
  const [day, setDay] = useState<Day | null>(null);
  const [info, setInfo] = useState<Info | null | undefined>();
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    registrationsFor(openPlayId)
      .then(setDay)
      .catch(() => setDay((d) => d ?? { pairs: [], pending: [], solos: [] }));
  }, [openPlayId]);

  useEffect(() => {
    let live = true;
    entryFee(openPlayId)
      .then((f) => live && setInfo(f))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [openPlayId]);

  // Load and keep fresh while the tab is open.
  useEffect(() => {
    if (!active) return;
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load, active]);

  if (info === null) {
    return (
      <p className={`${CARD} text-rose-600`}>
        Couldn&apos;t load this open play.
      </p>
    );
  }
  if (!day || !info) {
    return <p className={`${CARD} text-ink/50`}>Loading payments…</p>;
  }

  const { fee, kind } = info;
  function saved() {
    load();
    onChanged();
  }
  const totals = paymentTotals(day, fee.cents);
  const rows = deskRows(day).filter((r): r is PairRow => r.kind !== "solo");
  const paid = rows.filter((r) => r.kind === "paid");
  const unpaid = rows.filter((r) => r.kind === "unpaid");
  const open = rows.find((r) => r.id === editing);
  const table = {
    fee,
    kind,
    onSaved: saved,
    onEdit: setEditing,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Widget
          label="Total amount"
          amount={formatMoney(totals.totalCents, fee.currency)}
          detail={`${totals.totalCount} pair${totals.totalCount === 1 ? "" : "s"} · paid + unpaid`}
          emoji="💰"
          tone="from-sky-400 to-violet-500 text-white"
        >
          <Collected paid={totals.paidCents} total={totals.totalCents} />
        </Widget>
        <Widget
          label="Total paid"
          amount={formatMoney(totals.paidCents, fee.currency)}
          detail={`${totals.paidCount} pair${totals.paidCount === 1 ? "" : "s"} paid`}
          emoji="✅"
          tone="from-lime-300 to-emerald-400 text-emerald-950"
        />
        <Widget
          label="Total unpaid"
          amount={formatMoney(totals.unpaidCents, fee.currency)}
          detail={`${totals.unpaidCount} pair${totals.unpaidCount === 1 ? "" : "s"} · ${formatMoney(fee.cents, fee.currency)} each`}
          emoji="⏳"
          tone="from-rose-400 to-fuchsia-500 text-white"
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <PairTable
          {...table}
          title="Paid"
          rows={paid}
          empty="No one has paid yet."
          accent="bg-lime-400 text-lime-950"
        />
        <PairTable
          {...table}
          title="Unpaid"
          rows={unpaid}
          empty="✓ Everyone's paid."
          accent="bg-rose-500 text-white"
        />
      </div>

      {open && (
        <PairModal
          key={open.id}
          row={open}
          fee={fee}
          kind={kind}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Widget({
  label,
  amount,
  detail,
  emoji,
  tone,
  children,
}: {
  label: string;
  amount: string;
  detail: string;
  emoji: string;
  tone: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br p-5 shadow-[0_10px_30px_-12px_rgba(36,28,71,0.35)] ${tone}`}
    >
      <span
        aria-hidden
        className="absolute -top-2 -right-1 text-6xl opacity-25 select-none"
      >
        {emoji}
      </span>
      <p className="text-xs font-black tracking-widest uppercase opacity-80">
        {label}
      </p>
      <p className="font-display text-4xl font-bold tabular-nums">{amount}</p>
      <p className="text-sm font-semibold opacity-80">{detail}</p>
      {children}
    </section>
  );
}

/** How much of the total is in: a bar and a percentage. */
function Collected({ paid, total }: { paid: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((paid / total) * 100);
  return (
    <div className="mt-3 flex items-center gap-2">
      <div
        role="progressbar"
        aria-label="Collected"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25"
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs font-black tabular-nums">
        {percent}% collected
      </span>
    </div>
  );
}

function PairTable({
  title,
  rows,
  empty,
  accent,
  fee,
  kind,
  onSaved,
  onEdit,
}: {
  title: string;
  rows: PairRow[];
  empty: string;
  /** The count chip's colors. */
  accent: string;
  fee: Fee;
  kind: OpenPlayKind;
  onSaved: () => void;
  onEdit: (id: string) => void;
}) {
  const id = `payments-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={CARD}>
      <h2
        id={id}
        className="mb-3 flex items-center gap-2 font-display text-2xl font-bold"
      >
        {title}
        <span
          className={`rounded-full px-2.5 text-base tabular-nums ${accent}`}
        >
          {rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-ink/60">{empty}</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs font-bold tracking-wide text-ink/50 uppercase">
              <tr className="border-b border-ink/10">
                <th className="px-4 py-2 sm:pl-5">Pair</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Notes</th>
                <th className="px-4 py-2 text-right sm:pr-5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  fee={fee}
                  kind={kind}
                  onSaved={onSaved}
                  onEdit={() => onEdit(row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({
  row,
  fee,
  kind,
  onSaved,
  onEdit,
}: {
  row: PairRow;
  fee: Fee;
  kind: OpenPlayKind;
  onSaved: () => void;
  onEdit: () => void;
}) {
  const names = pairName(rowMembers(row).map((m) => m.name));
  return (
    <tr className="border-b border-ink/5 align-middle last:border-0">
      <td className="px-4 py-2 sm:pl-5">
        <People members={rowMembers(row)} checkIn={false} />
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        {row.kind === "paid" ? (
          <>
            <span className="block font-bold tabular-nums">
              {formatMoney(row.pair.amountCents, fee.currency)}
            </span>
            <span className="block text-xs font-semibold text-ink/50">
              {METHOD_LABEL[row.pair.method]} ·{" "}
              {stamp.format(row.pair.createdAt)}
            </span>
          </>
        ) : (
          <>
            <span className="block font-bold text-rose-700 tabular-nums">
              {formatMoney(fee.cents, fee.currency)}
            </span>
            <span className="block text-xs font-semibold text-ink/50">
              Signed up {stamp.format(row.pair.createdAt)}
            </span>
          </>
        )}
      </td>
      <td className="max-w-44 px-2 py-2">
        {row.notes ? (
          <span className="line-clamp-2 text-ink/75" title={row.notes}>
            📝 {row.notes}
          </span>
        ) : (
          <span className="text-ink/30">—</span>
        )}
      </td>
      <td className="px-4 py-2 sm:pr-5">
        <div className="flex items-center justify-end gap-2">
          {row.kind === "unpaid" ? (
            <PayButton
              kind={kind}
              pairId={row.id}
              names={names}
              notes={row.notes}
              fee={fee}
              onSaved={onSaved}
              className={MARK_PAID}
            />
          ) : (
            kind === "regular" && (
              <MarkUnpaid pairId={row.id} names={names} onSaved={onSaved} />
            )
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Notes and more for ${names}`}
            className={SMALL}
          >
            📝 Notes
          </button>
        </div>
      </td>
    </tr>
  );
}
