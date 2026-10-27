import { MAX_NAME_LENGTH } from "./schema";

export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Split pasted text ("Ana, Ben\nCy") into clean, unique names. Names already
 * in `existing` are skipped, as are repeats within the input.
 */
export function parseNames(input: string, existing: string[] = []): string[] {
  const seen = new Set(existing.map(nameKey));
  const result: string[] = [];
  for (const raw of input.split(/[\n,]/)) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
    const key = nameKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * What adding `input` would do: the new names, and the ones skipped
 * because they're already on the list.
 */
export function previewNames(input: string, existing: string[]) {
  const all = parseNames(input);
  const taken = new Set(existing.map(nameKey));
  return {
    toAdd: all.filter((name) => !taken.has(nameKey(name))),
    skipped: all.filter((name) => taken.has(nameKey(name))),
  };
}
