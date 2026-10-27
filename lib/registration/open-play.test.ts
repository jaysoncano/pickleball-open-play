import { describe, expect, it } from "vitest";
import type { Level } from "@/lib/ranking/levels";
import {
  joinProblem,
  OpenPlayEditSchema,
  OpenPlaySchema,
  overlaps,
  rankProblem,
  ranksLabel,
  soloProblem,
  strongest,
  spotsLeft,
  whenLabel,
  type Member,
} from "./open-play";

const base = {
  venue: " Sunrise Courts ",
  location: "Makati",
  playDate: "2026-10-27",
  startTime: "18:00",
  endTime: "20:00",
  levels: ["novice", "beginner"],
  fee: "300",
};

describe("OpenPlaySchema", () => {
  it("parses a range, optional cap, and fee in minor units", () => {
    expect(OpenPlaySchema.parse({ ...base, maxPairs: "" })).toEqual({
      venue: "Sunrise Courts",
      location: "Makati",
      playDate: "2026-10-27",
      startTime: "18:00",
      endTime: "20:00",
      levels: ["beginner", "novice"],
      maxPairs: null,
      feeCents: 30000,
    });
    expect(OpenPlaySchema.parse({ ...base, maxPairs: "12" }).maxPairs).toBe(12);
    expect(OpenPlaySchema.parse(base).maxPairs).toBeNull();
  });

  it.each([
    [{ ...base, levels: [] }, "Tick at least one rank"],
    [{ ...base, venue: "  " }, "Enter the venue name"],
    [{ ...base, location: "" }, "Enter the location"],
    [
      { ...base, endTime: "18:00" },
      "End time must be different from start time",
    ],
    [{ ...base, maxPairs: "1" }, "Allow at least 2 pairs (one court)"],
    [{ ...base, maxPairs: "2.5" }, "Max pairs must be a whole number"],
    [{ ...base, maxPairs: "999" }, "Up to 200 pairs"],
    [{ ...base, fee: "-1" }, "Fee can't be negative"],
    [{ ...base, levels: ["legend"] }, "Pick a level"],
  ])("rejects %j", (input, message) => {
    expect(OpenPlaySchema.safeParse(input).error?.issues[0].message).toBe(
      message,
    );
  });
});

describe("OpenPlayEditSchema", () => {
  it("parses the schedule without the venue", () => {
    expect(OpenPlayEditSchema.parse({ ...base, maxPairs: "8" })).toEqual({
      playDate: "2026-10-27",
      startTime: "18:00",
      endTime: "20:00",
      levels: ["beginner", "novice"],
      maxPairs: 8,
      feeCents: 30000,
    });
  });

  it("checks the times like scheduling does", () => {
    expect(
      OpenPlayEditSchema.safeParse({ ...base, endTime: "18:00" }).error
        ?.issues[0].message,
    ).toBe("End time must be different from start time");
  });
});

describe("ranks", () => {
  const play = { levels: ["beginner", "novice"] } as const satisfies {
    levels: ("beginner" | "novice")[];
  };
  const ranks = { levels: [...play.levels] };

  it("labels the ticked ranks", () => {
    expect(
      ranksLabel({
        levels: ["beginner", "novice", "intermediate", "advanced", "pro"],
      }),
    ).toBe("All levels");
    expect(ranksLabel({ levels: ["advanced"] })).toBe("Advanced");
    expect(ranksLabel(ranks)).toBe("Beginner & Novice");
    expect(ranksLabel({ levels: ["beginner", "novice", "pro"] })).toBe(
      "Beginner, Novice & Pro",
    );
    expect(ranksLabel({ levels: [] })).toBe("");
  });

  const ana = (level: Level): Member => ({ name: "Ana", level });
  const pairOf = (a: string, b: string) =>
    [
      { name: "Ana", level: a },
      { name: "Ben", level: b },
    ] as Parameters<typeof joinProblem>[1];

  it("lets a pair join its own rank, up to the cap", () => {
    const open = { ...ranks, maxPairs: null };
    expect(joinProblem(open, pairOf("novice", "beginner"), 50)).toBeNull();
    expect(joinProblem(open, pairOf("beginner", "beginner"), 0)).toBeNull();
    expect(
      joinProblem({ ...ranks, maxPairs: 4 }, pairOf("beginner", "beginner"), 4),
    ).toBe("This open play is full");
    expect(spotsLeft(null, 3)).toBeNull();
    expect(spotsLeft(4, 3)).toBe(1);
    expect(spotsLeft(4, 9)).toBe(0);
  });

  it("never lets a pair with a Novice join a lower rank", () => {
    const beginnerOnly = { levels: ["beginner" as const], maxPairs: null };
    // Either player being Novice makes it a Novice pair.
    expect(joinProblem(beginnerOnly, pairOf("beginner", "novice"), 0)).toBe(
      "Ben is Novice, so this pair can't join Beginner",
    );
    expect(joinProblem(beginnerOnly, pairOf("novice", "novice"), 0)).toBe(
      "Ana is Novice, so this pair can't join Beginner",
    );
    expect(
      rankProblem(
        { levels: ["beginner", "novice"] },
        pairOf("advanced", "beginner"),
      ),
    ).toBe("Ana is Advanced, so this pair can't join Beginner & Novice");
    // Below every rank, or between ranks.
    expect(
      rankProblem({ levels: ["novice"] }, pairOf("beginner", "beginner")),
    ).toBe(
      "Ana is Beginner, so this pair plays Beginner; this open play is for Novice",
    );
    expect(
      rankProblem(
        { levels: ["beginner", "advanced"] },
        pairOf("novice", "beginner"),
      ),
    ).toBe(
      "Ana is Novice, so this pair plays Novice; this open play is for Beginner & Advanced",
    );
    expect(rankProblem({ levels: ["novice"] }, [])).toBeNull();
    expect(strongest(pairOf("novice", "pro"))?.name).toBe("Ben");
  });

  it("only turns away solo players above every rank", () => {
    expect(soloProblem({ levels: ["novice"] }, ana("beginner"))).toBeNull();
    expect(soloProblem({ levels: ["beginner"] }, ana("novice"))).toBe(
      "Ana is Novice, so they can't join Beginner",
    );
    expect(soloProblem({ levels: [] }, ana("pro"))).toBeNull();
  });
});

describe("overlaps", () => {
  const at = (startTime: string, endTime: string, playDate = "2026-10-27") => ({
    playDate,
    startTime,
    endTime,
  });

  it("compares windows on the same day, including past midnight", () => {
    expect(overlaps(at("18:00", "20:00"), at("19:00", "21:00"))).toBe(true);
    expect(overlaps(at("18:00", "20:00"), at("20:00", "22:00"))).toBe(false);
    expect(
      overlaps(at("18:00", "20:00"), at("18:00", "20:00", "2026-10-28")),
    ).toBe(false);
    expect(overlaps(at("22:00", "01:00"), at("23:30", "23:45"))).toBe(true);
  });
});

describe("whenLabel", () => {
  it("shows the day and time window", () => {
    expect(
      whenLabel({
        playDate: "2026-10-27",
        startTime: "18:00",
        endTime: "20:30",
      }),
    ).toBe("Tue, Oct 27 · 6:00 PM – 8:30 PM");
  });
});
