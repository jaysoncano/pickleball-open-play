import {
  formatMoney,
  MAX_NOTES,
  METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/registration/forms";

export type Fee = { cents: number; currency: string };

/** Remembered between pairs: the last payment method used. */
export type EntryDefaults = { method: PaymentMethod };

export const INPUT =
  "min-h-11 rounded-2xl bg-sky-50 px-3 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/** The host's notes on the pair. Kept at the desk, never emailed. */
export function NotesField({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink/60">
        Notes <span className="font-semibold text-ink/40">(optional)</span>
      </span>
      <input
        name="notes"
        maxLength={MAX_NOTES}
        autoComplete="off"
        defaultValue={defaultValue}
        placeholder="e.g. paid half, own paddles"
        className={INPUT}
      />
    </label>
  );
}

/** The pair's entry, paid in full: amount, how, and the host's notes. */
export function EntryFields({
  fee,
  defaults,
  onChange,
  notes,
}: {
  fee: Fee;
  /** Start from this method instead of cash. The amount is always the fee. */
  defaults?: EntryDefaults;
  /** Remembers what the host picked, for the next pair. */
  onChange?: (next: EntryDefaults) => void;
  /** Notes already on file (confirming an unpaid pair). */
  notes?: string;
}) {
  const method = defaults?.method ?? "cash";
  return (
    <fieldset className="grid gap-2 rounded-2xl bg-lime-50 p-3 ring-2 ring-lime-100 sm:grid-cols-2">
      <legend className="px-1 font-display font-semibold text-lime-900">
        Entry for the pair
        <span className="ml-2 text-sm font-semibold text-lime-800/70">
          {fee.cents > 0
            ? `fee ${formatMoney(fee.cents, fee.currency)}`
            : "no entry fee set for this open play"}
        </span>
      </legend>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">
          Amount ({fee.currency})
        </span>
        <input
          name="amount"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          required
          defaultValue={fee.cents ? fee.cents / 100 : ""}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">Paid by</span>
        <select
          name="method"
          required
          defaultValue={method}
          onChange={(e) =>
            onChange?.({ method: e.target.value as PaymentMethod })
          }
          className="min-h-11 rounded-2xl bg-white px-3 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <NotesField defaultValue={notes} />
      </div>
    </fieldset>
  );
}
