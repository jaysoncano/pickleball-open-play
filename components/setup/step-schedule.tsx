import {
  addMinutes,
  dayStart,
  formatDuration,
  formatTimeLabel,
  sessionMinutes,
} from "@/lib/queue/time";

const QUICK_HOURS = [1, 2, 3, 4];

const dateLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function StepSchedule({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartChange,
  onEndChange,
}: {
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const minutes = sessionMinutes(startTime, endTime);
  const crossesMidnight = endTime < startTime;

  return (
    <div className="flex flex-col gap-5">
      <label
        htmlFor="session-date"
        className="flex flex-col gap-1 rounded-3xl bg-amber-100 p-4 ring-2 ring-amber-300 transition-shadow focus-within:ring-amber-500"
      >
        <span className="text-sm font-bold tracking-wide text-ink/60 uppercase">
          Date
        </span>
        <input
          id="session-date"
          type="date"
          required
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full bg-transparent font-display text-2xl font-semibold outline-none sm:text-3xl"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <TimeField
          id="start-time"
          label="Start"
          value={startTime}
          onChange={onStartChange}
          tone="bg-lime-100 ring-lime-300 focus-within:ring-lime-500"
        />
        <TimeField
          id="end-time"
          label="End"
          value={endTime}
          onChange={onEndChange}
          tone="bg-sky-100 ring-sky-300 focus-within:ring-sky-500"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink/60">
          Quick pick from start time
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_HOURS.map((h) => {
            const selected = minutes === h * 60;
            return (
              <button
                key={h}
                type="button"
                aria-pressed={selected}
                onClick={() => onEndChange(addMinutes(startTime, h * 60))}
                className={`min-h-11 rounded-full px-4 font-display font-semibold transition-colors ${selected ? "bg-fuchsia-500 text-white" : "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200"}`}
              >
                {h} hr{h > 1 ? "s" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-5 text-white">
        <p className="text-sm font-semibold text-white/80">Total play time</p>
        <p className="font-display text-4xl font-bold">
          {minutes > 0 ? formatDuration(minutes * 60_000) : "—"}
        </p>
        <p className="mt-1 text-sm text-white/85">
          {date && `${dateLabel.format(dayStart(date))} · `}
          {formatTimeLabel(startTime)} → {formatTimeLabel(endTime)}
          {crossesMidnight && minutes > 0 ? " (next day)" : ""}
        </p>
      </div>
    </div>
  );
}

export function TimeField({
  id,
  label,
  value,
  onChange,
  tone,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  tone: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex flex-col gap-1 rounded-3xl p-4 ring-2 transition-shadow ${tone}`}
    >
      <span className="text-sm font-bold tracking-wide text-ink/60 uppercase">
        {label}
      </span>
      <input
        id={id}
        type="time"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-display text-2xl font-semibold outline-none sm:text-3xl"
      />
    </label>
  );
}
