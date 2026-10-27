"use client";

import { useRef, type KeyboardEvent } from "react";

export type DashboardTab<Id extends string> = {
  id: Id;
  label: string;
  emoji: string;
  /** Small count shown next to the label. */
  badge?: number;
};

export function tabPanelProps(id: string) {
  return {
    id: `panel-${id}`,
    role: "tabpanel",
    "aria-labelledby": `tab-${id}`,
  } as const;
}

/**
 * Sticky tab bar. Switching tabs while scrolled down jumps back to the
 * top of the content, so the new tab starts at its beginning.
 */
export function DashboardTabs<Id extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: DashboardTab<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);

  function select(id: Id) {
    onChange(id);
    const el = bar.current;
    if (el && el.getBoundingClientRect().top <= 16) {
      const top = el.offsetTop - 8;
      window.scrollTo({
        top,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((t) => t.id === active);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <div ref={bar} className="sticky top-2 z-30">
      <div
        role="tablist"
        aria-label="Dashboard sections"
        onKeyDown={onKeyDown}
        className="flex gap-1.5 rounded-[1.75rem] bg-white/85 p-1.5 shadow-[0_10px_30px_-15px_rgba(36,28,71,0.4)] ring-2 ring-white backdrop-blur-md"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab.id)}
              className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-3xl px-1 font-display text-base font-semibold sm:gap-2 sm:text-lg transition-all focus-visible:outline-4 focus-visible:outline-sky-400 ${selected ? "bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf]" : "text-ink/60 hover:bg-fuchsia-50 hover:text-fuchsia-600"}`}
            >
              <span aria-hidden className="max-sm:hidden">
                {tab.emoji}
              </span>
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`min-w-6 rounded-full px-1.5 text-sm tabular-nums ${selected ? "bg-white/25" : "bg-ink/5"}`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
