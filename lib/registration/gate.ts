/**
 * The requested players who are registered for the day, in request order,
 * and how many requested ids aren't. Only registered players can join.
 */
export function pickRegistered<P extends { id: string }>(
  registered: P[],
  ids: string[],
): { players: P[]; unregistered: number } {
  const byId = new Map(registered.map((p) => [p.id, p]));
  const unique = [...new Set(ids)];
  const players = unique
    .map((id) => byId.get(id))
    .filter((p): p is P => p !== undefined);
  return { players, unregistered: unique.length - players.length };
}

/** What check-in needs to know about a pair. */
export type Arrival = {
  paid: boolean;
  /** Why it can't play this open play's ranks (see `rankProblem`). */
  blocked: string | null;
  members: { name: string; checkedIn: boolean }[];
};

/**
 * Why a pair can't join the queue yet, or null when it can: it must play
 * this open play's ranks, and both players must be checked in. The host
 * checking them in is the go-ahead; payment can come later (the dashboard
 * warns when an unpaid pair is on court).
 */
export function notReady(pair: Arrival): string | null {
  if (pair.blocked) return pair.blocked;
  const away = pair.members.filter((m) => !m.checkedIn).map((m) => m.name);
  return away.length ? `Check in ${away.join(" & ")} first` : null;
}
