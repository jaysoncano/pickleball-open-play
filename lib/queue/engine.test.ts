import { describe, expect, it } from "vitest";
import {
  addCourt,
  addPlayers,
  courtStatus,
  createSession,
  editSchedule,
  extendSession,
  finishGame,
  isNameTaken,
  makeId,
  MATCH_HISTORY_LIMIT,
  movePlayer,
  removeCourt,
  removePlayer,
  renameError,
  renamePlayer,
  reorderQueue,
  startGame,
  stats,
  pauseGame,
  resumeGame,
  cancelGame,
  swapCandidates,
  swapPlayers,
  upNext,
} from "./engine";
import { pairKey } from "./matchmaking";
import type { QueueState, SessionConfig } from "./schema";

const NOW = new Date(2026, 9, 23, 17, 0).getTime();
/** Always picks the first option, so results are predictable. */
const zero = () => 0;

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

function session(
  names: string[],
  overrides: Partial<SessionConfig> = {},
): QueueState {
  return createSession(
    {
      startTime: "18:00",
      endTime: "21:00",
      courtCount: 2,
      playersPerCourt: 4,
      ...overrides,
    },
    names,
    NOW,
    ids(),
    zero,
  );
}

const names = (state: QueueState, pids: string[]) =>
  pids.map((id) => state.players[id].name);

const ten = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const twelve = [...ten, "K", "L"];

/** Start then finish a court. Court ids follow player ids. */
function playGame(state: QueueState, courtId: string, at = NOW) {
  return finishGame(startGame(state, courtId, at), courtId, at + 600_000, zero);
}

describe("createSession", () => {
  it("seats full groups as ready, waiting for a manual start", () => {
    const s = session(ten);
    expect(names(s, s.courts[0].playerIds)).toEqual(["A", "B", "C", "D"]);
    expect(names(s, s.courts[1].playerIds)).toEqual(["E", "F", "G", "H"]);
    expect(names(s, s.queue)).toEqual(["I", "J"]);
    expect(s.courts[0].startedAt).toBeNull();
    expect(courtStatus(s.courts[0], 4)).toBe("ready");
    expect(s.courts.map((c) => c.label)).toEqual(["Court 1", "Court 2"]);
    expect(s.nextCourtNumber).toBe(3);
  });

  it("leaves a court empty rather than seating a partial group", () => {
    const s = session(["A", "B", "C", "D", "E", "F"]);
    expect(s.courts[1].playerIds).toEqual([]);
    expect(names(s, s.queue)).toEqual(["E", "F"]);
  });

  it("supports singles", () => {
    const s = session(["A", "B", "C"], { playersPerCourt: 2, courtCount: 1 });
    expect(names(s, s.courts[0].playerIds)).toEqual(["A", "B"]);
    expect(names(s, s.queue)).toEqual(["C"]);
  });

  it("works with default ids and randomness", () => {
    const s = createSession(
      {
        startTime: "18:00",
        endTime: "19:00",
        courtCount: 1,
        playersPerCourt: 4,
      },
      ["A", "B", "C", "D", "E"],
      NOW,
    );
    expect(Object.keys(s.players)).toHaveLength(5);
    expect(s.courts[0].playerIds).toHaveLength(4);
    expect(makeId()).not.toBe(makeId());
  });
  it("seats pairs of similar skill against each other", () => {
    const s = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      [
        { id: "strong1", name: "Ana & Ben", skill: 3 },
        { id: "weak1", name: "Cy & Dee", skill: 0 },
        { id: "strong2", name: "Eve & Fin", skill: 3 },
      ],
      NOW,
      ids(),
      zero,
    );
    expect(s.courts[0].playerIds).toEqual(["strong1", "strong2"]);
    expect(s.players.strong1.skill).toBe(3);
    // After the game, skill still steers the re-plan.
    const after = finishGame(
      startGame(s, s.courts[0].id, NOW),
      s.courts[0].id,
      NOW + 600_000,
      zero,
    );
    expect(after.players.weak1.skill).toBe(0);
  });

  it("keeps the ids of registered players", () => {
    const s = createSession(
      {
        startTime: "18:00",
        endTime: "21:00",
        courtCount: 1,
        playersPerCourt: 2,
      },
      [
        { id: "p-ana", name: "Ana" },
        { id: "p-ben", name: "Ben" },
      ],
      NOW,
      ids(),
      zero,
    );
    expect(s.courts[0].playerIds).toEqual(["p-ana", "p-ben"]);
    const more = addPlayers(s, [{ id: "p-cy", name: "Cy" }, "Ana"], NOW);
    expect(more.queue).toEqual(["p-cy"]);
    expect(more.players["p-cy"].name).toBe("Cy");
  });

  it("starts on a chosen date and keeps it out of the config", () => {
    const s = session(ten, { date: "2026-11-02" } as Partial<SessionConfig>);
    expect(s.startsAt).toBe(new Date(2026, 10, 2, 18).getTime());
    expect(s.endsAt).toBe(new Date(2026, 10, 2, 21).getTime());
    expect(s.config).not.toHaveProperty("date");
  });

  it("defaults to the next window without a date", () => {
    expect(session(ten).startsAt).toBe(new Date(2026, 9, 23, 18).getTime());
  });
});

describe("courtStatus", () => {
  const court = {
    id: "c",
    label: "Court",
    playerIds: [],
    startedAt: null,
    stoppedAfterMs: null,
    rank: null,
  };

  it("covers every state", () => {
    expect(courtStatus(court, 4)).toBe("open");
    expect(courtStatus({ ...court, playerIds: ["a"] }, 4)).toBe("filling");
    expect(courtStatus({ ...court, playerIds: ["a", "b"] }, 2)).toBe("ready");
    expect(courtStatus({ ...court, playerIds: ["a"], startedAt: 1 }, 2)).toBe(
      "playing",
    );
  });
});

describe("startGame", () => {
  it("starts the clock on a ready court", () => {
    const s = startGame(session(ten), "id11", NOW + 5000);
    expect(s.courts[0].startedAt).toBe(NOW + 5000);
    expect(courtStatus(s.courts[0], 4)).toBe("playing");
  });

  it("ignores courts that are unknown, already playing, or not full", () => {
    const s = startGame(session(["A", "B", "C", "D"]), "id5", NOW);
    expect(startGame(s, "id5", NOW + 1)).toBe(s);
    expect(startGame(s, "id6", NOW)).toBe(s);
    expect(startGame(s, "nope", NOW)).toBe(s);
  });
});

describe("pause, resume, restart, cancel", () => {
  const paused = () =>
    pauseGame(startGame(session(ten), "id11", NOW), "id11", NOW + 284_000);

  it("pausing freezes the clock and unlocks the court", () => {
    const s = paused();
    expect(s.courts[0]).toMatchObject({
      startedAt: null,
      stoppedAfterMs: 284_000,
    });
    expect(courtStatus(s.courts[0], 4)).toBe("paused");
    expect(s.matches).toEqual([]);
    expect(s.players.id1.gamesPlayed).toBe(0);
    expect(stats(s).readyCourts).toBe(1);
  });

  it("resumes where the clock left off", () => {
    const s = resumeGame(paused(), "id11", NOW + 600_000);
    expect(s.courts[0]).toMatchObject({
      startedAt: NOW + 600_000 - 284_000,
      stoppedAfterMs: null,
    });
    expect(courtStatus(s.courts[0], 4)).toBe("playing");
  });

  it("restarts from 00:00 after a player change", () => {
    const changed = swapPlayers(paused(), "id2", "id9");
    expect(names(changed, changed.courts[0].playerIds)).toEqual([
      "A",
      "I",
      "C",
      "D",
    ]);
    const s = startGame(changed, "id11", NOW + 400_000);
    expect(s.courts[0]).toMatchObject({
      startedAt: NOW + 400_000,
      stoppedAfterMs: null,
    });
  });

  it("finishing while paused records the time played before the pause", () => {
    const s = finishGame(paused(), "id11", NOW + 900_000, zero);
    expect(s.matches[0]).toMatchObject({
      startedAt: NOW + 900_000 - 284_000,
      endedAt: NOW + 900_000,
    });
    expect(s.players.id1.gamesPlayed).toBe(1);
  });

  it("cancelling throws the game away and leaves the court ready", () => {
    const fromPause = cancelGame(paused(), "id11");
    expect(fromPause.courts[0]).toMatchObject({
      startedAt: null,
      stoppedAfterMs: null,
    });
    expect(courtStatus(fromPause.courts[0], 4)).toBe("ready");
    const playing = startGame(session(ten), "id11", NOW);
    expect(cancelGame(playing, "id11").courts[0].startedAt).toBeNull();
    expect(fromPause.matches).toEqual([]);
  });

  it("needs a full court to resume or restart", () => {
    let s = session(["A", "B"], { playersPerCourt: 2, courtCount: 1 });
    s = pauseGame(startGame(s, "id3", NOW), "id3", NOW + 5);
    s = removePlayer(s, "id1");
    expect(courtStatus(s.courts[0], 2)).toBe("paused");
    expect(resumeGame(s, "id3", NOW + 9)).toBe(s);
    expect(startGame(s, "id3", NOW + 9)).toBe(s);
    s = removePlayer(s, "id2");
    expect(s.courts[0]).toMatchObject({ playerIds: [], stoppedAfterMs: null });
  });

  it("ignores courts in the wrong state", () => {
    const s = session(ten);
    expect(pauseGame(s, "id11", NOW)).toBe(s);
    expect(pauseGame(s, "nope", NOW)).toBe(s);
    expect(resumeGame(s, "id11", NOW)).toBe(s);
    expect(resumeGame(s, "nope", NOW)).toBe(s);
    expect(cancelGame(s, "id11")).toBe(s);
    expect(cancelGame(s, "nope")).toBe(s);
    const playing = startGame(s, "id11", NOW);
    expect(resumeGame(playing, "id11", NOW)).toBe(playing);
  });
});

describe("swapPlayers", () => {
  it("trades a seated player with a waiting one, spot for spot", () => {
    const s = swapPlayers(session(ten), "id2", "id10");
    expect(names(s, s.courts[0].playerIds)).toEqual(["A", "J", "C", "D"]);
    expect(names(s, s.queue)).toEqual(["I", "B"]);
  });

  it("trades between two courts that haven't started", () => {
    const s = swapPlayers(session(ten), "id1", "id8");
    expect(names(s, s.courts[0].playerIds)).toEqual(["H", "B", "C", "D"]);
    expect(names(s, s.courts[1].playerIds)).toEqual(["E", "F", "G", "A"]);
  });

  it("switches sides on the same court", () => {
    const s = swapPlayers(session(ten), "id2", "id3");
    expect(names(s, s.courts[0].playerIds)).toEqual(["A", "C", "B", "D"]);
  });

  it("never touches a running game", () => {
    const playing = startGame(session(ten), "id11", NOW);
    expect(swapPlayers(playing, "id1", "id9")).toBe(playing);
    expect(swapPlayers(playing, "id5", "id1")).toBe(playing);
  });

  it("needs a seated player and a different, known partner", () => {
    const s = session(ten);
    expect(swapPlayers(s, "id9", "id1")).toBe(s);
    expect(swapPlayers(s, "id1", "id1")).toBe(s);
    expect(swapPlayers(s, "id1", "nope")).toBe(s);
  });
});

describe("swapCandidates", () => {
  it("lists waiting players, then players on courts that haven't started", () => {
    const s = startGame(session(twelve), "id14", NOW);
    const list = swapCandidates(s, "id1");
    expect(list.map((c) => c.name)).toEqual([
      "I",
      "J",
      "K",
      "L",
      "B",
      "C",
      "D",
    ]);
    expect(list[0]).toEqual({
      id: "id9",
      name: "I",
      gamesPlayed: 0,
      where: { kind: "queue", position: 1 },
    });
    expect(list[4].where).toEqual({ kind: "court", label: "Court 1" });
  });
});

describe("finishGame", () => {
  it("only finishes a game that was started", () => {
    const s = session(ten);
    expect(finishGame(s, "id11", NOW)).toBe(s);
    expect(finishGame(s, "nope", NOW)).toBe(s);
  });

  it("records who met and mixes finishers with fresh players", () => {
    const s = playGame(session(ten), "id11");
    // Every pair from A–D just met, so the next group pairs the two
    // waiting players with only two of them, split into fresh teams.
    expect(names(s, s.courts[0].playerIds)).toEqual(["I", "J", "B", "C"]);
    expect(names(s, s.queue)).toEqual(["D", "A"]);
    expect(s.courts[0].startedAt).toBeNull();
    expect(s.players.id1.gamesPlayed).toBe(1);
    expect(s.history.teammates[pairKey("id1", "id2")]).toBe(1);
    expect(s.history.opponents[pairKey("id1", "id3")]).toBe(1);
    expect(s.matches).toEqual([
      {
        courtLabel: "Court 1",
        playerIds: ["id1", "id2", "id3", "id4"],
        playerNames: ["A", "B", "C", "D"],
        startedAt: NOW,
        endedAt: NOW + 600_000,
      },
    ]);
  });

  it("keeps the group already shown as up next", () => {
    const s = playGame(session(twelve), "id13");
    expect(names(s, s.courts[0].playerIds)).toEqual(["I", "J", "K", "L"]);
    expect(names(s, s.queue)).toEqual(["B", "C", "D", "A"]);
  });

  it("caps match history", () => {
    let s = session(["A", "B", "C", "D"], { courtCount: 1 });
    for (let i = 0; i < MATCH_HISTORY_LIMIT + 5; i++) {
      s = playGame(s, "id5", NOW + i);
    }
    expect(s.matches).toHaveLength(MATCH_HISTORY_LIMIT);
  });

  it("uses real randomness by default", () => {
    const started = startGame(session(ten), "id11", NOW);
    const s = finishGame(started, "id11", NOW + 1);
    expect(s.courts[0].playerIds).toHaveLength(4);
    expect(s.queue).toHaveLength(2);
  });
});

describe("renamePlayer", () => {
  it("fixes a name and tidies spaces", () => {
    const s = renamePlayer(session(ten), "id9", "  Ivan   Cruz ");
    expect(s.players.id9.name).toBe("Ivan Cruz");
    expect(s.queue).toEqual(session(ten).queue);
  });

  it("updates past games so history shows the new name", () => {
    const played = playGame(session(ten), "id11");
    const s = renamePlayer(played, "id1", "Ana");
    expect(s.matches[0].playerNames).toEqual(["Ana", "B", "C", "D"]);
    expect(renamePlayer(played, "id9", "Ivan").matches).toEqual(played.matches);
  });

  it("ignores blank, taken, unchanged, and unknown names", () => {
    const s = session(ten);
    expect(renamePlayer(s, "id9", "   ")).toBe(s);
    expect(renamePlayer(s, "id9", "b")).toBe(s);
    expect(renamePlayer(s, "id9", "I")).toBe(s);
    expect(renamePlayer(s, "nope", "Zed")).toBe(s);
  });

  it("explains why a name can't be used", () => {
    const s = session(ten);
    expect(renameError(s, "id9", "")).toBe("Enter a name");
    expect(renameError(s, "id9", " a ")).toBe("Someone already has that name");
    expect(renameError(s, "id9", "i")).toBeNull();
    expect(renameError(s, "id9", "x".repeat(31))).toMatch(/under 30/);
  });
});

describe("removePlayer", () => {
  it("removes a waiting player", () => {
    const s = removePlayer(session(ten), "id9", zero);
    expect(names(s, s.queue)).toEqual(["J"]);
    expect(s.players.id9).toBeUndefined();
  });

  it("puts the next in line into the exact spot that opened", () => {
    const started = startGame(session(ten), "id11", NOW);
    const s = removePlayer(started, "id2", zero);
    expect(names(s, s.courts[0].playerIds)).toEqual(["A", "I", "C", "D"]);
    expect(s.courts[0].startedAt).toBe(NOW);
    expect(names(s, s.queue)).toEqual(["J"]);
  });

  it("leaves a gap when nobody is waiting, and resets an emptied court", () => {
    let s = session(["A", "B"], { playersPerCourt: 2, courtCount: 1 });
    s = startGame(s, "id3", NOW);
    s = removePlayer(s, "id1", zero);
    expect(names(s, s.courts[0].playerIds)).toEqual(["B"]);
    expect(courtStatus(s.courts[0], 2)).toBe("playing");
    s = removePlayer(s, "id2");
    expect(s.courts[0]).toMatchObject({ playerIds: [], startedAt: null });
  });

  it("ignores unknown players", () => {
    const s = session(ten);
    expect(removePlayer(s, "nope")).toBe(s);
  });
});

describe("addPlayers", () => {
  it("queues new players and seats them when a group fills", () => {
    let s = session(["A", "B", "C", "D", "E", "F"]);
    s = addPlayers(s, ["G", "H", "I"], NOW, makeId, zero);
    expect(names(s, s.courts[1].playerIds)).toEqual(["E", "F", "G", "H"]);
    expect(names(s, s.queue)).toEqual(["I"]);
  });

  it("lets a late arrival fill a gap on a court mid-game", () => {
    let s = session(["A", "B"], { playersPerCourt: 2, courtCount: 1 });
    s = removePlayer(startGame(s, "id3", NOW), "id1", zero);
    s = addPlayers(s, ["C"], NOW, () => "c", zero);
    expect(names(s, s.courts[0].playerIds)).toEqual(["B", "C"]);
    expect(s.courts[0].startedAt).toBe(NOW);
  });

  it("skips blank and duplicate names", () => {
    const s = session(ten);
    expect(addPlayers(s, ["a", "  ", "B "], NOW)).toBe(s);
    expect(isNameTaken(s, " j ")).toBe(true);
    expect(isNameTaken(s, "Zed")).toBe(false);
  });
});

describe("reorderQueue", () => {
  const sixteen = [...twelve, "M", "N", "O", "P"];

  it("moves a player to any spot in line", () => {
    const s = session(sixteen);
    // Queue starts I, J, K, L, M, N, O, P.
    const back = reorderQueue(s, "id9", 5);
    expect(names(back, back.queue)).toEqual([
      "J",
      "K",
      "L",
      "M",
      "N",
      "I",
      "O",
      "P",
    ]);
    const front = reorderQueue(s, "id16", 0);
    expect(names(front, front.queue)).toEqual([
      "P",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
    ]);
  });

  it("clamps out-of-range targets", () => {
    const s = session(sixteen);
    const last = reorderQueue(s, "id9", 99);
    expect(names(last, last.queue).at(-1)).toBe("I");
    const first = reorderQueue(s, "id16", -3);
    expect(names(first, first.queue)[0]).toBe("P");
  });

  it("ignores seated players and no-op moves", () => {
    const s = session(sixteen);
    expect(reorderQueue(s, "id1", 0)).toBe(s);
    expect(reorderQueue(s, "id9", 0)).toBe(s);
  });
});

describe("movePlayer", () => {
  it("swaps with a neighbor", () => {
    const s = movePlayer(session(ten), "id10", -1);
    expect(names(s, s.queue)).toEqual(["J", "I"]);
  });

  it("ignores moves past either end or for seated players", () => {
    const s = session(ten);
    expect(movePlayer(s, "id9", -1)).toBe(s);
    expect(movePlayer(s, "id10", 1)).toBe(s);
    expect(movePlayer(s, "id1", 1)).toBe(s);
  });
});

describe("courts", () => {
  it("adds a numbered court and fills it", () => {
    let s = session(["A", "B", "C", "D", "E", "F", "G", "H"], {
      courtCount: 1,
    });
    s = addCourt(s, () => "court-x", zero);
    expect(s.courts[1]).toMatchObject({ id: "court-x", label: "Court 2" });
    expect(names(s, s.courts[1].playerIds)).toEqual(["E", "F", "G", "H"]);
    expect(s.nextCourtNumber).toBe(3);
    expect(addCourt(s).courts).toHaveLength(3);
  });

  it("closing a court puts its players at the front of the line", () => {
    const s = removeCourt(session(ten), "id12", zero);
    expect(s.courts).toHaveLength(1);
    expect(names(s, s.queue)).toEqual(["E", "F", "G", "H", "I", "J"]);
  });

  it("keeps the last court and ignores unknown courts", () => {
    const one = session(["A", "B", "C", "D"], { courtCount: 1 });
    expect(removeCourt(one, one.courts[0].id)).toBe(one);
    const two = session(ten);
    expect(removeCourt(two, "nope")).toBe(two);
  });
});

describe("extendSession", () => {
  it("moves the end time but never before the start", () => {
    const s = session(ten);
    const later = extendSession(s, 30);
    expect(later.endsAt).toBe(s.endsAt + 30 * 60_000);
    expect(later.config.endTime).toBe("21:30");
    expect(extendSession(s, -9999).endsAt).toBe(s.startsAt);
  });
});

describe("editSchedule", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m).getTime();

  it("changes start and end on the same day", () => {
    const s = editSchedule(session(ten), "17:30", "23:00");
    expect(s.config).toMatchObject({ startTime: "17:30", endTime: "23:00" });
    expect(s.startsAt).toBe(at(17, 30));
    expect(s.endsAt).toBe(at(23));
  });

  it("supports ending after midnight and rejects equal times", () => {
    const s = session(ten);
    const late = editSchedule(s, "18:00", "00:30");
    expect(late.endsAt - late.startsAt).toBe(6.5 * 3_600_000);
    expect(editSchedule(s, "19:00", "19:00")).toBe(s);
  });
});

describe("upNext and stats", () => {
  it("groups the queue into next, on deck, and remainder", () => {
    const s = session([...twelve, "M", "N", "O", "P", "Q", "R", "S"]);
    const preview = upNext(s);
    expect(names(s, preview.next)).toEqual(["I", "J", "K", "L"]);
    expect(preview.onDeck.map((g) => names(s, g))).toEqual([
      ["M", "N", "O", "P"],
    ]);
    expect(names(s, preview.remainder)).toEqual(["Q", "R", "S"]);
  });

  it("returns an empty next group when the line is short", () => {
    expect(upNext(session(ten))).toMatchObject({ next: [], onDeck: [] });
  });

  it("summarizes the session", () => {
    const s = session(["A", "B", "C", "D", "E"]);
    expect(stats(s)).toEqual({
      total: 5,
      playing: 4,
      waiting: 1,
      games: 0,
      openCourts: 1,
      readyCourts: 1,
    });
    expect(stats(startGame(s, "id6", NOW)).readyCourts).toBe(0);
  });
});
