import { describe, expect, it } from "vitest";
import {
  addMinutes,
  dateInput,
  dayStart,
  formatClock,
  formatDuration,
  formatMinutes,
  formatTime,
  formatTimeLabel,
  parseTime,
  rescheduleWindow,
  sessionMinutes,
  sessionPhase,
  sessionProgress,
  sessionWindow,
  timeOfDay,
} from "./time";

const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m).getTime();
const HOUR = 3_600_000;

describe("time of day", () => {
  it("parses and formats HH:MM", () => {
    expect(parseTime("18:30")).toBe(1110);
    expect(formatTime(1110)).toBe("18:30");
    expect(formatTime(-30)).toBe("23:30");
    expect(formatTime(1470)).toBe("00:30");
  });

  it("adds minutes across midnight", () => {
    expect(addMinutes("23:00", 120)).toBe("01:00");
  });

  it("measures session length, wrapping past midnight", () => {
    expect(sessionMinutes("18:00", "21:30")).toBe(210);
    expect(sessionMinutes("22:00", "01:00")).toBe(180);
    expect(sessionMinutes("10:00", "10:00")).toBe(0);
  });

  it("labels times in 12-hour format", () => {
    expect(formatTimeLabel("00:05")).toBe("12:05 AM");
    expect(formatTimeLabel("12:00")).toBe("12:00 PM");
    expect(formatTimeLabel("18:30")).toBe("6:30 PM");
  });
});

describe("sessionWindow", () => {
  it("anchors to today", () => {
    expect(sessionWindow("18:00", "21:00", at(17))).toEqual({
      startsAt: at(18),
      endsAt: at(21),
    });
  });

  it("keeps a window that is in progress", () => {
    expect(sessionWindow("18:00", "21:00", at(19)).startsAt).toBe(at(18));
  });

  it("rolls a finished window to tomorrow", () => {
    expect(sessionWindow("08:00", "09:00", at(17)).startsAt).toBe(
      at(8) + 24 * HOUR,
    );
  });

  it("handles sessions that end after midnight", () => {
    const w = sessionWindow("22:00", "01:00", at(21));
    expect(w.endsAt - w.startsAt).toBe(3 * HOUR);
  });
});

describe("phase and progress", () => {
  const w = { startsAt: at(18), endsAt: at(20) };

  it("reports the phase", () => {
    expect(sessionPhase(w, at(17))).toBe("upcoming");
    expect(sessionPhase(w, at(19))).toBe("live");
    expect(sessionPhase(w, at(20))).toBe("ended");
  });

  it("reports clamped progress", () => {
    expect(sessionProgress(w, at(17))).toBe(0);
    expect(sessionProgress(w, at(19))).toBe(0.5);
    expect(sessionProgress(w, at(22))).toBe(1);
    expect(sessionProgress({ startsAt: 5, endsAt: 5 }, 0)).toBe(1);
  });
});

describe("formatting durations", () => {
  it("formats human durations", () => {
    expect(formatDuration(2 * HOUR + 5 * 60_000)).toBe("2h 05m");
    expect(formatDuration(12 * 60_000)).toBe("12m");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(-1)).toBe("0s");
  });

  it("formats minutes as hours and minutes", () => {
    expect(formatMinutes(72)).toBe("1h 12m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(-3)).toBe("0m");
  });

  it("formats stopwatch time", () => {
    expect(formatClock(7 * 60_000 + 32_000)).toBe("07:32");
    expect(formatClock(HOUR + 2 * 60_000 + 9_000)).toBe("1:02:09");
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("calendar dates", () => {
  it("formats and parses local YYYY-MM-DD dates", () => {
    expect(dateInput(at(18, 5))).toBe("2026-10-23");
    expect(dateInput(new Date(2026, 0, 5).getTime())).toBe("2026-01-05");
    expect(dayStart("2026-10-23")).toBe(at(0));
  });
});

describe("rescheduling", () => {
  it("reads the local time of day", () => {
    expect(timeOfDay(at(18, 5))).toBe("18:05");
  });

  it("keeps the same day and wraps past midnight", () => {
    expect(rescheduleWindow("17:00", "22:30", at(19))).toEqual({
      startsAt: at(17),
      endsAt: at(22, 30),
    });
    const late = rescheduleWindow("22:00", "01:00", at(23));
    expect(late.startsAt).toBe(at(22));
    expect(late.endsAt - late.startsAt).toBe(3 * HOUR);
  });
});
