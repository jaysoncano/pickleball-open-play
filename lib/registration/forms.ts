import { z } from "zod";
import { EmailSchema, NameFields } from "@/lib/profile/forms";
import { nameKey } from "@/lib/queue/names";
import { PlayerNameSchema } from "@/lib/queue/schema";
import {
  LevelSchema,
  levelRank,
  LEVELS,
  type Level,
} from "@/lib/ranking/levels";

/** How a booth payment was made. Online card payments come later. */
export const PAYMENT_METHODS = ["cash", "ewallet", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  ewallet: "E-wallet",
  card: "Card at the booth",
};

export const MAX_FEE = 100_000;

/** One player at the booth: an existing player or a new name. */
const PersonSchema = z
  .object({
    playerId: z.string().trim().default(""),
    name: z.string().trim().default(""),
    ...NameFields,
    email: EmailSchema,
  })
  .refine((p) => p.playerId || PlayerNameSchema.safeParse(p.name).success, {
    message: "Pick a player or enter a new name",
    path: ["name"],
  })
  .transform((p) => ({ ...p, name: p.name.replace(/\s+/g, " ") }));

export type Person = z.infer<typeof PersonSchema>;

/** The pair's entry fee, paid in full at the booth. */
const OpenPlayId = z.uuid("Pick an open play");

const EntryFields = {
  openPlayId: OpenPlayId,
  amount: z.coerce
    .number("Enter the amount paid")
    .min(0, "Amount can't be negative")
    .max(MAX_FEE, "That amount looks too high"),
  method: z.enum(PAYMENT_METHODS, "Pick how they paid"),
  reference: z.string().trim().max(80, "Reference is too long").default(""),
};

const toCents = <T extends { amount: number }>({ amount, ...rest }: T) => ({
  ...rest,
  amountCents: Math.round(amount * 100),
});

function samePerson(a: Person, b: Person) {
  return (
    (a.playerId !== "" && a.playerId === b.playerId) ||
    (a.name !== "" && nameKey(a.name) === nameKey(b.name)) ||
    a.email === b.email
  );
}

/** A pair joining open play: two players and one entry for both. */
export const PairRegistrationSchema = z
  .object({ ...EntryFields, a: PersonSchema, b: PersonSchema })
  .refine((r) => !samePerson(r.a, r.b), {
    message: "Pick two different players with different emails",
    path: ["b"],
  })
  .transform(toCents);

export type PairRegistration = z.infer<typeof PairRegistrationSchema>;

/** A pair registered at the desk who will pay later; the host confirms it. */
export const UnpaidPairSchema = z
  .object({ openPlayId: OpenPlayId, a: PersonSchema, b: PersonSchema })
  .refine((r) => !samePerson(r.a, r.b), {
    message: "Pick two different players with different emails",
    path: ["b"],
  });

export type UnpaidPair = z.infer<typeof UnpaidPairSchema>;

/** A player alone, looking for a partner. The pair pays once paired. */
export const SoloRegistrationSchema = z.object({
  openPlayId: OpenPlayId,
  a: PersonSchema,
});

export type SoloRegistration = z.infer<typeof SoloRegistrationSchema>;

/** The desk pairs two solo players, and the pair pays the full entry. */
export const PairUpSchema = z
  .object({
    ...EntryFields,
    a: z.object({ playerId: z.string().min(1, "Pick two players") }),
    b: z.object({ playerId: z.string().min(1, "Pick two players") }),
  })
  .refine((r) => r.a.playerId !== r.b.playerId, {
    message: "Pick two different players",
    path: ["b"],
  })
  .transform(toCents);

export type PairUp = z.infer<typeof PairUpSchema>;

/** A player on the public sign-up form: always by name and email. */
const PublicPersonSchema = z
  .object({
    name: PlayerNameSchema,
    ...NameFields,
    email: EmailSchema,
  })
  .transform((p) => ({
    ...p,
    playerId: "",
    name: p.name.replace(/\s+/g, " "),
  }));

/**
 * A pair signing themselves up online for one rank of an open play. It
 * waits as "pending payment" until an admin confirms it at the booth.
 */
export const PublicSignupSchema = z
  .object({
    openPlayId: OpenPlayId,
    rank: LevelSchema,
    a: PublicPersonSchema,
    b: PublicPersonSchema,
  })
  .refine((r) => !samePerson(r.a, r.b), {
    message: "Enter two different players with different emails",
    path: ["b"],
  });

export type PublicSignup = z.infer<typeof PublicSignupSchema>;

/**
 * A player signing up alone online for a rank. They wait on the "looking
 * for a partner" list; the desk pairs them and the pair pays at the booth.
 */
export const PublicSoloSchema = z.object({
  openPlayId: OpenPlayId,
  rank: LevelSchema,
  a: PublicPersonSchema,
});

export type PublicSolo = z.infer<typeof PublicSoloSchema>;

/** The admin confirms a pending pair's payment, received at the booth. */
export const ConfirmPaymentSchema = z
  .object({
    pairId: z.uuid("Pick a pair"),
    amount: EntryFields.amount,
    method: EntryFields.method,
    reference: EntryFields.reference,
  })
  .transform(toCents);

export type ConfirmPayment = z.infer<typeof ConfirmPaymentSchema>;

/**
 * Group "a_name", "b_email"… form fields into `{ a: {…}, b: {…} }`, so the
 * schemas above can parse a flat HTML form.
 */
export function nestForm(
  entries: Iterable<[string, FormDataEntryValue]>,
): Record<string, unknown> {
  const out: Record<string, Record<string, unknown> | unknown> = {};
  for (const [key, value] of entries) {
    const m = key.match(/^(a|b)_(\w+)$/);
    if (m) {
      const group = (out[m[1]] ??= {}) as Record<string, unknown>;
      group[m[2]] = value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** "Ana & Ben" */
export function pairName(names: string[]): string {
  return names.join(" & ");
}

/** A pair plays at its stronger player's level. */
export function pairLevel(levels: Level[]): Level {
  return levels.reduce<Level>(
    (top, l) => (levelRank(l) > levelRank(top) ? l : top),
    LEVELS[0],
  );
}

/** "₱150.00" for 15000 centavos in PHP. */
export function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(
      cents / 100,
    );
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

/** Default fee in minor units from `OPEN_PLAY_FEE` (major units, e.g. 150). */
export function feeCents(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= MAX_FEE ? Math.round(n * 100) : 0;
}

/** Default fee and currency for the booth form (`OPEN_PLAY_FEE`, `CURRENCY`). */
export function openPlayFee(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    cents: feeCents(env.OPEN_PLAY_FEE),
    currency: env.CURRENCY || "PHP",
  };
}
