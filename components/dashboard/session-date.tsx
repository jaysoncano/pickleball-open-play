import type { QueueState } from "@/lib/queue/schema";
import { formatTimeLabel } from "@/lib/queue/time";

const dateLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Day the session started, with its play window. */
export function SessionDate({ session }: { session: QueueState }) {
  const { startTime, endTime } = session.config;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[2rem] bg-white/80 px-5 py-3 ring-2 ring-white backdrop-blur lg:col-span-2">
      <span className="font-display text-lg font-bold">
        <span aria-hidden>📅</span>{" "}
        <time dateTime={new Date(session.startsAt).toISOString()}>
          {dateLabel.format(session.startsAt)}
        </time>
      </span>
      <span className="text-sm font-semibold text-ink/50">
        {formatTimeLabel(startTime)} – {formatTimeLabel(endTime)}
      </span>
    </p>
  );
}
