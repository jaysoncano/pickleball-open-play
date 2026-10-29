import {
  lineOf,
  nextPerLine,
  planByLine,
  queueGroups,
  takeGroup,
  takeOne,
} from "./ranks";
import {
  arrangeTeams,
  emptyHistory,
  recordGame,
  shuffle,
  type Rng,
} from "./matchmaking";
import { nameKey } from "./names";
import {
  DEFAULT_OVERTIME_MINUTES,
  firstError,
  OVERTIME_RANGE,
  PlayerNameSchema,
  type Court,
  type Player,
  type QueueState,
  type SessionSetup,
} from "./schema";
import { dayStart, rescheduleWindow, sessionWindow, timeOfDay } from "./time";

/** Match history kept per session; older games drop off. */
export const MATCH_HISTORY_LIMIT = 100;

export type IdFactory = () => string;

export const makeId: IdFactory = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function newCourt(
  number: number,
  id: IdFactory,
  rank: number | null = null,
): Court {
  return {
    id: id(),
    label: `Court ${number}`,
    playerIds: [],
    startedAt: null,
    stoppedAfterMs: null,
    rank,
  };
}

/**
 * A name gets a fresh id; a registered player (or pair) keeps their own,
 * with an optional skill rank for matchmaking.
 */
export type PlayerEntry = string | { id: string; name: string; skill?: number };

const entryName = (entry: PlayerEntry) =>
  typeof entry === "string" ? entry : entry.name;

function newPlayer(entry: PlayerEntry, now: number, id: IdFactory): Player {
  return typeof entry === "string"
    ? { id: id(), name: entry, gamesPlayed: 0, joinedAt: now }
    : { ...entry, gamesPlayed: 0, joinedAt: now };
}

function gamesPlayed(players: Record<string, Player>) {
  return Object.fromEntries(
    Object.values(players).map((p) => [p.id, p.gamesPlayed]),
  );
}

function skills(players: Record<string, Player>) {
  return Object.fromEntries(
    Object.values(players).flatMap((p) =>
      p.skill === undefined ? [] : [[p.id, p.skill]],
    ),
  );
}

export function capacity(state: QueueState): number {
  return state.config.playersPerCourt;
}

export type CourtStatus = "open" | "filling" | "ready" | "playing" | "paused";

/**
 * Ready means seated and waiting for someone to tap Start. Paused means a
 * game was started, then paused; it can resume, restart, finish, or cancel.
 */
export function courtStatus(court: Court, cap: number): CourtStatus {
  if (court.startedAt !== null) return "playing";
  if (court.playerIds.length === 0) return "open";
  if (court.stoppedAfterMs !== null) return "paused";
  return court.playerIds.length === cap ? "ready" : "filling";
}

function updateCourt(
  state: QueueState,
  courtId: string,
  change: Partial<Court>,
): QueueState {
  return {
    ...state,
    courts: state.courts.map((c) =>
      c.id === courtId ? { ...c, ...change } : c,
    ),
  };
}

function findCourt(state: QueueState, courtId: string) {
  return state.courts.find((c) => c.id === courtId);
}

function isFull(state: QueueState, court: Court) {
  return court.playerIds.length === capacity(state);
}

/**
 * Seat waiting players, first in line first. An empty court only takes a
 * full group, split into fresh teams, so nobody waits alone on a court. A
 * court that lost a player takes whoever is next, so the game can carry on.
 * Seating never starts the clock; that happens in `startGame`.
 */
export function fillCourts(
  state: QueueState,
  rng: Rng = Math.random,
): QueueState {
  const cap = capacity(state);
  const skill = skills(state.players);
  let queue = state.queue;
  const courts = state.courts.map((court) => {
    const missing = cap - court.playerIds.length;
    if (missing <= 0 || queue.length === 0) return court;
    if (court.playerIds.length === 0) {
      const next = takeGroup(queue, cap, skill, court.rank);
      if (!next) return court;
      queue = next.rest;
      return {
        ...court,
        playerIds: arrangeTeams(next.group, state.history, rng),
      };
    }
    // Fill the gap from the same line as whoever is already seated.
    const line = court.rank ?? lineOf(skill, court.playerIds[0]);
    const incoming: string[] = [];
    while (incoming.length < missing) {
      const next = takeOne(queue, skill, line);
      if (!next) break;
      incoming.push(next.id);
      queue = next.rest;
    }
    return { ...court, playerIds: [...court.playerIds, ...incoming] };
  });
  return { ...state, courts, queue };
}

export function createSession(
  setup: SessionSetup & {
    /** Ranked open play: each court's rank, in court order. */
    courtRanks?: (number | null)[];
  },
  names: PlayerEntry[],
  now: number,
  id: IdFactory = makeId,
  rng: Rng = Math.random,
): QueueState {
  const { date, courtRanks = [], ...rest } = setup;
  const config = { overtimeMinutes: DEFAULT_OVERTIME_MINUTES, ...rest };
  const players = names.map((name) => newPlayer(name, now, id));
  const history = emptyHistory();
  const state: QueueState = {
    version: 4,
    config,
    ...(date
      ? rescheduleWindow(config.startTime, config.endTime, dayStart(date))
      : sessionWindow(config.startTime, config.endTime, now)),
    players: Object.fromEntries(players.map((p) => [p.id, p])),
    queue: planByLine(
      players.map((p) => p.id),
      config.playersPerCourt,
      history,
      rng,
      {},
      skills(Object.fromEntries(players.map((p) => [p.id, p]))),
    ),
    courts: Array.from({ length: config.courtCount }, (_, i) =>
      newCourt(i + 1, id, courtRanks[i] ?? null),
    ),
    matches: [],
    history,
    nextCourtNumber: config.courtCount + 1,
  };
  return fillCourts(state, rng);
}

/**
 * Start the clock from 00:00 on a full court: a fresh start when ready, or
 * a restart when paused.
 */
export function startGame(
  state: QueueState,
  courtId: string,
  now: number,
): QueueState {
  const court = findCourt(state, courtId);
  if (!court || court.startedAt !== null || !isFull(state, court)) {
    return state;
  }
  return updateCourt(state, courtId, { startedAt: now, stoppedAfterMs: null });
}

/**
 * Pause a running game: the clock freezes and the court unlocks so players
 * can be changed. Nothing is recorded yet.
 */
export function pauseGame(
  state: QueueState,
  courtId: string,
  now: number,
): QueueState {
  const court = findCourt(state, courtId);
  if (!court || court.startedAt === null) return state;
  return updateCourt(state, courtId, {
    startedAt: null,
    stoppedAfterMs: Math.max(0, now - court.startedAt),
  });
}

/** Continue a paused game where its clock left off. Needs a full court. */
export function resumeGame(
  state: QueueState,
  courtId: string,
  now: number,
): QueueState {
  const court = findCourt(state, courtId);
  if (!court || court.stoppedAfterMs === null || court.startedAt !== null) {
    return state;
  }
  if (!isFull(state, court)) return state;
  return updateCourt(state, courtId, {
    startedAt: now - court.stoppedAfterMs,
    stoppedAfterMs: null,
  });
}

/**
 * Cancel a running or paused game: the clock is thrown away and nothing is
 * recorded. Players stay seated and the court is ready to start again.
 */
export function cancelGame(state: QueueState, courtId: string): QueueState {
  const court = findCourt(state, courtId);
  if (!court || (court.startedAt === null && court.stoppedAfterMs === null)) {
    return state;
  }
  return updateCourt(state, courtId, { startedAt: null, stoppedAfterMs: null });
}

type Spot =
  | { kind: "queue"; index: number }
  | { kind: "court"; courtId: string; slot: number; playing: boolean };

function locate(state: QueueState, playerId: string): Spot | null {
  const index = state.queue.indexOf(playerId);
  if (index !== -1) return { kind: "queue", index };
  for (const court of state.courts) {
    const slot = court.playerIds.indexOf(playerId);
    if (slot !== -1) {
      return {
        kind: "court",
        courtId: court.id,
        slot,
        playing: court.startedAt !== null,
      };
    }
  }
  return null;
}

function isSwappable(spot: Spot | null): spot is Spot {
  return spot !== null && !(spot.kind === "court" && spot.playing);
}

/**
 * Swap a seated player with anyone not in a running game: someone waiting
 * (they trade places in line too) or someone on a court that hasn't
 * started, including the same court to switch sides.
 */
export function swapPlayers(
  state: QueueState,
  seatedId: string,
  otherId: string,
): QueueState {
  const a = locate(state, seatedId);
  const b = locate(state, otherId);
  if (seatedId === otherId || a?.kind !== "court") return state;
  if (!isSwappable(a) || !isSwappable(b)) return state;

  const put = (spot: Spot, id: string, s: QueueState): QueueState => {
    if (spot.kind === "queue") {
      const queue = [...s.queue];
      queue[spot.index] = id;
      return { ...s, queue };
    }
    return {
      ...s,
      courts: s.courts.map((c) => {
        if (c.id !== spot.courtId) return c;
        const playerIds = [...c.playerIds];
        playerIds[spot.slot] = id;
        return { ...c, playerIds };
      }),
    };
  };
  return put(b, seatedId, put(a, otherId, state));
}

export type SwapCandidate = {
  id: string;
  name: string;
  gamesPlayed: number;
  /** 1-based spot in line, or the court they're seated on. */
  where: { kind: "queue"; position: number } | { kind: "court"; label: string };
};

/** Everyone a seated player could swap with: waiting first, then seated. */
export function swapCandidates(
  state: QueueState,
  seatedId: string,
): SwapCandidate[] {
  const candidate = (id: string, where: SwapCandidate["where"]) => ({
    id,
    name: state.players[id].name,
    gamesPlayed: state.players[id].gamesPlayed,
    where,
  });
  const waiting = state.queue.map((id, i) =>
    candidate(id, { kind: "queue", position: i + 1 }),
  );
  const seated = state.courts
    .filter((c) => c.startedAt === null)
    .flatMap((c) =>
      c.playerIds
        .filter((id) => id !== seatedId)
        .map((id) => candidate(id, { kind: "court", label: c.label })),
    );
  return [...waiting, ...seated];
}

/**
 * End a game. Who played whom is recorded, then the finishers rejoin the
 * line in random order and the line is re-planned so they mix with people
 * they haven't met yet. The group already shown as "up next" is kept, so
 * the preview players were promised still holds.
 */
export function finishGame(
  state: QueueState,
  courtId: string,
  now: number,
  rng: Rng = Math.random,
): QueueState {
  const court = findCourt(state, courtId);
  if (!court || court.playerIds.length === 0) return state;
  // A paused game counts the time it ran before the pause.
  const startedAt =
    court.startedAt ??
    (court.stoppedAfterMs === null ? null : now - court.stoppedAfterMs);
  if (startedAt === null) return state;

  const cap = capacity(state);
  const players = { ...state.players };
  for (const pid of court.playerIds) {
    players[pid] = {
      ...players[pid],
      gamesPlayed: players[pid].gamesPlayed + 1,
    };
  }
  const history = recordGame(state.history, court.playerIds);
  const matches = [
    ...state.matches,
    {
      courtLabel: court.label,
      playerIds: court.playerIds,
      playerNames: court.playerIds.map((pid) => players[pid].name),
      startedAt,
      endedAt: now,
    },
  ].slice(-MATCH_HISTORY_LIMIT);

  // Each line's next game stays put; everyone else is re-planned.
  const skill = skills(players);
  const locked = nextPerLine(state.queue, cap, skill);
  const rest = [
    ...state.queue.filter((pid) => !locked.includes(pid)),
    ...shuffle(court.playerIds, rng),
  ];

  return fillCourts(
    {
      ...state,
      players,
      matches,
      history,
      queue: [
        ...locked,
        ...planByLine(rest, cap, history, rng, gamesPlayed(players), skill),
      ],
      courts: state.courts.map((c) =>
        c.id === courtId
          ? { ...c, playerIds: [], startedAt: null, stoppedAfterMs: null }
          : c,
      ),
    },
    rng,
  );
}

export function isNameTaken(state: QueueState, name: string): boolean {
  const key = nameKey(name);
  return Object.values(state.players).some((p) => nameKey(p.name) === key);
}

export function addPlayers(
  state: QueueState,
  names: PlayerEntry[],
  now: number,
  id: IdFactory = makeId,
  rng: Rng = Math.random,
): QueueState {
  return add(state, names, now, id, rng, false);
}

/**
 * Pairs who paid after the start: they haven't played yet, so they go to
 * the front of the queue, keeping games balanced.
 */
export function addLatePairs(
  state: QueueState,
  names: PlayerEntry[],
  now: number,
  id: IdFactory = makeId,
  rng: Rng = Math.random,
): QueueState {
  return add(state, names, now, id, rng, true);
}

function add(
  state: QueueState,
  names: PlayerEntry[],
  now: number,
  id: IdFactory,
  rng: Rng,
  front: boolean,
): QueueState {
  const fresh = names
    .filter((e) => nameKey(entryName(e)) && !isNameTaken(state, entryName(e)))
    .map((e) => newPlayer(e, now, id));
  if (fresh.length === 0) return state;
  return fillCourts(
    {
      ...state,
      players: {
        ...state.players,
        ...Object.fromEntries(fresh.map((p) => [p.id, p])),
      },
      queue: front
        ? [...fresh.map((p) => p.id), ...state.queue]
        : [...state.queue, ...fresh.map((p) => p.id)],
    },
    rng,
  );
}

/**
 * Remove a player who left, wherever they are. On a court, the next person
 * in line takes their exact spot so teams stay on the same sides.
 */
export function removePlayer(
  state: QueueState,
  playerId: string,
  rng: Rng = Math.random,
): QueueState {
  if (!state.players[playerId]) return state;
  const players = { ...state.players };
  delete players[playerId];
  let queue = state.queue.filter((id) => id !== playerId);
  const courts = state.courts.map((court) => {
    const slot = court.playerIds.indexOf(playerId);
    if (slot === -1) return court;
    const playerIds = [...court.playerIds];
    if (queue.length > 0) {
      playerIds[slot] = queue[0];
      queue = queue.slice(1);
    } else {
      playerIds.splice(slot, 1);
    }
    return {
      ...court,
      playerIds,
      ...(playerIds.length === 0 && { startedAt: null, stoppedAfterMs: null }),
    };
  });
  return fillCourts({ ...state, players, courts, queue }, rng);
}

/** Why `name` can't be used for `playerId`, or null when it can. */
export function renameError(
  state: QueueState,
  playerId: string,
  name: string,
): string | null {
  const error = firstError(PlayerNameSchema.safeParse(name));
  if (error) return error;
  const key = nameKey(name);
  const taken = Object.values(state.players).some(
    (p) => p.id !== playerId && nameKey(p.name) === key,
  );
  return taken ? "Someone already has that name" : null;
}

/**
 * Fix a player's name. Past games show the new name too, so a typo
 * doesn't stick in history. Invalid or taken names are ignored.
 */
export function renamePlayer(
  state: QueueState,
  playerId: string,
  name: string,
): QueueState {
  const player = state.players[playerId];
  const clean = name.trim().replace(/\s+/g, " ");
  if (!player || clean === player.name) return state;
  if (renameError(state, playerId, clean)) return state;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, name: clean } },
    matches: state.matches.map((match) =>
      match.playerIds.includes(playerId)
        ? {
            ...match,
            playerNames: match.playerNames.map((n, i) =>
              match.playerIds[i] === playerId ? clean : n,
            ),
          }
        : match,
    ),
  };
}

/** Move a waiting player to a new spot in line (drag and drop). */
export function reorderQueue(
  state: QueueState,
  playerId: string,
  toIndex: number,
): QueueState {
  const from = state.queue.indexOf(playerId);
  const to = Math.min(Math.max(toIndex, 0), state.queue.length - 1);
  if (from === -1 || from === to) return state;
  const queue = [...state.queue];
  queue.splice(from, 1);
  queue.splice(to, 0, playerId);
  return { ...state, queue };
}

/** Move a waiting player one spot toward the front (-1) or back (+1). */
export function movePlayer(
  state: QueueState,
  playerId: string,
  direction: -1 | 1,
): QueueState {
  const from = state.queue.indexOf(playerId);
  if (from === -1) return state;
  return reorderQueue(state, playerId, from + direction);
}

export function addCourt(
  state: QueueState,
  id: IdFactory = makeId,
  rng: Rng = Math.random,
  rank: number | null = null,
): QueueState {
  return fillCourts(
    {
      ...state,
      courts: [...state.courts, newCourt(state.nextCourtNumber, id, rank)],
      nextCourtNumber: state.nextCourtNumber + 1,
    },
    rng,
  );
}

/**
 * Close a court. Its players were cut short, so they go to the front of
 * the line. The last court can't be closed.
 */
export function removeCourt(
  state: QueueState,
  courtId: string,
  rng: Rng = Math.random,
): QueueState {
  const court = state.courts.find((c) => c.id === courtId);
  if (!court || state.courts.length <= 1) return state;
  return fillCourts(
    {
      ...state,
      courts: state.courts.filter((c) => c.id !== courtId),
      queue: [...court.playerIds, ...state.queue],
    },
    rng,
  );
}

export function extendSession(state: QueueState, minutes: number): QueueState {
  const endsAt = Math.max(state.startsAt, state.endsAt + minutes * 60_000);
  return {
    ...state,
    endsAt,
    config: { ...state.config, endTime: timeOfDay(endsAt) },
  };
}

/**
 * Change start and end times mid-session. Keeps the session's day; an end
 * time earlier than the start means the session runs past midnight.
 */
export function editSchedule(
  state: QueueState,
  startTime: string,
  endTime: string,
): QueueState {
  if (startTime === endTime) return state;
  return {
    ...state,
    ...rescheduleWindow(startTime, endTime, state.startsAt),
    config: { ...state.config, startTime, endTime },
  };
}

/** Change when overtime alerts fire. Out-of-range values are clamped. */
export function setOvertimeLimit(
  state: QueueState,
  minutes: number,
): QueueState {
  const overtimeMinutes = Math.min(
    OVERTIME_RANGE.max,
    Math.max(OVERTIME_RANGE.min, Math.round(minutes)),
  );
  return { ...state, config: { ...state.config, overtimeMinutes } };
}

export type UpNext = {
  /** Next full group, seated on the first court that frees up. */
  next: string[];
  /** Following full groups, in order. */
  onDeck: string[][];
  /** Players still short of a full group. */
  remainder: string[];
};

export function upNext(state: QueueState): UpNext {
  const { groups, remainder } = queueGroups(
    state.queue,
    capacity(state),
    skills(state.players),
  );
  return { next: groups[0] ?? [], onDeck: groups.slice(1), remainder };
}

/**
 * Switch which rank a court plays. A court that's seated but not started
 * hands its group back to the front of the line and takes the new rank's
 * next game; a game in progress finishes first.
 */
export function setCourtRank(
  state: QueueState,
  courtId: string,
  rank: number | null,
  rng: Rng = Math.random,
): QueueState {
  const court = findCourt(state, courtId);
  if (!court || court.rank === rank) return state;
  const idle = court.startedAt === null && court.stoppedAfterMs === null;
  const released = idle ? court.playerIds : [];
  return fillCourts(
    {
      ...state,
      queue: [...released, ...state.queue],
      courts: state.courts.map((c) =>
        c.id === courtId
          ? { ...c, rank, playerIds: idle ? [] : c.playerIds }
          : c,
      ),
    },
    rng,
  );
}

export function stats(state: QueueState) {
  const cap = capacity(state);
  const statuses = state.courts.map((c) => courtStatus(c, cap));
  return {
    total: Object.keys(state.players).length,
    playing: state.courts.reduce((n, c) => n + c.playerIds.length, 0),
    waiting: state.queue.length,
    games: state.matches.length,
    openCourts: statuses.filter((s) => s === "open").length,
    readyCourts: statuses.filter((s) => s === "ready").length,
  };
}
