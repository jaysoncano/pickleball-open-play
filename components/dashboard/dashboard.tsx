"use client";

import { endOpenPlay, finishMatch, renameAndSave } from "@/app/actions";
import { useSessionStore } from "@/components/session-provider";
import { useState } from "react";
import { levelRank, type Level } from "@/lib/ranking/levels";
import {
  addCourt,
  addPlayers,
  editSchedule,
  setOvertimeLimit,
  finishGame,
  movePlayer,
  removeCourt,
  removePlayer,
  renameError,
  setCourtRank,
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
} from "@/lib/queue/engine";
import { forecast } from "@/lib/queue/forecast";
import { overtimeAlerts, visibleAlerts } from "@/lib/queue/overtime";
import type { QueueState } from "@/lib/queue/schema";
import { useNow } from "@/lib/use-now";
import { CourtCard } from "./court-card";
import { DashboardTabs, tabPanelProps } from "./dashboard-tabs";
import { LatePairs } from "./late-pairs";
import { MatchHistory } from "./match-history";
import { PlayerStatsTable } from "./player-stats-table";
import { ProfilesPanel } from "./profiles-panel";
import { SessionDate } from "./session-date";
import { QueueList } from "./queue-list";
import { SessionBar } from "./session-bar";
import { StatsRow } from "./stats-row";
import { OvertimeToasts } from "./overtime-toasts";
import { ScoreDialog } from "./score-dialog";
import { SessionTimeDialog } from "./session-time-dialog";
import { SwapDialog } from "./swap-dialog";
import { UpNextCard } from "./up-next-card";
import { useProfileSetup } from "./use-profile-setup";

export function Dashboard({
  session,
  ranks = [],
}: {
  session: QueueState;
  /** The open play's ranks: courts pick which one they play. */
  ranks?: Level[];
}) {
  // Apply an engine change now; it saves to the database in the background.
  const { update: act, replace, saveError, openPlayId } = useSessionStore();
  const now = useNow();
  const [scoringCourt, setScoringCourt] = useState<string | null>(null);
  const [tab, setTab] = useState<"courts" | "profiles" | "history">("courts");
  const setup = useProfileSetup(Object.keys(session.players));
  const needSetup = setup.filter((r) => r.status !== "complete").length;
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState(false);
  // Snoozed (until a time) or dismissed (Infinity) overtime alerts.
  const [hiddenAlerts, setHiddenAlerts] = useState<Record<string, number>>({});
  const overtime = overtimeAlerts(session, now);
  const overtimeCourts = new Set(overtime.map((a) => a.courtId));
  const hideAlert = (key: string, until: number) =>
    setHiddenAlerts((h) => ({ ...h, [key]: until }));
  const swapCourt = swapTarget
    ? session.courts.find(
        (c) => c.startedAt === null && c.playerIds.includes(swapTarget),
      )
    : undefined;
  const scoringCourtData = session.courts.find((c) => c.id === scoringCourt);
  const cap = session.config.playersPerCourt;
  const preview = upNext(session);
  const summary = stats(session);
  const outlook = forecast(session, now);
  const timeWarning =
    outlook.atRisk.length > 0
      ? {
          count: outlook.atRisk.length,
          unplayed: outlook.atRisk.filter(
            (id) => session.players[id].gamesPlayed === 0,
          ).length,
          endLabel: new Date(session.endsAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        }
      : undefined;

  // The court playing longest is the best guess for the next one to free up.
  const likelyNextCourt = session.courts
    .filter((c) => c.startedAt !== null)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0];

  const onRemovePlayer = (id: string) => act((s) => removePlayer(s, id));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:py-8">
      <SessionBar
        session={session}
        now={now}
        onEditTime={() => setEditingTime(true)}
        onEnd={async () => {
          await endOpenPlay(openPlayId);
          replace(null);
        }}
      />

      {saveError && (
        <p
          role="alert"
          className="rounded-2xl bg-rose-100 px-4 py-3 font-semibold text-rose-700"
        >
          ⚠️ {saveError}
        </p>
      )}

      <StatsRow {...summary} courts={session.courts.length} />

      <DashboardTabs
        active={tab}
        onChange={setTab}
        tabs={[
          {
            id: "courts",
            label: "Courts",
            emoji: "🎾",
            badge: session.courts.length,
          },
          {
            id: "profiles",
            label: "Profiles",
            emoji: "📱",
            badge: needSetup,
          },
          {
            id: "history",
            label: "History",
            emoji: "🏆",
            badge: session.matches.length,
          },
        ]}
      />

      <div
        {...tabPanelProps("courts")}
        hidden={tab !== "courts"}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6"
      >
        <section aria-labelledby="courts-title" className="min-w-0">
          <h2
            id="courts-title"
            className="mb-3 font-display text-2xl font-bold"
          >
            Courts
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {session.courts.map((court, i) => (
              <li key={court.id}>
                <CourtCard
                  court={court}
                  colorIndex={i}
                  capacity={cap}
                  players={session.players}
                  now={now}
                  overtime={overtimeCourts.has(court.id)}
                  canClose={session.courts.length > 1}
                  onStart={() => act((s, t) => startGame(s, court.id, t))}
                  onPause={() => act((s, t) => pauseGame(s, court.id, t))}
                  onResume={() => act((s, t) => resumeGame(s, court.id, t))}
                  onCancel={() => act((s) => cancelGame(s, court.id))}
                  onSwap={setSwapTarget}
                  onFinish={() => setScoringCourt(court.id)}
                  onClose={() => act((s) => removeCourt(s, court.id))}
                  onRemovePlayer={onRemovePlayer}
                  ranks={ranks}
                  onRankChange={(level) =>
                    act((s) => setCourtRank(s, court.id, levelRank(level)))
                  }
                />
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => act((s) => addCourt(s))}
                className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 rounded-[2rem] border-3 border-dashed border-ink/15 font-display text-lg font-semibold text-ink/50 transition-colors hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-600"
              >
                <span aria-hidden className="text-3xl">
                  ＋
                </span>
                Add a court
              </button>
            </li>
          </ul>
        </section>

        <aside className="flex flex-col gap-5">
          <UpNextCard
            preview={preview}
            players={session.players}
            capacity={cap}
            likelyCourt={likelyNextCourt?.label}
            hasOpenCourt={summary.openCourts > 0}
            readyCourts={summary.readyCourts}
            timeWarning={timeWarning}
            onEditTime={() => setEditingTime(true)}
            onAddCourt={() => act((s) => addCourt(s))}
          />

          <section
            aria-labelledby="queue-title"
            className="rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-5"
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h2 id="queue-title" className="font-display text-2xl font-bold">
                Queue
              </h2>
              <span className="text-sm font-semibold text-ink/50">
                {session.queue.length} waiting
              </span>
            </div>
            <div className="mb-4">
              <LatePairs
                openPlayId={openPlayId}
                inSession={Object.keys(session.players)}
                onAdd={(pairs) => act((s, t) => addPlayers(s, pairs, t))}
              />
            </div>
            <QueueList
              queue={session.queue}
              players={session.players}
              capacity={cap}
              onMove={(id, dir) => act((s) => movePlayer(s, id, dir))}
              onReorder={(id, to) => act((s) => reorderQueue(s, id, to))}
              onRemove={onRemovePlayer}
              onRename={(id, name) =>
                act(
                  (s) => renamePlayer(s, id, name),
                  (next) => renameAndSave(openPlayId, next, id, name),
                )
              }
              renameError={(id, name) =>
                // Pairs (units with a skill) take their name from the players.
                session.players[id]?.skill !== undefined
                  ? "Pair names come from the players. Rename them at the Player desk."
                  : renameError(session, id, name)
              }
              startsIn={outlook.startsIn}
              atRisk={outlook.atRisk}
            />
          </section>
        </aside>
      </div>

      <div {...tabPanelProps("profiles")} hidden={tab !== "profiles"}>
        <ProfilesPanel rows={setup} />
      </div>

      <div
        {...tabPanelProps("history")}
        hidden={tab !== "history"}
        className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6"
      >
        <SessionDate session={session} />
        <PlayerStatsTable session={session} />
        <MatchHistory matches={session.matches} />
      </div>

      <OvertimeToasts
        alerts={visibleAlerts(overtime, hiddenAlerts, now)}
        limitMinutes={session.config.overtimeMinutes}
        onSnooze={(key) => hideAlert(key, Date.now() + 5 * 60_000)}
        onDismiss={(key) => hideAlert(key, Infinity)}
      />

      {editingTime && (
        <SessionTimeDialog
          startTime={session.config.startTime}
          endTime={session.config.endTime}
          overtimeMinutes={session.config.overtimeMinutes}
          sessionDay={session.startsAt}
          now={now}
          onSave={(start, end, overtimeMinutes) => {
            act((s) =>
              setOvertimeLimit(editSchedule(s, start, end), overtimeMinutes),
            );
            setEditingTime(false);
          }}
          onClose={() => setEditingTime(false)}
        />
      )}

      {scoringCourt && scoringCourtData && (
        <ScoreDialog
          court={scoringCourtData}
          players={session.players}
          onSave={(score) => {
            act(
              (s, t) => finishGame(s, scoringCourt, t),
              (next) =>
                finishMatch(openPlayId, next, next.matches.at(-1), score),
            );
            setScoringCourt(null);
          }}
          onClose={() => setScoringCourt(null)}
        />
      )}

      {swapTarget && swapCourt && (
        <SwapDialog
          key={swapTarget}
          playerName={session.players[swapTarget].name}
          courtLabel={swapCourt.label}
          candidates={swapCandidates(session, swapTarget)}
          onPick={(id) => {
            act((s) => swapPlayers(s, swapTarget, id));
            setSwapTarget(null);
          }}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </main>
  );
}
