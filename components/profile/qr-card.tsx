import { NewQrButton } from "./qr-actions";
import { QrCode } from "./qr-code";

const CARD =
  "rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5";

/** Admin-only: the player's QR code to hand out or print. */
export function QrCard({
  playerId,
  name,
  token,
}: {
  playerId: string;
  name: string;
  token: string;
}) {
  return (
    <section aria-labelledby="qr-title" className={CARD}>
      <h2 id="qr-title" className="font-display text-2xl font-bold">
        <span aria-hidden>📱</span> Profile QR code
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Give this to {name}. They scan it, verify their email, then fill in
        their info and photo. Only admins see it.
      </p>
      <QrCode
        token={token}
        label={`QR code to edit ${name}'s profile`}
        className="mx-auto mt-3 w-48 rounded-2xl bg-white p-2"
      />
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <a
          href="/admin/qr-codes"
          className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-semibold text-sky-700 hover:bg-sky-50"
        >
          All QR codes
        </a>
        <NewQrButton playerId={playerId} name={name} />
      </div>
    </section>
  );
}
