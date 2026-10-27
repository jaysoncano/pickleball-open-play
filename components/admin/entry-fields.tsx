import {
  formatMoney,
  METHOD_LABEL,
  PAYMENT_METHODS,
} from "@/lib/registration/forms";

export type Fee = { cents: number; currency: string };

export const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

/** The pair's entry, paid in full: amount, how, and an optional reference. */
export function EntryFields({ fee }: { fee: Fee }) {
  return (
    <fieldset className="grid gap-3 rounded-2xl bg-lime-50 p-3 ring-2 ring-lime-100 sm:grid-cols-3">
      <legend className="px-1 font-display font-semibold text-lime-900">
        Entry for the pair (paid in full)
        {fee.cents > 0 && (
          <span className="ml-2 text-sm font-semibold text-lime-800/70">
            fee {formatMoney(fee.cents, fee.currency)}
          </span>
        )}
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
          defaultValue="cash"
          className="min-h-12 rounded-2xl bg-white px-4 font-semibold ring-2 ring-ink/10 outline-none focus:ring-sky-400"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink/60">
          Reference{" "}
          <span className="font-semibold text-ink/40">(optional)</span>
        </span>
        <input
          name="reference"
          maxLength={80}
          autoComplete="off"
          className={INPUT}
        />
      </label>
    </fieldset>
  );
}
