import { describe, expect, it } from "vitest";
import {
  canInvite,
  canManage,
  GroupNameSchema,
  logoUrl,
  RoleSchema,
  VenueSchema,
  venueLabel,
} from "./roles";

describe("canManage", () => {
  const play = { createdBy: "h1", hostIds: ["h2"] };

  it("lets admins run every open play", () => {
    expect(canManage({ id: "a", role: "admin" }, play)).toBe(true);
    expect(
      canManage({ id: "a", role: "admin" }, { createdBy: null, hostIds: [] }),
    ).toBe(true);
  });

  it("lets a host run theirs and ones they're invited to", () => {
    expect(canManage({ id: "h1", role: "host" }, play)).toBe(true);
    expect(canManage({ id: "h2", role: "host" }, play)).toBe(true);
    expect(canManage({ id: "h3", role: "host" }, play)).toBe(false);
  });

  it("refuses without an account or an open play", () => {
    expect(canManage(null, play)).toBe(false);
    expect(canManage({ id: "a", role: "admin" }, null)).toBe(false);
  });
});

describe("canInvite", () => {
  const play = { createdBy: "h1", hostIds: ["h2"] };

  it("lets only the main host and admins choose who hosts", () => {
    expect(canInvite({ id: "h1", role: "host" }, play)).toBe(true);
    expect(canInvite({ id: "a", role: "admin" }, play)).toBe(true);
    expect(canInvite({ id: "h2", role: "host" }, play)).toBe(false);
    expect(canInvite({ id: "h3", role: "host" }, play)).toBe(false);
  });

  it("refuses without an account or an open play", () => {
    expect(canInvite(null, play)).toBe(false);
    expect(canInvite({ id: "a", role: "admin" }, null)).toBe(false);
    expect(
      canInvite({ id: "h1", role: "host" }, { createdBy: null, hostIds: [] }),
    ).toBe(false);
  });
});

describe("RoleSchema", () => {
  it("accepts the two levels only", () => {
    expect(RoleSchema.parse("host")).toBe("host");
    expect(RoleSchema.safeParse("owner").error?.issues[0].message).toBe(
      "Pick an account level",
    );
  });
});

describe("venues", () => {
  it("trims and requires both parts", () => {
    expect(
      VenueSchema.parse({ venue: " Sunrise ", location: " Makati " }),
    ).toEqual({ venue: "Sunrise", location: "Makati" });
    expect(
      VenueSchema.safeParse({ venue: "x".repeat(81), location: "M" }).error
        ?.issues[0].message,
    ).toBe("Venue names are up to 80 characters");
    expect(
      VenueSchema.safeParse({ venue: "S", location: "x".repeat(161) }).error
        ?.issues[0].message,
    ).toBe("Locations are up to 160 characters");
  });

  it("labels whichever parts are set", () => {
    expect(venueLabel({ venue: "Sunrise", location: "Makati" })).toBe(
      "Sunrise · Makati",
    );
    expect(venueLabel({ venue: "", location: "" })).toBe("");
  });
});

describe("groups", () => {
  it("trims names and bounds their length", () => {
    expect(GroupNameSchema.parse(" Dinkers ")).toBe("Dinkers");
    expect(
      GroupNameSchema.safeParse("x".repeat(61)).error?.issues[0].message,
    ).toBe("Group names are up to 60 characters");
  });

  it("versions logo URLs, or none without a logo", () => {
    expect(logoUrl("a1", new Date(5))).toBe("/groups/a1/logo?v=5");
    expect(logoUrl("a1", null)).toBeNull();
  });
});
