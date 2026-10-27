/**
 * Open play banners: upload rules, URLs, and the generated placeholder
 * shown when a host hasn't uploaded one. Client-safe.
 */

export const BANNER = {
  maxBytes: 600 * 1024,
  /** Widest side after the browser resizes the picked image. */
  maxWidth: 1600,
  types: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Why an uploaded banner can't be saved, or null when it's fine. */
export function bannerError(type: string, size: number): string | null {
  if (!(BANNER.types as readonly string[]).includes(type)) {
    return "Use a JPEG, PNG, or WebP image";
  }
  if (size === 0) return "Pick a banner first";
  if (size > BANNER.maxBytes) return "That banner is too big (max 600 KB)";
  return null;
}

/** Versioned, so the image can be cached forever. */
export function bannerUrl(
  openPlayId: string,
  updatedAt: Date | null,
): string | null {
  return updatedAt ? `/banners/${openPlayId}?v=${updatedAt.getTime()}` : null;
}

export type PlaceholderTheme = {
  /** CSS gradient for the banner. */
  background: string;
  /** Text and logo tint that reads on it. */
  ink: string;
};

export const PLACEHOLDER_THEMES: readonly PlaceholderTheme[] = [
  { background: "linear-gradient(135deg,#a3e635,#22d3ee)", ink: "#14532d" },
  { background: "linear-gradient(135deg,#f472b6,#a78bfa)", ink: "#4c1d95" },
  { background: "linear-gradient(135deg,#fbbf24,#fb7185)", ink: "#7c2d12" },
  { background: "linear-gradient(135deg,#38bdf8,#818cf8)", ink: "#1e3a8a" },
  { background: "linear-gradient(135deg,#34d399,#facc15)", ink: "#064e3b" },
  { background: "linear-gradient(135deg,#c084fc,#f472b6)", ink: "#581c87" },
];

/** A stable theme per id, so each open play keeps its own colors. */
export function placeholderTheme(id: string): PlaceholderTheme {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_THEMES[hash % PLACEHOLDER_THEMES.length];
}

/** "Makati Dinkers" → "MD": the logo placeholder for a named group. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
