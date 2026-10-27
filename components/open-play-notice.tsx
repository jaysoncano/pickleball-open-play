export function OpenPlayNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-3 rounded-3xl bg-gradient-to-r from-amber-200 via-orange-200 to-pink-200 text-ink ring-2 ring-white ${compact ? "px-4 py-3" : "p-4 sm:p-5"}`}
    >
      <span aria-hidden className={compact ? "text-xl" : "text-3xl"}>
        📣
      </span>
      <div className="min-w-0">
        <p className="font-display text-base font-semibold sm:text-lg">
          Open play — all ranks welcome!
        </p>
        {!compact && (
          <p className="mt-0.5 text-sm text-ink/75 sm:text-base">
            This app is for queuing only. Courts are open to every skill level,
            from first-timers to pros. Rotation is first in, first out, so
            everyone gets their turn.
          </p>
        )}
      </div>
    </div>
  );
}
