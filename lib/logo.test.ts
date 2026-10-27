import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_DATA_URI, LOGO_SVG } from "./logo";

describe("logo", () => {
  it("app/icon.svg (the favicon) matches the shared logo", () => {
    const icon = readFileSync(join(__dirname, "..", "app", "icon.svg"), "utf8");
    expect(icon).toBe(LOGO_SVG);
  });

  it("encodes as a data URI", () => {
    expect(decodeURIComponent(LOGO_DATA_URI)).toBe(
      `data:image/svg+xml,${LOGO_SVG}`,
    );
  });
});
