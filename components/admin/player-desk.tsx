"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { openPlaysOn, registrationsFor } from "@/app/actions";
import { RankChip } from "@/components/open-plays/open-play-card";
import { QrModal } from "@/components/profile/qr-modal";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { STATUS_INFO, type ProfileStatus } from "@/lib/profile/status";
import { nameKey } from "@/lib/queue/names";
import { dateInput } from "@/lib/queue/time";
import type { OpenPlay } from "@/lib/db/queries";
import { formatMoney } from "@/lib/registration/forms";
import {
  KIND_INFO,
  ranksLabel,
  spotsLeft,
  whenLabel,
} from "@/lib/registration/open-play";
import { useNow } from "@/lib/use-now";
import { DeskTable, type Day } from "./desk-table";
import { GuestForm } from "./guest-form";
import { DeskForms } from "./register-form";
import { RegistrationNameForm } from "./registration-name-form";

export type DeskPlayer = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  photo: string | null;
  hasEmail: boolean;
  emailConfirmed: boolean;
  status: ProfileStatus;
  missing: string[];
};

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";
const SMALL =
  "inline-flex min-h-8 items-center rounded-lg px-2.5 text-sm font-semibold";

/** Today's date in the browser's time zone; "" while server-rendering. */
function useToday(): string {
  const now = useNow();
  return now ? dateInput(now) : "";
}

/** Step 1: pick the date and the open play; each one opens its own desk. */
export function OpenPlayPicker({
  admin,
  currency,
  initialDate,
}: {
  admin: boolean;
  currency: string;
  initialDate?: string;
}) {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(initialDate ?? null);
  const date = picked ?? today;
  const [plays, setPlays] = useState<OpenPlay[] | null>(null);

  useEffect(() => {
    if (!date) return;
    let live = true;
    openPlaysOn(date)
      .then((p) => live && setPlays(p))
      .catch(() => live && setPlays([]));
    return () => {
      live = false;
    };
  }, [date]);

  return (
    <section
      aria-labelledby="pick-title"
      className={`${CARD} flex flex-col gap-4`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pick-title" className="font-display text-2xl font-bold">
          <span aria-hidden>🏅</span> Which open play?
        </h2>
        <label className="flex flex-wrap items-center gap-2 font-display font-semibold">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
            className="min-h-11 rounded-xl bg-sky-50 px-3 ring-2 ring-sky-100 outline-none focus:ring-sky-400"
          />
          {picked && picked !== today && (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-sm text-sky-700 underline"
            >
              Today
            </button>
          )}
        </label>
      </div>
      {!plays ? (
        <p className="text-ink/50">Loading…</p>
      ) : plays.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          {admin
            ? `No open plays on ${date}.`
            : `No open plays you host on ${date}.`}{" "}
          <Link
            href="/open-plays/new"
            className="font-semibold text-fuchsia-600 underline"
          >
            Schedule one
          </Link>
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {plays.map((p) => {
            const left = spotsLeft(p.maxPairs, p.pairCount);
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/players?date=${date}&openPlay=${p.id}`}
                  className="flex h-full flex-col items-start gap-1 rounded-2xl bg-white p-3 ring-2 ring-ink/5 transition-colors hover:ring-fuchsia-300"
                >
                  <RankChip play={p} />
                  <span className="font-display font-bold">{whenLabel(p)}</span>
                  {p.venue && (
                    <span className="text-sm font-bold text-ink/70">
                      📍 {p.venue}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-ink/55">
                    {p.pairCount} pair{p.pairCount === 1 ? "" : "s"}
                    {left !== null && ` · ${left} left`} ·{" "}
                    {formatMoney(p.feeCents, currency)} per pair
                    {p.live && " · live"}
                  </span>
                  <span className="mt-1 font-display text-sm font-semibold text-fuchsia-600">
                    Open desk →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Step 2: one open play's desk. Left, register (tabs); right, everyone
 * signed up. Each column scrolls on its own, so the page doesn't.
 */
export function DeskWorkspace({
  admin,
  play,
  players,
  currency,
}: {
  admin: boolean;
  play: OpenPlay;
  players: DeskPlayer[];
  currency: string;
}) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  // The list, and the server's player list (new players, renamed ones).
  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    router.refresh();
  }, [router]);
  const [day, setDay] = useState<Day | null>(null);
  // Phones show one column at a time; from lg up both sit side by side.
  const [view, setView] = useState<"signup" | "list">("signup");
  const signedUp =
    (day?.pairs.length ?? 0) +
    (day?.pending.length ?? 0) +
    (day?.solos.length ?? 0);
  const fee = { cents: play.feeCents, currency };

  useEffect(() => {
    let live = true;
    registrationsFor(play.id)
      .then((d) => live && setDay(d))
      .catch(() => live && setDay({ pairs: [], pending: [], solos: [] }));
    return () => {
      live = false;
    };
  }, [play.id, version]);

  const collected = day?.pairs.reduce((n, p) => n + p.amountCents, 0) ?? 0;
  const left = spotsLeft(play.maxPairs, day?.pairs.length ?? play.pairCount);

  return (
    <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white/80 px-4 py-2 ring-2 ring-white">
        <Link
          href={`/admin/players?date=${play.playDate}`}
          className="font-display text-sm font-semibold text-sky-700 hover:underline"
        >
          ← Change
        </Link>
        <h1 className="order-first w-full min-w-0 font-display text-base font-bold sm:order-none sm:w-auto sm:flex-1 sm:text-xl">
          <span aria-hidden>🗂️</span>{" "}
          {[whenLabel(play), play.venue].filter(Boolean).join(" · ")}
          <span className="ml-2 align-middle text-sm font-semibold text-ink/55">
            {KIND_INFO[play.kind].label} · {ranksLabel(play)}
          </span>
        </h1>
        <p className="font-display text-sm font-bold tabular-nums text-ink/70">
          {day?.pairs.length ?? 0} paid · {day?.pending.length ?? 0} unpaid ·{" "}
          {formatMoney(collected, currency)}
          {left !== null && ` · ${left} spots left`}
        </p>
        {play.feeCents === 0 && (
          <Link
            href={`/open-plays/${play.id}/manage`}
            className="rounded-full bg-amber-100 px-3 py-1 font-display text-sm font-semibold text-amber-900 hover:bg-amber-200"
          >
            ⚠️ No entry fee set · Set it
          </Link>
        )}
      </header>
      <div
        role="tablist"
        aria-label="Desk"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-white/80 p-1 ring-2 ring-white lg:hidden"
      >
        {(
          [
            ["signup", "📝 Sign up"],
            ["list", `📋 List (${signedUp})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`min-h-10 rounded-xl font-display font-semibold ${view === v ? "bg-fuchsia-500 text-white shadow" : "text-ink/60"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div
          className={`lg:block lg:min-h-0 lg:overflow-y-auto ${view === "signup" ? "" : "hidden"}`}
        >
          {play.kind === "regular" ? (
            <section
              aria-label="Add a pair"
              className="flex flex-col gap-3 rounded-[2rem] bg-white/80 p-3 ring-2 ring-white backdrop-blur sm:p-4"
            >
              <h2 className="font-display text-lg font-bold">
                <span aria-hidden>➕</span> Add a pair
              </h2>
              <GuestForm
                openPlayId={play.id}
                fee={fee}
                levels={play.levels}
                onSaved={refresh}
              />
            </section>
          ) : (
            <DeskForms
              openPlayId={play.id}
              fee={fee}
              known={players}
              onSaved={refresh}
              players={
                <PlayerDirectory
                  admin={admin}
                  players={players}
                  onSaved={refresh}
                />
              }
            />
          )}
        </div>
        <div
          className={`lg:flex lg:min-h-0 lg:flex-col ${view === "list" ? "" : "hidden"}`}
        >
          <DeskTable
            openPlayId={play.id}
            kind={play.kind}
            live={play.live}
            day={day}
            fee={fee}
            onSaved={refresh}
          />
        </div>
      </div>
    </div>
  );
}

/** Find any player to edit their info or show their check-in QR. */
function PlayerDirectory({
  admin,
  players,
  onSaved,
}: {
  admin: boolean;
  players: DeskPlayer[];
  onSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [showing, setShowing] = useState<DeskPlayer | null>(null);
  const [editing, setEditing] = useState<DeskPlayer | null>(null);
  const key = nameKey(query);
  const shown = players.filter(
    (p) =>
      (nameKey(p.name).includes(key) || nameKey(p.fullName).includes(key)) &&
      (!onlyPending || p.status !== "complete"),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="desk-search" className="sr-only">
          Search players
        </label>
        <input
          id="desk-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${players.length} players…`}
          autoComplete="off"
          className="min-h-11 flex-1 rounded-2xl bg-sky-50 px-3 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
        <label className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-3 text-sm font-semibold ring-2 ring-ink/10">
          <input
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="size-5 accent-fuchsia-500"
          />
          Not complete
        </label>
      </div>
      {admin && (
        <a
          href="/admin/qr-codes"
          className={`${SMALL} self-start text-sky-700 hover:bg-sky-50`}
        >
          🖨️ Print QR cards
        </a>
      )}
      {shown.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-ink/15 p-4 text-center text-sm text-ink/50">
          No players match.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {shown.map((p) => {
            const info = STATUS_INFO[p.status];
            return (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5"
              >
                <Avatar name={p.name} src={p.photo} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {p.name}
                  </span>
                  <span className="flex flex-wrap items-center gap-1 text-[11px] font-semibold text-ink/50">
                    <span
                      className={`rounded-full px-1.5 font-bold ${info.tone}`}
                    >
                      {info.label}
                    </span>
                    {p.hasEmail && !p.emailConfirmed && "Email not confirmed"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className={`${SMALL} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowing(p)}
                  className={`${SMALL} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
                >
                  QR
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <Modal
          key={editing.id}
          title={editing.name}
          eyebrow="Registration names"
          onClose={() => setEditing(null)}
        >
          <div className="overflow-y-auto p-4">
            <RegistrationNameForm playerId={editing.id} onSaved={onSaved} />
          </div>
        </Modal>
      )}
      {showing && (
        <QrModal
          key={showing.id}
          playerId={showing.id}
          name={showing.name}
          onClose={() => setShowing(null)}
        />
      )}
    </div>
  );
}
