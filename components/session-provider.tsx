"use client";

import {
  createContext,
  use,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { saveOpenPlay } from "@/app/actions";
import type { QueueState } from "@/lib/queue/schema";

type Save = (state: QueueState) => Promise<unknown>;

type SessionStore = {
  /** The open play this live queue belongs to. */
  openPlayId: string;
  session: QueueState | null;
  /** Last failed save, shown until the next one succeeds. */
  saveError: string | null;
  /**
   * Apply a change now and save it in the background. Saves run one at a
   * time, in order. `save` replaces the default (e.g. to record a match).
   */
  update: (
    change: (state: QueueState, now: number) => QueueState,
    save?: (next: QueueState) => Promise<unknown>,
  ) => void;
  replace: (state: QueueState | null) => void;
};

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({
  openPlayId,
  initial,
  children,
}: {
  openPlayId: string;
  initial: QueueState | null;
  children: ReactNode;
}) {
  const [session, setSession] = useState(initial);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef(initial);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const enqueue = useCallback((run: () => Promise<unknown>) => {
    queue.current = queue.current.then(async () => {
      try {
        const result = await run();
        // Actions return false or an error message when nothing was saved.
        if (result === false || typeof result === "string") {
          setSaveError(
            typeof result === "string"
              ? result
              : "This session was ended elsewhere. Reload the page.",
          );
        } else {
          setSaveError(null);
        }
      } catch {
        setSaveError("Couldn't save. Check your connection, then reload.");
      }
    });
  }, []);

  const update = useCallback<SessionStore["update"]>(
    (change, save: Save = (next) => saveOpenPlay(openPlayId, next)) => {
      const current = latest.current;
      if (!current) return;
      const next = change(current, Date.now());
      if (next === current) return;
      latest.current = next;
      setSession(next);
      enqueue(() => save(next));
    },
    [enqueue, openPlayId],
  );

  const replace = useCallback((state: QueueState | null) => {
    latest.current = state;
    setSession(state);
  }, []);

  return (
    <SessionContext value={{ openPlayId, session, saveError, update, replace }}>
      {children}
    </SessionContext>
  );
}

export function useSessionStore(): SessionStore {
  const store = use(SessionContext);
  if (!store) throw new Error("useSessionStore needs a SessionProvider");
  return store;
}
