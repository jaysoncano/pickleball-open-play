"use client";

import type { QueueState } from "@/lib/queue/schema";
import { Dashboard } from "./dashboard/dashboard";
import { SessionProvider, useSessionStore } from "./session-provider";
import { SetupWizard, type OpenPlaySummary } from "./setup/setup-wizard";

/** The admin's view: run today's session, or set one up. */
/** The admin's view of one open play: run it, or set it up. */
export function App({
  openPlay,
  initial,
}: {
  openPlay: OpenPlaySummary;
  initial: QueueState | null;
}) {
  return (
    <SessionProvider openPlayId={openPlay.id} initial={initial}>
      <AdminView openPlay={openPlay} />
    </SessionProvider>
  );
}

function AdminView({ openPlay }: { openPlay: OpenPlaySummary }) {
  const { session } = useSessionStore();
  return session ? (
    <Dashboard session={session} ranks={openPlay.levels} />
  ) : (
    <SetupWizard openPlay={openPlay} />
  );
}
