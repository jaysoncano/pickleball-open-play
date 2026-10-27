export function WizardProgress({
  steps,
  current,
  onSelect,
}: {
  steps: readonly { title: string; emoji: string }[];
  current: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="flex w-full items-center justify-center gap-2">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.title} className="flex items-center gap-2">
            {i > 0 && (
              <span
                aria-hidden
                className={`h-1 w-6 rounded-full sm:w-10 ${done || active ? "bg-fuchsia-400" : "bg-ink/10"}`}
              />
            )}
            <button
              type="button"
              disabled={!done}
              onClick={() => onSelect(i)}
              aria-current={active ? "step" : undefined}
              className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 font-display text-sm font-semibold transition-colors ${active ? "bg-fuchsia-500 text-white shadow-[0_3px_0_0_#a21caf]" : done ? "bg-lime-300 text-lime-950 hover:bg-lime-200" : "bg-white/70 text-ink/40"}`}
            >
              <span aria-hidden>{done ? "✓" : step.emoji}</span>
              <span className={active ? "" : "sr-only sm:not-sr-only"}>
                {step.title}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
