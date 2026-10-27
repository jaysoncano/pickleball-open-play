import { describe, expect, it } from "vitest";
import {
  CourtsSchema,
  firstError,
  PlayerNameSchema,
  ScheduleSchema,
  SessionDateSchema,
} from "./schema";

describe("schemas", () => {
  it("validates the session date", () => {
    expect(firstError(SessionDateSchema.safeParse("2026-10-27"))).toBeNull();
    expect(firstError(SessionDateSchema.safeParse(""))).toMatch(/date/);
    expect(firstError(SessionDateSchema.safeParse("2026-13-01"))).toMatch(
      /date/,
    );
  });

  it("validates the schedule", () => {
    expect(
      firstError(
        ScheduleSchema.safeParse({ startTime: "18:00", endTime: "20:00" }),
      ),
    ).toBeNull();
    expect(
      firstError(
        ScheduleSchema.safeParse({ startTime: "18:00", endTime: "18:00" }),
      ),
    ).toMatch(/different/);
    expect(
      firstError(
        ScheduleSchema.safeParse({ startTime: "25:00", endTime: "20:00" }),
      ),
    ).toMatch(/valid time/);
  });

  it("validates courts and names", () => {
    expect(
      firstError(CourtsSchema.safeParse({ courtCount: 0, playersPerCourt: 4 })),
    ).toMatch(/at least one/);
    expect(
      firstError(CourtsSchema.safeParse({ courtCount: 2, playersPerCourt: 3 })),
    ).not.toBeNull();
    expect(firstError(PlayerNameSchema.safeParse("  "))).toMatch(/Enter/);
  });
});
