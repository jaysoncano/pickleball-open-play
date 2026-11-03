"use client";

import { useEffect, useRef, useState } from "react";

/** The public watch link for an open play: courts, rankings, games. */
export function watchPath(openPlayId: string): string {
  return `/open-plays/${openPlayId}?view=courts`;
}

/** How long the "Link copied" popup stays up. */
const TOAST_MS = 8_000;

type Toast = {
  url: string;
  copied: boolean;
  /** The device has a share sheet (most phones). */
  canShare: boolean;
};

/**
 * Share the open play's public board. Tapping copies the link and pops up
 * a notification: paste it anywhere, or tap Share… for the phone's share
 * sheet. If copying isn't allowed, the popup shows the link to copy.
 */
export function ShareLink({
  openPlayId,
  className = "",
}: {
  openPlayId: string;
  className?: string;
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function close() {
    clearTimeout(timer.current);
    setToast(null);
  }

  async function copy() {
    const url = new URL(watchPath(openPlayId), window.location.origin).href;
    let copied = true;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      copied = false;
    }
    setToast({
      url,
      copied,
      canShare: typeof navigator.share === "function",
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  async function share(url: string) {
    // Keep the popup up while the share sheet is open.
    clearTimeout(timer.current);
    try {
      await navigator.share({ title: "Open play · watch live", url });
      close();
    } catch {
      // Closing the share sheet isn't a failure; the popup stays.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-2xl bg-sky-500 px-4 font-display font-semibold text-white shadow-[0_4px_0_0_#0369a1] transition-all hover:bg-sky-400 active:translate-y-[3px] active:shadow-[0_1px_0_0_#0369a1] ${className}`}
      >
        <span aria-hidden>🔗</span> Share
      </button>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="animate-pop-in fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-3xl bg-white p-4 text-left shadow-[0_20px_50px_-15px_rgba(14,116,144,0.55)] ring-2 ring-sky-300 motion-reduce:animate-none sm:right-4 sm:left-auto sm:mx-0"
        >
          <span
            aria-hidden
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl ${toast.copied ? "bg-lime-300" : "bg-amber-300"}`}
          >
            {toast.copied ? "✓" : "🔗"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight font-bold text-ink">
              {toast.copied ? "Link copied!" : "Copy this link"}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink/60">
              {toast.copied
                ? "Paste it in a chat or group, or share it with players so they can watch the courts, rankings, and games."
                : "Couldn't copy automatically. Select the link below to copy it."}
            </p>
            <input
              readOnly
              value={toast.url}
              aria-label="Watch link"
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 w-full truncate rounded-xl bg-sky-50 px-3 py-2 font-mono text-xs text-sky-900 ring-2 ring-sky-100 outline-none focus:ring-sky-400"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {toast.canShare && (
                <button
                  type="button"
                  onClick={() => share(toast.url)}
                  className="min-h-10 rounded-full bg-sky-500 px-4 font-display text-sm font-semibold text-white hover:bg-sky-400"
                >
                  📤 Share…
                </button>
              )}
              <a
                href={toast.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-full bg-ink/5 px-4 font-display text-sm font-semibold text-ink/70 hover:bg-ink/10"
              >
                Open ↗
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xl text-ink/50 hover:bg-ink/5"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
