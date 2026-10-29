"use client";

import { useEffect, useState } from "react";
import { quickRegisterInfo } from "@/app/actions";
import { GuestForm } from "@/components/admin/guest-form";
import { DeskForms } from "@/components/admin/register-form";
import { Modal } from "@/components/ui/modal";

/**
 * Register a pair while the open play is live. Unpaid, they wait under
 * "Not in the queue yet"; once paid, they join the queue at the front.
 */
export function NewPairDialog({
  openPlayId,
  onSaved,
  onClose,
}: {
  openPlayId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [info, setInfo] =
    useState<Awaited<ReturnType<typeof quickRegisterInfo>>>();
  useEffect(() => {
    let live = true;
    quickRegisterInfo(openPlayId)
      .then((i) => live && setInfo(i))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [openPlayId]);

  return (
    <Modal
      wide
      title="New pair"
      eyebrow="Joins once paid"
      tone="from-lime-400 to-emerald-500"
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 overflow-y-auto p-3 sm:p-4">
        <p className="rounded-2xl bg-lime-50 px-3 py-2 text-sm text-lime-900 ring-2 ring-lime-100">
          Once they&apos;re paid, they join the queue on their own, at the
          front, so they get a game soon.
        </p>
        {info === undefined ? (
          <p className="text-ink/50">Loading…</p>
        ) : info === null ? (
          <p className="text-rose-600">Couldn&apos;t load this open play.</p>
        ) : info.kind === "regular" ? (
          <GuestForm
            openPlayId={openPlayId}
            fee={info.fee}
            levels={info.levels}
            onSaved={onSaved}
          />
        ) : (
          <DeskForms
            openPlayId={openPlayId}
            fee={info.fee}
            known={info.known}
            onSaved={onSaved}
          />
        )}
      </div>
    </Modal>
  );
}
