"use client";

import { useEffect, useState } from "react";
import { profileSetup } from "@/app/actions";

export type SetupRow = Awaited<ReturnType<typeof profileSetup>>[number];

const REFRESH_MS = 20_000;

/**
 * Profile progress for the players in today's session. Refreshes while the
 * page is visible, so a player who just finished on their phone flips to
 * complete on the host's screen.
 */
export function useProfileSetup(playerIds: string[]): SetupRow[] {
  const [rows, setRows] = useState<SetupRow[]>([]);
  const key = [...playerIds].sort().join(",");

  useEffect(() => {
    let live = true;
    const ids = key ? key.split(",") : [];
    const load = () => {
      if (document.visibilityState !== "visible") return;
      profileSetup(ids)
        .then((r) => live && setRows(r))
        .catch(() => {}); // Keep the last list; the next tick retries.
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [key]);

  return rows;
}
