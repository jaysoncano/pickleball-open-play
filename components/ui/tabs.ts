/**
 * Tab bar styles shared by client and server components (the host
 * dashboard, the public board). Mobile first: on phones each tab is the
 * emoji over a short label and the bar scrolls sideways if it must; from
 * `md` (768px) up, one row of equal tabs.
 */
export const TAB_BAR =
  "flex snap-x gap-1 overflow-x-auto rounded-[1.75rem] bg-white/85 p-1.5 shadow-[0_10px_30px_-15px_rgba(36,28,71,0.4)] ring-2 ring-white backdrop-blur-md [scrollbar-width:none] md:gap-1.5 [&::-webkit-scrollbar]:hidden";
export const TAB =
  "relative flex min-h-14 min-w-[3.75rem] flex-1 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-3xl px-1.5 font-display text-[11px] leading-tight font-semibold whitespace-nowrap transition-all focus-visible:outline-4 focus-visible:outline-sky-400 md:min-h-12 md:min-w-0 md:shrink md:flex-row md:gap-2 md:px-2 md:text-base lg:text-lg";
export const TAB_ON = "bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf]";
export const TAB_OFF = "text-ink/60 hover:bg-fuchsia-50 hover:text-fuchsia-600";
export const TAB_EMOJI = "text-xl leading-none md:text-base";
