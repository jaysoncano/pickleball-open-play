import { z } from "zod";

export const HANDS = ["right", "left"] as const;
export type Hand = (typeof HANDS)[number];

export const HAND_LABEL: Record<Hand, string> = {
  right: "Right-handed",
  left: "Left-handed",
};

export const PROFILE_LIMITS = {
  firstName: 40,
  lastName: 40,
  email: 254,
  phone: 30,
  homeClub: 80,
  bio: 280,
} as const;

export const EmailSchema = z
  .string("Enter your email")
  .trim()
  .toLowerCase()
  .max(PROFILE_LIMITS.email, "That email is too long")
  .pipe(z.email("Enter a valid email"));

export const CodeSchema = z
  .string("Enter the code")
  .trim()
  .regex(/^\d{6}$/, "Enter the 6-digit code from the email");

const optional = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: up to ${max} characters`).default("");

const namePart = (label: string, max: number) =>
  z
    .string(`Enter the ${label}`)
    .trim()
    .min(1, `Enter the ${label}`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long`)
    .transform((n) => n.replace(/\s+/g, " "));

/** First and last name, both required. Shared by the profile and desk. */
export const NameFields = {
  firstName: namePart("first name", PROFILE_LIMITS.firstName),
  lastName: namePart("last name", PROFILE_LIMITS.lastName),
};

/** "Ana Dela Cruz" from its parts; "" when neither is set. */
export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/** A player's basic info. Email is private; the rest shows on the profile. */
export const ProfileSchema = z.object({
  ...NameFields,
  email: EmailSchema,
  phone: optional(PROFILE_LIMITS.phone, "Phone").refine(
    (p) => p === "" || /^[+\d][\d\s().-]{5,}$/.test(p),
    "Enter a valid phone number",
  ),
  homeClub: optional(PROFILE_LIMITS.homeClub, "Home club"),
  bio: optional(PROFILE_LIMITS.bio, "Bio"),
  hand: z
    .enum([...HANDS, ""])
    .default("")
    .transform((h) => (h === "" ? null : h)),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

export const PHOTO = {
  maxBytes: 300 * 1024,
  /** Longest side after the browser resizes the picked image. */
  maxSide: 512,
  types: ["image/jpeg", "image/png", "image/webp"],
} as const;

/** Why an uploaded photo can't be saved, or null when it's fine. */
export function photoError(type: string, size: number): string | null {
  if (!(PHOTO.types as readonly string[]).includes(type)) {
    return "Use a JPEG, PNG, or WebP image";
  }
  if (size === 0) return "Pick a photo first";
  if (size > PHOTO.maxBytes) return "That photo is too big (max 300 KB)";
  return null;
}

/**
 * "jayson@example.com" → "j•••••": only the first letter, as a hint of
 * which email is linked. Never shows the rest or the domain publicly.
 */
export function maskEmail(email: string): string {
  const first = email.trim()[0];
  return first && first !== "@" ? `${first}•••••` : "•••••";
}

/** URL of a player's photo, versioned so a new upload isn't cached. */
export function photoUrl(
  playerId: string,
  updatedAt: Date | null,
): string | null {
  return updatedAt
    ? `/players/${playerId}/photo?v=${updatedAt.getTime()}`
    : null;
}
