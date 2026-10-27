import { courtTheme } from "@/components/court-theme";
import { Button } from "@/components/ui/button";
import { MAX_COURTS } from "@/lib/queue/schema";
import { LEVEL_INFO, type Level } from "@/lib/ranking/levels";

/**
 * Open play is doubles by pairs: two pairs per court. With more than one
 * rank, each court gets the rank it plays (switchable later).
 */
export function StepCourts({
  courtLevels,
  ranks,
  waiting,
  onCountChange,
  onLevelChange,
}: {
  /** Each court's rank, in court order; its length is the court count. */
  courtLevels: Level[];
  /** The open play's ranks. */
  ranks: Level[];
  /** Paid pairs picked per rank, to show next to the choice. */
  waiting: Map<Level, number>;
  onCountChange: (count: number) => void;
  onLevelChange: (court: number, level: Level) => void;
}) {
  const courtCount = courtLevels.length;
  const set = (value: number) =>
    onCountChange(Math.min(MAX_COURTS, Math.max(1, value)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Fewer courts"
          onClick={() => set(courtCount - 1)}
          disabled={courtCount <= 1}
        >
          −
        </Button>
        <output aria-live="polite" className="flex w-28 flex-col items-center">
          <span
            key={courtCount}
            className="animate-pop-in font-display text-7xl font-bold text-fuchsia-500 motion-reduce:animate-none"
          >
            {courtCount}
          </span>
          <span className="font-display font-semibold text-ink/60">
            court{courtCount === 1 ? "" : "s"}
          </span>
        </output>
        <Button
          variant="secondary"
          size="icon"
          aria-label="More courts"
          onClick={() => set(courtCount + 1)}
          disabled={courtCount >= MAX_COURTS}
        >
          +
        </Button>
      </div>

      {ranks.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink/60">
            Which rank plays on each court? Suggested from the pairs; change
            any. You can switch courts during play too.
          </legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {courtLevels.map((level, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-2 ring-ink/5"
              >
                <span
                  aria-hidden
                  className={`relative h-9 w-12 shrink-0 rounded-lg ring-2 ring-white ${courtTheme(i).surface}`}
                >
                  <span className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-white/90" />
                </span>
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-display font-semibold">
                    Court {i + 1}
                  </span>
                  <select
                    value={level}
                    onChange={(e) => onLevelChange(i, e.target.value as Level)}
                    className={`ml-auto min-h-11 rounded-xl px-3 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400 ${LEVEL_INFO[level].tone}`}
                  >
                    {ranks.map((r) => (
                      <option key={r} value={r}>
                        {LEVEL_INFO[r].label}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-sm text-ink/60">
            {ranks
              .map(
                (r) =>
                  `${LEVEL_INFO[r].label}: ${courtLevels.filter((l) => l === r).length} court(s), ${waiting.get(r) ?? 0} pair(s)`,
              )
              .join(" · ")}
          </p>
        </fieldset>
      ) : (
        <div aria-hidden className="flex flex-wrap justify-center gap-2">
          {courtLevels.map((_, i) => (
            <span
              key={i}
              className={`animate-pop-in relative h-10 w-14 rounded-lg ring-2 ring-white motion-reduce:animate-none ${courtTheme(i).surface}`}
            >
              <span className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-white/90" />
            </span>
          ))}
        </div>
      )}

      <p className="text-center text-sm text-ink/60">
        Doubles by pairs: {courtCount * 2} pairs ({courtCount * 4} players) on
        court at a time. You can add or close courts later.
      </p>
    </div>
  );
}
