"use client";

import { useState } from "react";

/**
 * Nav links: inline from `lg` up, behind a Menu button on phones. Tapping a
 * link or button closes the menu (not a menu toggle, like the user menu).
 */
export function NavMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/70 px-4 font-display font-semibold text-ink/70 ring-2 ring-white lg:hidden"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span> Menu
      </button>
      <div
        id="site-menu"
        onClick={(e) => {
          if ((e.target as Element).closest("a, button:not([aria-haspopup])"))
            setOpen(false);
        }}
        className={`${open ? "flex" : "hidden"} w-full flex-col gap-1 rounded-3xl bg-white/80 p-2 shadow-[0_20px_60px_-25px_rgba(36,28,71,0.35)] ring-2 ring-white lg:flex lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0`}
      >
        {children}
      </div>
    </>
  );
}
