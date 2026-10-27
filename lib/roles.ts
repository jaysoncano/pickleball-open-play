import { z } from "zod";

/**
 * Staff account levels. An admin runs the whole club; a host runs only
 * the open plays they scheduled or were invited to.
 */
export const ROLES = ["admin", "host"] as const;
export type Role = (typeof ROLES)[number];

export const RoleSchema = z.enum(ROLES, "Pick an account level");

export const ROLE_INFO: Record<Role, { label: string; blurb: string }> = {
  admin: {
    label: "Admin",
    blurb:
      "Everything: every open play, levels, protests, QR codes, and accounts.",
  },
  host: {
    label: "Host",
    blurb:
      "Schedules and runs their own open plays, and ones they're invited to.",
  },
};

export type Account = { id: string; username: string; role: Role };

/** Who runs an open play: its creator and the hosts they invited. */
export type Managers = { createdBy: string | null; hostIds: string[] };

/** Admins manage every open play; a host, only theirs or ones they're invited to. */
export function canManage(
  account: Pick<Account, "id" | "role"> | null,
  play: Managers | null,
): boolean {
  if (!account || !play) return false;
  return (
    account.role === "admin" ||
    play.createdBy === account.id ||
    play.hostIds.includes(account.id)
  );
}

/** The group a host runs open plays as, e.g. "Makati Dinkers". */
export const GroupNameSchema = z
  .string("Enter your group's name")
  .trim()
  .min(2, "Enter your group's name")
  .max(60, "Group names are up to 60 characters");

/** A group's logo, versioned so it can cache forever. */
export function logoUrl(
  adminId: string,
  updatedAt: Date | null,
): string | null {
  return updatedAt ? `/groups/${adminId}/logo?v=${updatedAt.getTime()}` : null;
}

/** Venue and location typed when scheduling; reused as suggestions. */
export const VenueSchema = z.object({
  venue: z
    .string("Enter the venue name")
    .trim()
    .min(1, "Enter the venue name")
    .max(80, "Venue names are up to 80 characters"),
  location: z
    .string("Enter the location")
    .trim()
    .min(1, "Enter the location")
    .max(160, "Locations are up to 160 characters"),
});

export type Venue = z.infer<typeof VenueSchema>;

/** "Sunrise Courts · Makati" (or whichever part is set). */
export function venueLabel(v: Partial<Venue>): string {
  return [v.venue, v.location].filter(Boolean).join(" · ");
}
