"use client";

import { useCallback, useEffect, useState } from "react";
import { rosterFor } from "@/app/actions";

const REFRESH_MS = 20_000;

/**
 * This open play's unpaid pair ids, kept fresh: for the Payments badge and
 * the "unpaid pair on court" reminders. `count` is undefined until loaded.
 */
export function useUnpaidPairs(openPlayId: string) {
  const [unpaid, setUnpaid] = useState<ReadonlySet<string> | null>(null);

  const reload = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    rosterFor(openPlayId)
      .then((r) =>
        setUnpaid(new Set(r.filter((p) => !p.paid).map((p) => p.id))),
      )
      .catch(() => setUnpaid((u) => u ?? new Set()));
  }, [openPlayId]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    document.addEventListener("visibilitychange", reload);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [reload]);

  return {
    unpaid: unpaid ?? new Set<string>(),
    count: unpaid?.size,
    reload,
  };
}
