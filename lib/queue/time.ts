const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

export function parseTime(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(minutes: number): string {
  const wrapped =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Shift an HH:MM time by a number of minutes, wrapping past midnight. */
export function addMinutes(value: string, minutes: number): string {
  return formatTime(parseTime(value) + minutes);
}

/** Local HH:MM of a timestamp. */
export function timeOfDay(ms: number): string {
  const d = new Date(ms);
  return formatTime(d.getHours() * 60 + d.getMinutes());
}

/** Local calendar date of a timestamp as YYYY-MM-DD. */
export function dateInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD date. */
export function dayStart(value: string): number {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * Window for new start/end times on the same day as an existing session,
 * so editing a live session never jumps it to another day.
 */
export function rescheduleWindow(
  startTime: string,
  endTime: string,
  sameDayAs: number,
) {
  const day = new Date(sameDayAs);
  day.setHours(0, 0, 0, 0);
  const startsAt = day.getTime() + parseTime(startTime) * MS_PER_MINUTE;
  return {
    startsAt,
    endsAt: startsAt + sessionMinutes(startTime, endTime) * MS_PER_MINUTE,
  };
}

/** Minutes between start and end; sessions that cross midnight wrap. */
export function sessionMinutes(startTime: string, endTime: string): number {
  return (
    (parseTime(endTime) - parseTime(startTime) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY
  );
}

/**
 * Absolute window for a session that starts today at `startTime`. A window
 * that has already finished today is assumed to mean tomorrow.
 */
export function sessionWindow(startTime: string, endTime: string, now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let startsAt = start.getTime() + parseTime(startTime) * MS_PER_MINUTE;
  const duration = sessionMinutes(startTime, endTime) * MS_PER_MINUTE;
  if (startsAt + duration <= now) startsAt += MINUTES_PER_DAY * MS_PER_MINUTE;
  return { startsAt, endsAt: startsAt + duration };
}

export type SessionPhase = "upcoming" | "live" | "ended";

export function sessionPhase(
  window: { startsAt: number; endsAt: number },
  now: number,
): SessionPhase {
  if (now < window.startsAt) return "upcoming";
  if (now < window.endsAt) return "live";
  return "ended";
}

/** 0–1 progress through the session window. */
export function sessionProgress(
  window: { startsAt: number; endsAt: number },
  now: number,
): number {
  const total = window.endsAt - window.startsAt;
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, (now - window.startsAt) / total));
}

/** Human duration such as "2h 05m", "12m", or "45s". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${totalSeconds}s`;
}

/** Whole minutes as "1h 12m", "2h", or "45m". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Stopwatch format such as "07:32" or "1:02:09". */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** 12-hour label for an HH:MM value, e.g. "6:30 PM". */
export function formatTimeLabel(value: string): string {
  const minutes = parseTime(value);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}
