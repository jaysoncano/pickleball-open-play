import { describe, expect, it } from "vitest";
import {
  createSession,
  pauseGame,
  resumeGame,
  setOvertimeLimit,
  startGame,
} from "./engine";
import { overtimeAlerts, visibleAlerts } from "./overtime";
import { DEFAULT_OVERTIME_MINUTES, QueueStateSchema } from "./schema";

const MIN = 60_000;
const NOW = new Date(2026, 9, 23, 18, 0).getTime();

function session() {
  let n = 0;
  return createSession(
    { startTime: "18:00", endTime: "20:00", courtCount: 2, playersPerCourt: 2 },
    ["A", "B", "C", "D"],
    NOW,
    () => `id${++n}`,
    () => 0,
  );
}

describe("overtime alerts", () => {
  it("defaults the limit, and old saves without it still load", () => {
    const s = session();
    expect(s.config.overtimeMinutes).toBe(DEFAULT_OVERTIME_MINUTES);
    const oldConfig: Record<string, unknown> = { ...s.config };
    delete oldConfig.overtimeMinutes;
    const parsed = QueueStateSchema.parse({ ...s, config: oldConfig });
    expect(parsed.config.overtimeMinutes).toBe(DEFAULT_OVERTIME_MINUTES);
  });

  it("fires only for running games past the limit", () => {
    let s = startGame(session(), "id5", NOW);
    expect(overtimeAlerts(s, NOW + 11 * MIN)).toEqual([]);
    expect(overtimeAlerts(s, NOW + 12 * MIN)).toEqual([
      {
        key: `id5:${NOW}`,
        courtId: "id5",
        courtLabel: "Court 1",
        elapsedMs: 12 * MIN,
      },
    ]);
    s = pauseGame(s, "id5", NOW + 25 * MIN);
    expect(overtimeAlerts(s, NOW + 30 * MIN)).toEqual([]);
    // Resuming keeps the game's time, so the alert comes back.
    s = resumeGame(s, "id5", NOW + 30 * MIN);
    expect(overtimeAlerts(s, NOW + 30 * MIN)).toHaveLength(1);
  });

  it("follows the configured limit, clamped to a sane range", () => {
    const s = startGame(setOvertimeLimit(session(), 10), "id5", NOW);
    expect(s.config.overtimeMinutes).toBe(10);
    expect(overtimeAlerts(s, NOW + 10 * MIN)).toHaveLength(1);
    expect(setOvertimeLimit(s, 1).config.overtimeMinutes).toBe(5);
    expect(setOvertimeLimit(s, 500).config.overtimeMinutes).toBe(90);
  });

  it("hides snoozed and dismissed alerts until their time", () => {
    const alerts = overtimeAlerts(
      startGame(session(), "id5", NOW),
      NOW + 21 * MIN,
    );
    const key = alerts[0].key;
    expect(visibleAlerts(alerts, {}, NOW)).toHaveLength(1);
    expect(visibleAlerts(alerts, { [key]: NOW + 5 * MIN }, NOW)).toEqual([]);
    expect(
      visibleAlerts(alerts, { [key]: NOW + 5 * MIN }, NOW + 6 * MIN),
    ).toHaveLength(1);
    expect(visibleAlerts(alerts, { [key]: Infinity }, NOW + 99 * MIN)).toEqual(
      [],
    );
  });
});
