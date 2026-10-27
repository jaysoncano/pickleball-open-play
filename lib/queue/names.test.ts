import { describe, expect, it } from "vitest";
import { initials, nameKey, parseNames, previewNames } from "./names";
import { MAX_NAME_LENGTH } from "./schema";

describe("parseNames", () => {
  it("splits on commas and new lines and tidies spacing", () => {
    expect(parseNames(" Ana ,Ben\n\n  Carla   Diaz ")).toEqual([
      "Ana",
      "Ben",
      "Carla Diaz",
    ]);
  });

  it("drops repeats, ignoring case, and names already taken", () => {
    expect(parseNames("Ana, ana, Ben, BEN", ["ben"])).toEqual(["Ana"]);
  });

  it("trims long names", () => {
    const [name] = parseNames("x".repeat(MAX_NAME_LENGTH + 10));
    expect(name).toHaveLength(MAX_NAME_LENGTH);
  });

  it("normalizes keys", () => {
    expect(nameKey("  Carla   DIAZ ")).toBe("carla diaz");
  });
});

describe("initials", () => {
  it("uses first and last name, or the first two letters", () => {
    expect(initials("carla maria diaz")).toBe("CD");
    expect(initials("ana")).toBe("AN");
    expect(initials("   ")).toBe("?");
  });
});

describe("previewNames", () => {
  it("splits new names from ones already added", () => {
    expect(previewNames("Ana, ben, Cy, cy", ["Ben"])).toEqual({
      toAdd: ["Ana", "Cy"],
      skipped: ["ben"],
    });
  });

  it("handles a single name and empty input", () => {
    expect(previewNames("  Dee ", [])).toEqual({ toAdd: ["Dee"], skipped: [] });
    expect(previewNames(" , ", ["Ana"])).toEqual({ toAdd: [], skipped: [] });
  });
});
