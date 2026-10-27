# Spec: Queue Engine

Source: `lib/queue/`. All functions are pure: `(state, …) => newState`.

## State (`QueueStateSchema`, version 4)

| Field                 | Meaning                                                         |
| --------------------- | --------------------------------------------------------------- |
| `config`              | start/end time, court count, players per court                  |
| `startsAt` / `endsAt` | absolute session window (ms)                                    |
| `players`             | unit id → name, games played, optional `skill` (pairs)          |
| `queue`               | waiting player ids, in play order                               |
| `courts`              | id, label, seated `playerIds`, `startedAt` (null until started) |
| `history`             | pair counts: `teammates` and `opponents`, keyed `a\|b`          |
| `matches`             | last 100 finished games                                         |

On a court, the first half of `playerIds` is side A, the second half side B.

`createSession` takes an optional setup `date` (YYYY-MM-DD,
`SessionDateSchema`) and anchors the window to that day; without it,
`sessionWindow` picks today, or tomorrow if today's window has ended. The
date only sets `startsAt` / `endsAt`; it is not kept in `config`.

## Court status

`open` (empty) → `filling` (partial, not started) → `ready` (full, not
started) → `playing` (`startedAt` set). A playing court that loses a player
with nobody waiting stays `playing` with an open slot.

## Seating (`fillCourts`)

- An empty court takes the first full group from the queue, split into
  teams by `arrangeTeams`. It never takes a partial group.
- A court with a gap takes the next player in line.
- Seating never starts the clock.

## Finishing a game (`finishGame`)

1. Only a `playing` court can finish.
2. Record teammates and opponents in `history`; bump `gamesPlayed`.
3. Keep the current up-next group (first full group in the queue) locked.
4. Shuffle the finishers, append them to the rest of the queue, and re-plan
   that part with `planQueue`.
5. Seat open courts.

## Planning (`planQueue`)

Goal: balanced games for everyone, as far as the session time allows.

1. Sort the line by games played (fewest first). The sort is stable, so
   ties keep line order (longest wait first). Late arrivals and players who
   missed out move up this way.
2. Build groups one at a time. Each group includes the first player, plus
   the best picks from the next `2 × capacity − 1`.
3. Pick score, lowest wins:
   `1000 × games of picks + 20 × repeat meetings (group + window players
left behind) + 1 × line positions of picks`. Exact ties are random.

POP runs units as pairs (`playersPerCourt` 2: pair vs pair), each with a
`skill` (its rank). Ranks (`lib/queue/ranks.ts`):

- Each skill is its own **line** inside the one queue; units only play
  units of the same line. `planByLine` plans each line with `planQueue`
  and puts it back in the slots that line held.
- Courts have `rank` (null = take the line of whoever is first).
  `fillCourts` takes the court's game with `takeGroup`, and fills a gap
  from the seated line with `takeOne`.
- `finishGame` keeps each line's next game in place (`nextPerLine`).
  `upNext` groups by line (`queueGroups`).
- `setCourtRank`: an idle court releases its group to the front of the
  queue and takes the new rank's game; a game in progress finishes first.
- `suggestCourtRanks(courts, unitsPerRank, cap)`: one court per rank that
  can fill one, the rest by share of units.
- `Court.rank` defaults to null, so saves from before ranks still load.

The short window bounds how far anyone can be skipped.

Verified by `fairness.test.ts`: whole sessions with random 9–21 minute
games, 100 seeds each. Worst game gap: 28 players on 3 courts ≤ 1; 9 on 1
court ≤ 1; 13 on 2 courts ≤ 2; singles 7 on 2 courts ≤ 2; busy 17 on 4
courts (1 waiting) ≤ 3; late arrivals end ≤ 2 games behind. A gap of 1 is
the floor when games don't divide evenly; busy sessions drift more because
only a court's finishers and the people waiting are free to rotate.

## Overtime (`overtime.ts`)

`config.overtimeMinutes` (default 12, clamped 5–90 by `setOvertimeLimit`;
older saves get the default). `overtimeAlerts` lists running games at or
past the limit, keyed `courtId:startedAt` so each game alerts separately.
Paused games don't alert; resuming keeps their time. Snooze/dismiss state
is per-browser UI state (`visibleAlerts`), not saved.

## Forecast (`forecast.ts`)

Average game length (15 minutes until the first game finishes) drives a
rough wait estimate per queued player: courts free up after an average
game, and groups take them in order. Players whose estimated start is at
or after the end time are flagged `atRisk`.

## Teams (`arrangeTeams`, doubles only)

Of the three ways to split 4 players, pick the lowest of
`2 × repeat partners + repeat opponents`; ties are random.

## Pause and edit (`pauseGame`, `resumeGame`, `cancelGame`, `swapPlayers`)

Court status adds `paused`: not running, has players, `stoppedAfterMs` set.

- `pauseGame(court, now)`: playing → paused; `stoppedAfterMs = now − startedAt`.
- `resumeGame(court, now)`: paused and full → playing with
  `startedAt = now − stoppedAfterMs`, so the clock continues.
- `startGame(court, now)`: any non-running full court (ready or paused) →
  playing from `now` (restart from 00:00).
- `finishGame` on a paused court records `startedAt = now − stoppedAfterMs`.
- `cancelGame`: playing or paused → ready; clears both times, records nothing.
- Emptying a court clears `stoppedAfterMs`.
- `swapPlayers(seated, other)` works only when neither player is in a
  running game. `other` can be waiting (the two trade spots: court slot ↔
  place in line) or seated on any court that hasn't started, including the
  same court (switch sides). `swapCandidates` lists the options: waiting
  players first, then players on courts that haven't started.
- The UI locks court edits (remove, swap, close) while a game is playing.

## Removal (`removePlayer`)

A removed court player is replaced in the same slot by the head of the
queue, so teams keep their sides. An emptied court resets to `open`.

## Rename (`renamePlayer`, `renameError`)

`renamePlayer` trims and collapses spaces, then sets the name and rewrites
that player's entries in `matches[].playerNames`. It returns the same state
for unknown ids, unchanged names, or any name `renameError` rejects:
`PlayerNameSchema` failures, or a name another player has (by `nameKey`).
No schema change.

## History (`history.ts`)

Derived from `matches`; no schema change. `matchMinutes` rounds a game to
whole minutes, minimum 1. `courtSummary(matches)` gives `{ courtLabel,
games, minutes }` per court, sorted by court number. `playerStats(state,
sort)` gives one row per player (present or left) with `games`, total
`minutes`, `status`, and `played`: that player's finished games as
`{ courtLabel, minutes, endedAt }`, newest first. `formatMinutes` (in
`time.ts`) shows totals as `1h 12m`, `2h`, or `45m`.

## Registered players

`createSession` and `addPlayers` take `PlayerEntry[]`: a plain name gets a
fresh id; `{ id, name }` keeps the registered player's database id, so
queue ids and `players.id` match. The live `QueueState` is saved whole to
`sessions.state` (see `data-model.md`), not localStorage.
