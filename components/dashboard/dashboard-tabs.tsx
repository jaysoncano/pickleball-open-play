"use client";

import { useRef, type KeyboardEvent } from "react";
import { TAB, TAB_BAR, TAB_EMOJI, TAB_OFF, TAB_ON } from "@/components/ui/tabs";

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
 * Sticky tab bar. On phones it scrolls sideways when the tabs don't fit,
 * keeping the active one in view. Switching tabs while scrolled down jumps
 * back to the top of the content, so the new tab starts at its beginning.
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
    document
      .getElementById(`tab-${id}`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
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
        className={TAB_BAR}
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
              className={`${TAB} ${selected ? TAB_ON : TAB_OFF}`}
            >
              <span aria-hidden className={TAB_EMOJI}>
                {tab.emoji}
              </span>
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`absolute top-1 right-1 min-w-5 rounded-full px-1 text-[10px] leading-5 tabular-nums md:static md:min-w-6 md:px-1.5 md:text-sm md:leading-normal ${tab.badge === 0 ? "max-md:hidden" : ""} ${selected ? "bg-white/25" : "bg-fuchsia-100 text-fuchsia-700 md:bg-ink/5 md:text-inherit"}`}
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
