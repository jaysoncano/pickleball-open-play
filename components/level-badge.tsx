import { LEVEL_INFO, type Level } from "@/lib/ranking/levels";

export function LevelBadge({
  level,
  size = "md",
}: {
  level: Level;
  size?: "sm" | "md";
}) {
  const { label, tone } = LEVEL_INFO[level];
  return (
    <span
      className={`inline-block rounded-full font-bold whitespace-nowrap ${tone} ${size === "sm" ? "px-1.5 text-[10px] uppercase" : "px-2.5 py-0.5 text-xs"}`}
    >
      {label}
    </span>
  );
}
