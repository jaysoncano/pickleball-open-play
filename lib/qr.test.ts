import { describe, expect, it } from "vitest";
import { claimUrl, originFrom, qrSvg } from "./qr";

describe("qr", () => {
  it("builds the claim URL", () => {
    expect(claimUrl("https://pop.app/", "abc")).toBe(
      "https://pop.app/claim/abc",
    );
  });

  it("reads the origin from headers", () => {
    expect(originFrom(new Headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
    expect(originFrom(new Headers({ host: "pop.app" }))).toBe(
      "https://pop.app",
    );
    expect(
      originFrom(
        new Headers({
          host: "internal",
          "x-forwarded-host": "pop.club",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://pop.club");
    expect(originFrom(new Headers())).toBe("http://localhost:3000");
  });

  it("renders an SVG", async () => {
    const svg = await qrSvg("https://pop.app/claim/abc");
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain("#241c47");
  });
});
