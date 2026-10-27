import { describe, expect, it } from "vitest";
import {
  BANNER,
  bannerError,
  bannerUrl,
  initials,
  placeholderTheme,
  PLACEHOLDER_THEMES,
} from "./banner";

describe("bannerError", () => {
  it("accepts a small JPEG, PNG, or WebP", () => {
    for (const t of BANNER.types) expect(bannerError(t, 1000)).toBeNull();
  });

  it("names what's wrong", () => {
    expect(bannerError("image/gif", 10)).toBe("Use a JPEG, PNG, or WebP image");
    expect(bannerError("image/png", 0)).toBe("Pick a banner first");
    expect(bannerError("image/png", BANNER.maxBytes + 1)).toBe(
      "That banner is too big (max 600 KB)",
    );
  });
});

describe("bannerUrl", () => {
  it("is versioned by upload time, or null with no banner", () => {
    expect(bannerUrl("p1", new Date(5))).toBe("/banners/p1?v=5");
    expect(bannerUrl("p1", null)).toBeNull();
  });
});

describe("placeholderTheme", () => {
  it("picks the same theme for the same id", () => {
    expect(placeholderTheme("abc")).toBe(placeholderTheme("abc"));
    expect(PLACEHOLDER_THEMES).toContain(placeholderTheme(""));
  });

  it("spreads ids across the themes", () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => placeholderTheme(`id-${i}`)),
    );
    expect(seen.size).toBe(PLACEHOLDER_THEMES.length);
  });
});

describe("initials", () => {
  it("takes the first letter of up to two words", () => {
    expect(initials("Makati Dinkers Club")).toBe("MD");
    expect(initials("  pop ")).toBe("P");
    expect(initials("")).toBe("");
  });
});
