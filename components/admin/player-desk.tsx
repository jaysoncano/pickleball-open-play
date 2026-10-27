"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { openPlaysOn } from "@/app/actions";
import { RankChip } from "@/components/open-plays/open-play-card";
import { QrModal } from "@/components/profile/qr-modal";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_INFO, type ProfileStatus } from "@/lib/profile/status";
import { nameKey } from "@/lib/queue/names";
import { dateInput } from "@/lib/queue/time";
import type { OpenPlay } from "@/lib/db/queries";
import { formatMoney } from "@/lib/registration/forms";
import { ranksLabel, spotsLeft, whenLabel } from "@/lib/registration/open-play";
import { useNow } from "@/lib/use-now";
import { DayList } from "./day-list";
import { RegisterForm } from "./register-form";

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
const SMALL_LINK =
  "inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold";

/** Today's date in the browser's time zone; "" while server-rendering. */
function useToday(): string {
  const now = useNow();
  return now ? dateInput(now) : "";
}

export function PlayerDesk({
  admin,
  players,
  currency,
  initialDate,
  initialOpenPlay,
}: {
  /** Admins see every player; hosts, the players of their open plays. */
  admin: boolean;
  players: DeskPlayer[];
  currency: string;
  /** From a "Register pairs" link: start on this date and open play. */
  initialDate?: string;
  initialOpenPlay?: string;
}) {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(initialDate ?? null);
  const date = picked ?? today;
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const [plays, setPlays] = useState<OpenPlay[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(initialOpenPlay ?? null);

  useEffect(() => {
    if (!date) return;
    let live = true;
    openPlaysOn(date)
      .then((p) => live && setPlays(p))
      .catch(() => live && setPlays([]));
    return () => {
      live = false;
    };
  }, [date, version]);

  const play =
    plays?.find((p) => p.id === chosen) ??
    (plays?.length === 1 ? plays[0] : undefined);
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [showing, setShowing] = useState<DeskPlayer | null>(null);
  const key = nameKey(query);
  const shown = players.filter(
    (p) =>
      (nameKey(p.name).includes(key) || nameKey(p.fullName).includes(key)) &&
      (!onlyPending || p.status !== "complete"),
  );
  const exact = players.some((p) => nameKey(p.name) === key);

  return (
    <>
      <label className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 px-4 py-3 font-display font-semibold ring-2 ring-white">
        Open play date
        <input
          type="date"
          value={date}
          onChange={(e) => {
            if (!e.target.value) return;
            setPicked(e.target.value);
            setChosen(null);
          }}
          className="min-h-11 rounded-xl bg-sky-50 px-3 ring-2 ring-sky-100 outline-none focus:ring-sky-400"
        />
        {picked && picked !== today && (
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setChosen(null);
            }}
            className="text-sm text-sky-700 underline"
          >
            Back to today
          </button>
        )}
      </label>

      {plays && (
        <section aria-labelledby="pick-title" className={CARD}>
          <h2 id="pick-title" className="mb-3 font-display text-2xl font-bold">
            <span aria-hidden>🏅</span> Which open play?
          </h2>
          {!admin && (
            <p className="-mt-2 mb-3 text-sm text-ink/55">
              Only the open plays you created or co-host. Their hosts are the
              only ones who can register, take payments, and check in here.
            </p>
          )}
          {plays.length === 0 ? (
            <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
              {admin
                ? `No open plays on ${date}.`
                : `No open plays you host on ${date}.`}{" "}
              <Link
                href="/open-plays/new"
                className="font-semibold text-fuchsia-600 underline"
              >
                Schedule one
              </Link>{" "}
              first.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {plays.map((p) => {
                const left = spotsLeft(p.maxPairs, p.pairCount);
                const on = p.id === play?.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setChosen(p.id)}
                      className={`flex w-full flex-col items-start gap-1 rounded-2xl p-3 text-left ring-2 transition-colors ${on ? "bg-fuchsia-50 ring-fuchsia-400" : "bg-white ring-ink/5 hover:ring-fuchsia-200"}`}
                    >
                      <RankChip play={p} />
                      <span className="font-display font-bold">
                        {whenLabel(p)}
                      </span>
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
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {play && (
        <>
          <RegisterForm
            key={play.id}
            openPlay={{
              id: play.id,
              label: [ranksLabel(play), whenLabel(play), play.venue]
                .filter(Boolean)
                .join(" · "),
            }}
            fee={{ cents: play.feeCents, currency }}
            known={players}
            onSaved={refresh}
          />
          <DayList
            openPlayId={play.id}
            fee={{ cents: play.feeCents, currency }}
            version={version}
            onSaved={refresh}
          />
        </>
      )}

      <section aria-labelledby="desk-title" className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="desk-title" className="font-display text-2xl font-bold">
            <span aria-hidden>🗂️</span> {admin ? "Everyone" : "Your players"} (
            {players.length})
          </h2>
          {admin && (
            <a
              href="/admin/qr-codes"
              className={`${SMALL_LINK} text-sm text-sky-700 hover:bg-sky-50`}
            >
              🖨️ Print QR cards
            </a>
          )}
        </div>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="desk-search" className="sr-only">
            Search players
          </label>
          <input
            id="desk-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
            className="min-h-12 flex-1 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400"
          />
          <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="size-5 accent-fuchsia-500"
            />
            Not complete only
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
            {key && !exact
              ? "No one by that name. Register them above as a new player."
              : "No players match."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((p) => {
              const info = STATUS_INFO[p.status];
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
                >
                  <Avatar name={p.name} src={p.photo} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {p.name}
                      {p.fullName && p.fullName !== p.name && (
                        <span className="ml-2 text-sm font-semibold text-ink/50">
                          {p.fullName}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink/50">
                      <span
                        className={`rounded-full px-2 py-px font-bold ${info.tone}`}
                      >
                        {info.label}
                      </span>
                      {p.hasEmail && !p.emailConfirmed && (
                        <span className="rounded-full bg-ink/5 px-2 py-px">
                          Email not confirmed
                        </span>
                      )}
                      {p.missing.join(" · ")}
                    </span>
                  </span>
                  <Link
                    href={`/players/${p.id}/edit`}
                    className={`${SMALL_LINK} bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowing(p)}
                    className={`${SMALL_LINK} ring-2 ring-ink/10 hover:ring-fuchsia-300`}
                  >
                    QR
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {showing && (
        <QrModal
          key={showing.id}
          playerId={showing.id}
          name={showing.name}
          onClose={() => setShowing(null)}
        />
      )}
    </>
  );
}
