"use client";

import { useState } from "react";
import { TimeField } from "@/components/setup/step-schedule";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { firstError, OVERTIME_RANGE, ScheduleSchema } from "@/lib/queue/schema";
import {
  addMinutes,
  formatDuration,
  formatTimeLabel,
  rescheduleWindow,
  sessionMinutes,
} from "@/lib/queue/time";

const QUICK_ADD = [
  { minutes: -15, label: "−15 min" },
  { minutes: 15, label: "+15 min" },
  { minutes: 30, label: "+30 min" },
  { minutes: 60, label: "+1 hr" },
];

/** Edit a running session's start and end. Changes apply on Save. */
export function SessionTimeDialog({
  startTime: initialStart,
  endTime: initialEnd,
  overtimeMinutes: initialOvertime,
  sessionDay,
  now,
  onSave,
  onClose,
}: {
  startTime: string;
  endTime: string;
  overtimeMinutes: number;
  /** Any timestamp on the session's day, to keep edits on that day. */
  sessionDay: number;
  now: number;
  onSave: (startTime: string, endTime: string, overtimeMinutes: number) => void;
  onClose: () => void;
}) {
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [overtime, setOvertime] = useState(initialOvertime);

  const error = firstError(ScheduleSchema.safeParse({ startTime, endTime }));
  const minutes = sessionMinutes(startTime, endTime);
  const preview = rescheduleWindow(startTime, endTime, sessionDay);
  const changed =
    startTime !== initialStart ||
    endTime !== initialEnd ||
    overtime !== initialOvertime;
  const crossesMidnight = endTime < startTime;

  return (
    <Modal
      eyebrow="Session settings"
      title="Edit play time & alerts"
      tone="from-violet-500 to-fuchsia-500"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="lime"
            disabled={Boolean(error) || !changed}
            onClick={() => onSave(startTime, endTime, overtime)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            id="edit-start-time"
            label="Start"
            value={startTime}
            onChange={setStartTime}
            tone="bg-lime-100 ring-lime-300 focus-within:ring-lime-500"
          />
          <TimeField
            id="edit-end-time"
            label="End"
            value={endTime}
            onChange={setEndTime}
            tone="bg-sky-100 ring-sky-300 focus-within:ring-sky-500"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink/60">
            Adjust end time
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ADD.map((q) => (
              <button
                key={q.minutes}
                type="button"
                onClick={() => setEndTime(addMinutes(endTime, q.minutes))}
                className={`min-h-11 rounded-full px-4 font-display font-semibold transition-colors ${q.minutes < 0 ? "bg-ink/5 text-ink/60 hover:bg-ink/10" : "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200"}`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-5 text-white">
          <p className="text-sm font-semibold text-white/80">Total play time</p>
          <p className="font-display text-4xl font-bold">
            {minutes > 0 ? formatDuration(minutes * 60_000) : "—"}
          </p>
          <p className="mt-1 text-sm text-white/85">
            {formatTimeLabel(startTime)} → {formatTimeLabel(endTime)}
            {crossesMidnight && minutes > 0 ? " (next day)" : ""}
          </p>
          {!error && (
            <p className="mt-2 rounded-xl bg-white/20 px-3 py-1.5 text-sm font-semibold">
              {preview.endsAt <= now
                ? "⚠️ This end time has already passed. The session will show as over."
                : now < preview.startsAt
                  ? `Starts in ${formatDuration(preview.startsAt - now)}`
                  : `${formatDuration(preview.endsAt - now)} left after saving`}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-3xl bg-rose-50 p-4 ring-2 ring-rose-100">
          <div className="min-w-0">
            <p className="font-display font-semibold">⏰ Overtime alert</p>
            <p className="text-sm text-ink/60">
              Pop up when a game runs longer than this.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Shorter overtime limit"
              disabled={overtime <= OVERTIME_RANGE.min}
              onClick={() =>
                setOvertime(Math.max(OVERTIME_RANGE.min, overtime - 1))
              }
              className="size-11 rounded-full bg-white text-xl font-bold ring-2 ring-rose-200 disabled:opacity-40"
            >
              −
            </button>
            <output
              aria-live="polite"
              className="w-16 text-center font-display text-xl font-bold text-rose-600"
            >
              {overtime}
              <span className="block text-xs text-ink/50">min</span>
            </output>
            <button
              type="button"
              aria-label="Longer overtime limit"
              disabled={overtime >= OVERTIME_RANGE.max}
              onClick={() =>
                setOvertime(Math.min(OVERTIME_RANGE.max, overtime + 1))
              }
              className="size-11 rounded-full bg-white text-xl font-bold ring-2 ring-rose-200 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {error && (
          <p role="status" className="text-sm font-semibold text-rose-600">
            {error}
          </p>
        )}

        <p className="text-xs font-semibold text-ink/45">
          Courts, timers, and the queue keep running. Only the session clock and
          alert limit change.
        </p>
      </div>
    </Modal>
  );
}
