"use client";

import { useEffect, useState } from "react";
import { playerQrCode } from "@/app/actions";
import { Modal } from "@/components/ui/modal";

/** Full-screen-ish QR for a player to scan from the host's phone. */
export function QrModal({
  playerId,
  name,
  onClose,
}: {
  playerId: string;
  name: string;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<{ svg: string } | null | undefined>();

  useEffect(() => {
    let live = true;
    playerQrCode(playerId)
      .then((r) => live && setQr(r))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [playerId]);

  return (
    <Modal
      eyebrow="Scan with your phone camera"
      title={name}
      onClose={onClose}
      tone="from-fuchsia-400 to-sky-500"
    >
      <div className="flex flex-col items-center gap-3 p-5 text-center">
        {qr === undefined && <p className="py-20 text-ink/50">Loading…</p>}
        {qr === null && (
          <p role="alert" className="py-20 font-semibold text-rose-600">
            Couldn&apos;t load the QR code. Try again.
          </p>
        )}
        {qr && (
          <div
            role="img"
            aria-label={`QR code for ${name}`}
            className="aspect-square w-full max-w-72 rounded-2xl bg-white p-2 ring-2 ring-ink/5 [&>svg]:size-full"
            // SVG generated on the server by the qrcode library.
            dangerouslySetInnerHTML={{ __html: qr.svg }}
          />
        )}
        <p className="text-sm text-ink/60">
          Verify your email, then add your full name and photo. Takes a minute.
        </p>
      </div>
    </Modal>
  );
}
