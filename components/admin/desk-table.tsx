"use client";

import { useState } from "react";
import type { registrationsFor } from "@/app/actions";
import { LevelBadge } from "@/components/level-badge";
import { Avatar } from "@/components/ui/avatar";
import { photoUrl } from "@/lib/profile/forms";
import {
  DESK_FILTERS,
  deskRows,
  FILTER_LABEL,
  filterCounts,
  filterRows,
  randomPartner,
  rowMembers,
  type DeskFilter,
  type DeskRow,
} from "@/lib/registration/desk";
import {
  formatMoney,
  METHOD_LABEL,
  pairLevel,
  pairName,
} from "@/lib/registration/forms";
import type { OpenPlayKind } from "@/lib/registration/open-play";
import { INPUT, type Fee } from "./entry-fields";
import { PairModal, PayButton, stamp } from "./pair-modal";
import { PairAllModal } from "./pair-all-modal";
import { SoloPairModal } from "./solo-pair-modal";

export type Day = Awaited<ReturnType<typeof registrationsFor>>;
export type Member = Day["solos"][number];

const CHIP =
  "min-h-8 rounded-full px-2.5 font-display text-sm font-semibold ring-2 transition-colors";
const SMALL =
  "inline-flex min-h-8 items-center rounded-lg px-2.5 text-sm font-semibold ring-2 ring-ink/10 hover:ring-fuchsia-300";
const MARK_PAID =
  "inline-flex min-h-8 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap bg-lime-300 text-lime-950 ring-2 ring-lime-500 hover:bg-lime-200";
const BADGE =
  "rounded-full px-2 py-px text-[11px] font-black tracking-wide uppercase";

/** Everyone signed up for an open play, filterable, one row per pair. */
export function DeskTable({
  openPlayId,
  kind,
  live,
  day,
  fee,
  onSaved,
}: {
  openPlayId: string;
  kind: OpenPlayKind;
  /** The open play is running (no check-in anymore). */
  live: boolean;
  /** null while loading. */
  day: Day | null;
  fee: Fee;
  onSaved: () => void;
}) {
  const [filter, setFilter] = useState<DeskFilter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  // A solo being paired, and the partner "Random partner" drew for them.
  const [pairingAll, setPairingAll] = useState(false);
  const [pairing, setPairing] = useState<{
    solo: string;
    partner?: string;
  } | null>(null);
  const rows = day ? deskRows(day) : [];
  const counts = filterCounts(rows);
  const shown = filterRows(rows, filter, query);
  const solos = day?.solos ?? [];
  // Look the row up on each render, so the popup shows fresh data.
  const open = rows.find((r) => r.id === editing);
  const pairingSolo = solos.find((s) => s.playerId === pairing?.solo);

  // In the table's header row (and above the cards on phones), only with
  // more than two solos (two pair from either row) and solos in view.
  const pairAllButton = solos.length > 2 &&
    (filter === "all" || filter === "solo") && (
      <button
        type="button"
        onClick={() => setPairingAll(true)}
        className="inline-flex min-h-8 items-center rounded-full bg-violet-500 px-3 font-display text-xs font-semibold tracking-normal whitespace-nowrap text-white normal-case shadow-[0_3px_0_0_#6d28d9] hover:bg-violet-400"
      >
        🎲 Pair all solos ({solos.length})
      </button>
    );

  function pairWith(solo: string, random: boolean) {
    setPairing({
      solo,
      partner: random
        ? randomPartner(solos, solo, Math.random)?.playerId
        : undefined,
    });
  }

  return (
    <section
      aria-label="Players signed up"
      className="flex min-h-0 flex-col gap-2 rounded-[2rem] bg-white/80 p-3 ring-2 ring-white backdrop-blur sm:p-4 lg:flex-1"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div
          role="group"
          aria-label="Show"
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible"
        >
          {DESK_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`${CHIP} shrink-0 ${filter === f ? "bg-fuchsia-500 text-white ring-fuchsia-600" : "bg-white ring-ink/10 hover:ring-fuchsia-300"}`}
            >
              {FILTER_LABEL[f]}{" "}
              <span className="tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label htmlFor="desk-filter-search" className="sr-only">
          Search the list
        </label>
        <input
          id="desk-filter-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names or notes…"
          autoComplete="off"
          className={`${INPUT} min-h-9 min-w-40 flex-1 text-sm`}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-white ring-2 ring-ink/5">
        {!day ? (
          <p className="p-6 text-center text-ink/50">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-ink/50">
            {rows.length === 0
              ? "No one signed up yet. Register the first pair."
              : "No one matches."}
          </p>
        ) : (
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="sticky top-0 z-10 bg-white text-[11px] font-bold tracking-wide text-ink/50 uppercase">
              <tr className="border-b-2 border-ink/5">
                <th scope="col" className="px-3 py-2">
                  Players
                </th>
                <th scope="col" className="px-3 py-2">
                  Payment
                </th>
                <th scope="col" className="px-3 py-2">
                  Notes
                </th>
                <th scope="col" className="px-3 py-1.5 text-right">
                  <span className="sr-only">Actions</span>
                  {pairAllButton}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  fee={fee}
                  kind={kind}
                  live={live}
                  onPair={(random) => pairWith(row.id, random)}
                  onEdit={() => setEditing(row.id)}
                  onSaved={onSaved}
                />
              ))}
            </tbody>
          </table>
        )}
        {day && shown.length > 0 && (
          <ul className="md:hidden">
            {pairAllButton && (
              <li className="flex justify-end border-b border-ink/5 px-3 py-2">
                {pairAllButton}
              </li>
            )}
            {shown.map((row) => (
              <Card
                key={row.id}
                row={row}
                fee={fee}
                kind={kind}
                live={live}
                onPair={(random) => pairWith(row.id, random)}
                onEdit={() => setEditing(row.id)}
                onSaved={onSaved}
              />
            ))}
          </ul>
        )}
      </div>

      {pairingAll && (
        <PairAllModal
          kind={kind}
          openPlayId={openPlayId}
          fee={fee}
          solos={solos}
          onSaved={onSaved}
          onClose={() => setPairingAll(false)}
        />
      )}
      {pairingSolo && (
        <SoloPairModal
          key={pairingSolo.playerId}
          kind={kind}
          openPlayId={openPlayId}
          fee={fee}
          solo={pairingSolo}
          solos={solos}
          initialPartner={pairing?.partner}
          onSaved={onSaved}
          onClose={() => setPairing(null)}
        />
      )}
      {open && (
        <PairModal
          key={open.id}
          row={open}
          fee={fee}
          kind={kind}
          onSaved={onSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

const TINT: Record<DeskRow["kind"], string> = {
  unpaid: "bg-rose-50/60",
  paid: "",
  solo: "bg-sky-50/50",
};

type RowProps = {
  row: DeskRow;
  /** Running: check-in is over, so its status isn't shown. */
  live: boolean;
  fee: Fee;
  kind: OpenPlayKind;
  /** Solo rows: find a partner, at random or by picking. */
  onPair: (random: boolean) => void;
  onEdit: () => void;
  onSaved: () => void;
};

/** A table row, from tablet width up. */
function Row(props: RowProps) {
  const { row, fee, live } = props;
  return (
    <tr className={`border-b border-ink/5 align-middle ${TINT[row.kind]}`}>
      <td className="px-3 py-1.5">
        <People members={rowMembers(row)} checkIn={!live} />
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <Payment row={row} fee={fee} />
      </td>
      <td className="max-w-48 px-3 py-1.5">
        {row.notes ? (
          <span className="line-clamp-2 text-ink/75" title={row.notes}>
            {row.notes}
          </span>
        ) : (
          <span className="text-ink/30">—</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <Actions {...props} />
      </td>
    </tr>
  );
}

/** The same row as a card, on phones. */
function Card(props: RowProps) {
  const { row, fee, live } = props;
  return (
    <li
      className={`flex flex-col gap-2 border-b border-ink/5 px-3 py-2.5 ${TINT[row.kind]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <People members={rowMembers(row)} checkIn={!live} />
        <div className="shrink-0 text-right">
          <Payment row={row} fee={fee} />
        </div>
      </div>
      {row.notes && (
        <p className="rounded-lg bg-white/70 px-2 py-1 text-sm text-ink/75">
          📝 {row.notes}
        </p>
      )}
      <Actions {...props} />
    </li>
  );
}

function Actions({ row, fee, kind, onPair, onEdit, onSaved }: RowProps) {
  const names = pairName(rowMembers(row).map((m) => m.name));
  return (
    <div className="flex items-center justify-end gap-2">
      {row.kind === "unpaid" && (
        <PayButton
          kind={kind}
          pairId={row.id}
          names={names}
          notes={row.notes}
          fee={fee}
          onSaved={onSaved}
          className={MARK_PAID}
        />
      )}
      {row.kind === "solo" && (
        <>
          <button
            type="button"
            onClick={() => onPair(true)}
            className={`${SMALL} bg-violet-100 text-violet-800 ring-violet-200 hover:ring-violet-400`}
          >
            🎲 Random partner
          </button>
          <button
            type="button"
            onClick={() => onPair(false)}
            className={`${SMALL} bg-white`}
          >
            Pick partner
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${names}`}
        className={`${SMALL} bg-white`}
      >
        Edit
      </button>
    </div>
  );
}

/** Paid or unpaid, with the date and time it happened. */
function Payment({ row, fee }: { row: DeskRow; fee: Fee }) {
  if (row.kind === "solo") {
    return (
      <span className={`${BADGE} bg-sky-100 text-sky-800`}>Needs partner</span>
    );
  }
  return (
    <>
      <span className="flex items-center gap-1.5">
        {row.kind === "paid" ? (
          <>
            <span className={`${BADGE} bg-lime-400 text-lime-950`}>Paid</span>
            <span className="font-bold tabular-nums">
              {formatMoney(row.pair.amountCents, fee.currency)}
            </span>
            <span className="text-xs font-semibold text-ink/50">
              {METHOD_LABEL[row.pair.method]}
            </span>
          </>
        ) : (
          <span className={`${BADGE} bg-rose-500 text-white`}>Unpaid</span>
        )}
      </span>
      <span className="block text-xs font-semibold text-ink/50 tabular-nums">
        {stamp.format(row.pair.createdAt)}
      </span>
    </>
  );
}

/** `checkIn`: show check-in status (only before the start). */
function People({ members, checkIn }: { members: Member[]; checkIn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex shrink-0 -space-x-2">
        {members.map((m) => (
          <Avatar
            key={m.playerId}
            name={m.name}
            src={photoUrl(m.playerId, m.photoUpdatedAt)}
            size="sm"
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-bold">
          {pairName(members.map((m) => m.name))}
        </span>
        <span className="flex flex-wrap items-center gap-1">
          <LevelBadge
            level={pairLevel(members.map((m) => m.level))}
            size="sm"
          />
          {checkIn && <CheckedIn members={members} />}
        </span>
      </span>
    </div>
  );
}

/** Checked in as a pair: "✓ Here" once both are in. */
function CheckedIn({ members }: { members: Member[] }) {
  const title = "Check-in at the venue, before the start: both players arrived";
  return members.every((m) => m.checkedIn) ? (
    <span
      title={title}
      className="rounded-full bg-lime-200 px-1.5 text-[11px] font-bold text-lime-900"
    >
      ✓ Checked in
    </span>
  ) : (
    <span
      title={title}
      className="rounded-full bg-ink/5 px-1.5 text-[11px] font-bold text-ink/55"
    >
      ○ Not checked in
    </span>
  );
}
