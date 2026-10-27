/** Where a player is in setting up their profile. */
export type ProfileStatus = "new" | "verified" | "complete";

export type ProfileFacts = {
  hasEmail: boolean;
  firstName: string;
  lastName: string;
  hasPhoto: boolean;
};

export const STATUS_INFO: Record<
  ProfileStatus,
  { label: string; tone: string; icon: string }
> = {
  new: {
    label: "Needs setup",
    tone: "bg-amber-100 text-amber-900",
    icon: "📱",
  },
  verified: {
    label: "Info missing",
    tone: "bg-sky-100 text-sky-800",
    icon: "✏️",
  },
  complete: { label: "Complete", tone: "bg-lime-200 text-lime-900", icon: "✓" },
};

/** Setup steps, in the order a player should do them. */
export const PROFILE_STEPS = [
  "Add email",
  "Add first & last name",
  "Add a photo",
] as const;

const stepDone: Record<
  (typeof PROFILE_STEPS)[number],
  (p: ProfileFacts) => boolean
> = {
  "Add email": (p) => p.hasEmail,
  "Add first & last name": (p) =>
    p.firstName.trim() !== "" && p.lastName.trim() !== "",
  "Add a photo": (p) => p.hasPhoto,
};

/** What's still missing, in step order. */
export function missingSteps(p: ProfileFacts): string[] {
  return PROFILE_STEPS.filter((step) => !stepDone[step](p));
}

/**
 * "new" until there's an email (the player verifies it with their QR code,
 * or an admin types it in at the desk),
 * "verified" while info is missing, "complete" with full name and photo.
 */
export function profileStatus(p: ProfileFacts): ProfileStatus {
  if (!p.hasEmail) return "new";
  return missingSteps(p).length ? "verified" : "complete";
}
