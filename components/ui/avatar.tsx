import { initials } from "@/lib/queue/names";

const palette = [
  "bg-fuchsia-400 text-white",
  "bg-lime-400 text-lime-950",
  "bg-sky-400 text-white",
  "bg-amber-300 text-amber-950",
  "bg-violet-400 text-white",
  "bg-emerald-400 text-emerald-950",
  "bg-orange-400 text-white",
  "bg-rose-400 text-white",
  "bg-cyan-300 text-cyan-950",
];

function hash(value: string) {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

const sizes = {
  sm: "size-7 text-[11px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-28 text-3xl sm:size-32",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  /** Profile photo; initials show without one. */
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (src) {
    return (
      // Small, already-resized uploads served from our own route.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`inline-block shrink-0 rounded-full object-cover ring-2 ring-white ${sizes[size]} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ring-2 ring-white ${palette[hash(name) % palette.length]} ${sizes[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
