/** Rotating court colors; full class strings so Tailwind can find them. */
const themes = [
  {
    surface: "bg-sky-400",
    card: "bg-sky-50 ring-sky-200",
    badge: "bg-sky-500 text-white",
    button: "bg-sky-500 text-white shadow-[0_4px_0_0_#0369a1] hover:bg-sky-400",
  },
  {
    surface: "bg-lime-400",
    card: "bg-lime-50 ring-lime-200",
    badge: "bg-lime-500 text-lime-950",
    button:
      "bg-lime-400 text-lime-950 shadow-[0_4px_0_0_#4d7c0f] hover:bg-lime-300",
  },
  {
    surface: "bg-fuchsia-400",
    card: "bg-fuchsia-50 ring-fuchsia-200",
    badge: "bg-fuchsia-500 text-white",
    button:
      "bg-fuchsia-500 text-white shadow-[0_4px_0_0_#a21caf] hover:bg-fuchsia-400",
  },
  {
    surface: "bg-amber-400",
    card: "bg-amber-50 ring-amber-200",
    badge: "bg-amber-400 text-amber-950",
    button:
      "bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#b45309] hover:bg-amber-300",
  },
  {
    surface: "bg-violet-400",
    card: "bg-violet-50 ring-violet-200",
    badge: "bg-violet-500 text-white",
    button:
      "bg-violet-500 text-white shadow-[0_4px_0_0_#6d28d9] hover:bg-violet-400",
  },
  {
    surface: "bg-emerald-400",
    card: "bg-emerald-50 ring-emerald-200",
    badge: "bg-emerald-500 text-white",
    button:
      "bg-emerald-500 text-white shadow-[0_4px_0_0_#047857] hover:bg-emerald-400",
  },
] as const;

export function courtTheme(index: number) {
  return themes[index % themes.length];
}
