"use client";

import { useState } from "react";

/** Share this page: the phone's share sheet, or copy the link. */
export function ShareLink({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      // Closing the share sheet rejects; nothing to do.
      await navigator.share({ title, url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex min-h-11 items-center rounded-2xl px-4 font-display font-semibold ring-2 ring-ink/10 hover:ring-fuchsia-300"
    >
      <span aria-hidden>🔗</span>&nbsp;
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
