"use client";

import Link from "next/link";
import { useState } from "react";
import { QrModal } from "@/components/profile/qr-modal";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_INFO } from "@/lib/profile/status";
import type { SetupRow } from "./use-profile-setup";

const ORDER = { new: 0, verified: 1, complete: 2 } as const;

/**
 * Check-in helper: today's players by profile progress. "Show QR" puts a
 * player's code on this screen for them to scan while they wait.
 */
export function ProfilesPanel({ rows }: { rows: SetupRow[] }) {
  const [showing, setShowing] = useState<SetupRow | null>(null);
  const sorted = [...rows].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name),
  );
  const done = rows.filter((r) => r.status === "complete").length;

  return (
    <section
      aria-labelledby="profiles-title"
      className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="profiles-title" className="font-display text-2xl font-bold">
            Player profiles
          </h2>
          <p className="text-sm text-ink/60">
            While players wait, tap <b>Show QR</b> and let them scan it. No
            phone or data? Tap <b>Edit</b> and fill it in for them.
          </p>
        </div>
        <p className="font-display text-lg font-bold tabular-nums">
          {done} / {rows.length} complete
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-ink/15 p-6 text-center text-ink/50">
          No players in today&apos;s session yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sorted.map((r) => {
            const info = STATUS_INFO[r.status];
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-3 py-2"
              >
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name}</span>
                  {r.missing.length > 0 && (
                    <span className="block text-xs font-semibold text-ink/50">
                      {r.missing.join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${info.tone}`}
                >
                  <span aria-hidden>{info.icon}</span> {info.label}
                </span>
                <Link
                  href={`/players/${r.id}/edit`}
                  className="inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold ring-2 ring-ink/10 hover:ring-fuchsia-300"
                >
                  Edit
                </Link>
                {r.status !== "complete" && (
                  <button
                    type="button"
                    onClick={() => setShowing(r)}
                    className="min-h-11 rounded-2xl bg-fuchsia-500 px-4 font-display font-semibold text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400 active:translate-y-[3px] active:shadow-[0_1px_0_0_#a21caf]"
                  >
                    Show QR
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <a
        href="/admin/qr-codes"
        className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:underline"
      >
        Print QR cards →
      </a>
      {showing && (
        <QrModal
          key={showing.id}
          playerId={showing.id}
          name={showing.name}
          onClose={() => setShowing(null)}
        />
      )}
    </section>
  );
}
