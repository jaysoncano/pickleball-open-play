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
 * Why a pair can't join the queue yet, or null when it can: the host must
 * confirm its payment, and before the start both players must be checked
 * in. Once the open play is `live`, paid is enough.
 */
export function notReady(
  pair: Arrival,
  { live = false }: { live?: boolean } = {},
): string | null {
  if (!pair.paid) return "Not paid yet. Confirm the payment at the desk.";
  if (pair.blocked) return pair.blocked;
  if (live) return null;
  const away = pair.members.filter((m) => !m.checkedIn).map((m) => m.name);
  return away.length ? `Check in ${away.join(" & ")} first` : null;
}
