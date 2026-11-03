"use client";

import { useRouter } from "next/navigation";
import { endOpenPlay, finishMatch, renameAndSave } from "@/app/actions";
import { useSessionStore } from "@/components/session-provider";
import { useCallback, useState } from "react";
import type { OpenPlayKind } from "@/lib/registration/open-play";
import { levelRank, type Level } from "@/lib/ranking/levels";
import {
  addCourt,
  addLatePairs,
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
import { forecast, gamesLeft } from "@/lib/queue/forecast";
import {
  startWarning,
  UNPAID_REMIND_MS,
  unpaidOnCourtAlerts,
  type StartWarning,
} from "@/lib/queue/heads-up";
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
import { RankingsPreview } from "./rankings-preview";
import { StandingsPanel } from "./standings-panel";
import { QueueList } from "./queue-list";
import { SessionBar } from "./session-bar";
import { StatsRow } from "./stats-row";
import { HeadsUpToasts } from "./heads-up-toasts";
import { PaymentsPanel } from "./payments-panel";
import { PlayersPanel } from "./players-panel";
import { ScoreDialog } from "./score-dialog";
import { SessionTimeDialog } from "./session-time-dialog";
import { StartWarningDialog } from "./start-warning-dialog";
import { SwapDialog } from "./swap-dialog";
import { UpNextCard } from "./up-next-card";
import { useProfileSetup } from "./use-profile-setup";
import { useUnpaidPairs } from "./use-unpaid-pairs";

export function Dashboard({
  session,
  ranks = [],
  kind = "ranked",
}: {
  session: QueueState;
  /** The open play's ranks: courts pick which one they play. */
  ranks?: Level[];
  /** Regular open plays' guests have no profiles: no Profiles tab. */
  kind?: OpenPlayKind;
}) {
  // Apply an engine change now; it saves to the database in the background.
  const { update: act, saveError, openPlayId } = useSessionStore();
  const router = useRouter();
  const now = useNow();
  const [scoringCourt, setScoringCourt] = useState<string | null>(null);
  const [tab, setTab] = useState<
    | "courts"
    | "players"
    | "rankings"
    | "profiles"
    | "history"
    | "standings"
    | "payments"
  >("courts");
  const payments = useUnpaidPairs(openPlayId);
  const [signedUp, setSignedUp] = useState<number>();
  // A pair checked in on the Players tab: the queue looks for it now.
  const [checkIns, setCheckIns] = useState(0);
  const onSignedUp = useCallback((n: number) => setSignedUp(n), []);
  const onCheckedIn = useCallback(() => setCheckIns((n) => n + 1), []);
  // A game about to start without time to finish: ask first.
  const [startCheck, setStartCheck] = useState<{
    courtId: string;
    courtLabel: string;
    warning: StartWarning;
  } | null>(null);
  const profiles = kind === "ranked";
  const setup = useProfileSetup(profiles ? Object.keys(session.players) : []);
  const needSetup = setup.filter((r) => r.status !== "complete").length;
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState(false);
  // Snoozed (until a time) or dismissed (Infinity) overtime alerts.
  const [hiddenAlerts, setHiddenAlerts] = useState<Record<string, number>>({});
  const overtime = overtimeAlerts(session, now);
  const unpaidAlerts = unpaidOnCourtAlerts(session, payments.unpaid);
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
  const estimate = gamesLeft(session, now);
  const endLabel = new Date(session.endsAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const timeWarning =
    outlook.atRisk.length > 0
      ? {
          count: outlook.atRisk.length,
          unplayed: outlook.atRisk.filter(
            (id) => session.players[id].gamesPlayed === 0,
          ).length,
          endLabel,
        }
      : undefined;

  // The court playing longest is the best guess for the next one to free up.
  const likelyNextCourt = session.courts
    .filter((c) => c.startedAt !== null)
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0];

  const onRemovePlayer = (id: string) => act((s) => removePlayer(s, id));
  const start = (courtId: string) => act((s, t) => startGame(s, courtId, t));
  // Heads-up first when there isn't time for a typical game.
  const requestStart = (courtId: string, courtLabel: string) => {
    const warning = startWarning(session, courtId, now);
    if (warning) setStartCheck({ courtId, courtLabel, warning });
    else start(courtId);
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-5 sm:gap-6 sm:py-8">
      <SessionBar
        openPlayId={openPlayId}
        session={session}
        now={now}
        onEditTime={() => setEditingTime(true)}
        onEnd={async () => {
          await endOpenPlay(openPlayId);
          // The page reloads as the open play's results, not its setup.
          router.refresh();
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

      <StatsRow
        {...summary}
        courts={session.courts.length}
        estimate={estimate}
      />

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
          { id: "players", label: "Players", emoji: "👥", badge: signedUp },
          { id: "rankings", label: "Rankings", emoji: "📊" },
          ...(profiles
            ? [
                {
                  id: "profiles" as const,
                  label: "Profiles",
                  emoji: "📱",
                  badge: needSetup,
                },
              ]
            : []),
          {
            id: "history",
            label: "History",
            emoji: "🏆",
            badge: session.matches.length,
          },
          { id: "standings", label: "Standings", emoji: "🥇" },
          {
            id: "payments",
            label: "Payments",
            emoji: "💰",
            badge: payments.count,
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
                  onStart={() => requestStart(court.id, court.label)}
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
                refreshKey={checkIns}
                // Paid late: first in line, so games stay balanced.
                onAdd={(pairs) => act((s, t) => addLatePairs(s, pairs, t))}
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

      <div {...tabPanelProps("players")} hidden={tab !== "players"}>
        <PlayersPanel
          openPlayId={openPlayId}
          session={session}
          active={tab === "players"}
          onCount={onSignedUp}
          onCheckedIn={onCheckedIn}
        />
      </div>

      <div {...tabPanelProps("rankings")} hidden={tab !== "rankings"}>
        <RankingsPreview
          openPlayId={openPlayId}
          session={session}
          active={tab === "rankings"}
        />
      </div>

      {profiles && (
        <div {...tabPanelProps("profiles")} hidden={tab !== "profiles"}>
          <ProfilesPanel rows={setup} />
        </div>
      )}

      <div
        {...tabPanelProps("history")}
        hidden={tab !== "history"}
        className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6"
      >
        <SessionDate session={session} />
        <PlayerStatsTable session={session} />
        <MatchHistory matches={session.matches} />
      </div>

      <div {...tabPanelProps("standings")} hidden={tab !== "standings"}>
        <StandingsPanel
          openPlayId={openPlayId}
          session={session}
          ranks={ranks}
          active={tab === "standings"}
        />
      </div>

      <div {...tabPanelProps("payments")} hidden={tab !== "payments"}>
        <PaymentsPanel
          openPlayId={openPlayId}
          active={tab === "payments"}
          onChanged={payments.reload}
        />
      </div>

      <HeadsUpToasts
        overtime={visibleAlerts(overtime, hiddenAlerts, now)}
        unpaid={visibleAlerts(unpaidAlerts, hiddenAlerts, now)}
        limitMinutes={session.config.overtimeMinutes}
        remindMinutes={UNPAID_REMIND_MS / 60_000}
        onSnooze={(key, minutes) =>
          hideAlert(key, Date.now() + minutes * 60_000)
        }
        onDismiss={(key) => hideAlert(key, Infinity)}
      />

      {startCheck && (
        <StartWarningDialog
          courtLabel={startCheck.courtLabel}
          warning={startCheck.warning}
          endLabel={endLabel}
          onStart={() => {
            start(startCheck.courtId);
            setStartCheck(null);
          }}
          onEditTime={() => {
            setStartCheck(null);
            setEditingTime(true);
          }}
          onClose={() => setStartCheck(null)}
        />
      )}

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
              (s, t) => finishGame(s, scoringCourt, t, Math.random, score),
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
