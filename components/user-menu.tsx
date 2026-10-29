"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ITEM =
  "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left font-display font-semibold text-ink/75 hover:bg-fuchsia-50 hover:text-fuchsia-600";

/**
 * Who's signed in, as a menu button: "Sean ▾" opens their links and
 * Sign out. Closes on Escape or a click outside. Inline on phones (inside
 * the nav's menu panel), a dropdown from `lg` up.
 */
export function UserMenu({
  name,
  badge,
  links,
  signOut,
}: {
  name: string;
  /** e.g. "Admin" or "Host". */
  badge?: string;
  links: { href: string; emoji: string; label: string }[];
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 w-full items-center gap-1.5 rounded-2xl px-3 font-display font-semibold ring-2 transition-colors ${open ? "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-200" : "text-ink/75 ring-ink/10 hover:bg-fuchsia-50 hover:text-fuchsia-600"}`}
      >
        <span className="max-w-40 truncate">
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </span>
        {badge && (
          <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-bold text-violet-800">
            {badge}
          </span>
        )}
        <span aria-hidden className="ml-auto text-xs lg:ml-0">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`${name}'s menu`}
          className="animate-pop-in mt-1 flex flex-col gap-0.5 rounded-2xl bg-white p-1.5 shadow-[0_16px_40px_-16px_rgba(36,28,71,0.35)] ring-2 ring-ink/5 motion-reduce:animate-none lg:absolute lg:right-0 lg:z-40 lg:w-52"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={ITEM}
            >
              <span aria-hidden>{l.emoji}</span> {l.label}
            </Link>
          ))}
          <form action={signOut} className="border-t border-ink/5 pt-0.5">
            <button
              type="submit"
              role="menuitem"
              className={`${ITEM} hover:bg-rose-50 hover:text-rose-600`}
            >
              <span aria-hidden>🚪</span> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
