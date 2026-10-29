"use client";

import { useActionState, useState } from "react";
import { createOpenPlay, type FormState } from "@/app/actions";
import { BannerField } from "@/components/open-plays/banner-forms";
import { Button } from "@/components/ui/button";
import { dateInput } from "@/lib/queue/time";
import { LEVEL_INFO, LEVELS, type Level } from "@/lib/ranking/levels";
import {
  KIND_INFO,
  MAX_PAIRS,
  OPEN_PLAY_KINDS,
  ranksLabel,
} from "@/lib/registration/open-play";
import type { Venue } from "@/lib/roles";
import { useNow } from "@/lib/use-now";

/** The placeholder banner for an open play not saved yet. */
const NEW_PLAY = { id: "new", bannerUpdatedAt: null, venue: "" };

const INPUT =
  "min-h-12 rounded-2xl bg-sky-50 px-4 text-base ring-2 ring-sky-100 outline-none focus:ring-sky-400";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink/60">{label}</span>
      {children}
    </label>
  );
}

/** Staff: schedule an open play; saving opens its Manage page. */
export function CreateOpenPlay({
  feeCents,
  venues,
  group,
}: {
  feeCents: number;
  /** Venues used before, newest first: the autocomplete. */
  venues: Venue[];
  /** The account's group so far ("" and null until set). */
  group: { name: string; logo: string | null };
}) {
  const now = useNow();
  const [state, action, pending] = useActionState<FormState, FormData>(
    createOpenPlay,
    { error: null },
  );
  return (
    <section
      aria-labelledby="create-title"
      className="w-full rounded-[2rem] bg-white/80 p-4 ring-2 ring-white backdrop-blur sm:p-6"
    >
      <h2 id="create-title" className="sr-only">
        Open play details
      </h2>
      <form action={action} className="flex flex-col gap-4">
        <KindField />
        <BannerField play={NEW_PLAY} />
        <VenueFields venues={venues} />
        <GroupFields group={group} />

        {/* Remount once the clock is known, so the date starts on today. */}
        <ScheduleFields
          key={now ? "today" : "pending"}
          defaults={{
            playDate: now ? dateInput(now) : undefined,
            startTime: "18:00",
            endTime: "20:00",
            levels: [LEVELS[0]],
            maxPairs: null,
            fee: feeCents / 100,
          }}
        />

        {state.error && (
          <p role="alert" className="text-sm font-semibold text-rose-600">
            {state.error}
          </p>
        )}
        <p className="text-sm text-ink/60">
          Next you&apos;ll land on its Manage page to invite co-hosts and check
          the details.
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Scheduling…" : "Schedule open play"}
        </Button>
      </form>
    </section>
  );
}

/**
 * Venue name and location, suggested from past open plays. Picking a
 * saved venue fills in its location.
 */
export function VenueFields({
  venues,
  initial = venues[0],
}: {
  venues: Venue[];
  /** Starting values: the latest venue unless given. */
  initial?: Venue;
}) {
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");

  function pickVenue(name: string) {
    setVenue(name);
    const saved = venues.find(
      (v) => v.venue.toLowerCase() === name.trim().toLowerCase(),
    );
    if (saved) setLocation(saved.location);
  }

  const locations = [...new Set(venues.map((v) => v.location))];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Venue name">
        <input
          name="venue"
          required
          maxLength={80}
          list="venue-options"
          autoComplete="off"
          placeholder="e.g. Sunrise Courts"
          value={venue}
          onChange={(e) => pickVenue(e.target.value)}
          className={INPUT}
        />
      </Field>
      <Field label="Location">
        <input
          name="location"
          required
          maxLength={160}
          list="location-options"
          autoComplete="off"
          placeholder="Street, city"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={INPUT}
        />
      </Field>
      <datalist id="venue-options">
        {venues.map((v) => (
          <option key={v.venue} value={v.venue}>
            {v.location}
          </option>
        ))}
      </datalist>
      <datalist id="location-options">
        {locations.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
    </div>
  );
}

/**
 * Optional: the group hosting it and its logo. Saved to the account, so
 * every open play it schedules shows them, and its public page uses them.
 */
function GroupFields({
  group,
}: {
  group: { name: string; logo: string | null };
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? group.logo;
  return (
    <fieldset className="rounded-2xl bg-sky-50/60 p-3 ring-2 ring-sky-100">
      <legend className="px-1 font-display font-semibold text-sky-900">
        Hosted by <span className="font-normal text-ink/50">(optional)</span>
      </legend>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-2 ring-sky-100">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden className="text-2xl">
              🏓
            </span>
          )}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <Field label="Group name">
            <input
              name="groupName"
              maxLength={60}
              defaultValue={group.name}
              placeholder="e.g. Makati Dinkers"
              className={INPUT}
            />
          </Field>
          <Field label="Logo (JPEG, PNG, or WebP, up to 300 KB)">
            <input
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="min-h-12 text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-sky-100 file:px-3 file:font-semibold file:text-sky-900"
            />
          </Field>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink/60">
        Players see it on your open plays and on your group&apos;s public page.
        Change it any time in Settings.
      </p>
    </fieldset>
  );
}

/** Starting values for the schedule fields. */
export type ScheduleDefaults = {
  playDate?: string;
  startTime: string;
  endTime: string;
  levels: Level[];
  maxPairs: number | null;
  /** Whole currency units. */
  fee: number;
};

/** Date and times, ranks, cap, and entry: scheduling and editing. */
export function ScheduleFields({ defaults }: { defaults: ScheduleDefaults }) {
  const [levels, setLevels] = useState<Level[]>(defaults.levels);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date">
          <input
            name="playDate"
            type="date"
            required
            defaultValue={defaults.playDate}
            className={INPUT}
          />
        </Field>
        <Field label="Starts">
          <input
            name="startTime"
            type="time"
            required
            defaultValue={defaults.startTime}
            className={INPUT}
          />
        </Field>
        <Field label="Ends">
          <input
            name="endTime"
            type="time"
            required
            defaultValue={defaults.endTime}
            className={INPUT}
          />
        </Field>
      </div>

      <fieldset className="rounded-2xl bg-fuchsia-50 p-3 ring-2 ring-fuchsia-100">
        <legend className="px-1 font-display font-semibold text-fuchsia-900">
          Ranks in this open play
        </legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => {
            const on = levels.includes(l);
            return (
              <label
                key={l}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full py-1 pr-4 pl-2 font-semibold ring-2 transition-colors ${on ? `${LEVEL_INFO[l].tone} ring-fuchsia-400` : "bg-white text-ink/60 ring-ink/10 hover:ring-fuchsia-200"}`}
              >
                <input
                  type="checkbox"
                  name="levels"
                  value={l}
                  checked={on}
                  onChange={() =>
                    setLevels((ls) =>
                      on ? ls.filter((x) => x !== l) : [...ls, l],
                    )
                  }
                  className="size-5 accent-fuchsia-500"
                />
                {LEVEL_INFO[l].label}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-sm font-semibold text-fuchsia-900/80">
          {levels.length
            ? `${ranksLabel({ levels: LEVELS.filter((l) => levels.includes(l)) })}: each rank gets its own queue, and you choose which rank plays on each court.`
            : "Tick at least one rank."}
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Max pairs (optional)">
          <input
            name="maxPairs"
            type="number"
            inputMode="numeric"
            min={2}
            max={MAX_PAIRS}
            placeholder="No limit"
            defaultValue={defaults.maxPairs ?? undefined}
            className={INPUT}
          />
        </Field>
        <Field label="Entry per pair (shown to players)">
          <input
            name="fee"
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            required
            defaultValue={defaults.fee || undefined}
            placeholder="e.g. 300"
            className={INPUT}
          />
        </Field>
      </div>
    </>
  );
}

/** Regular (names only) or Ranked (shared record). Fixed once created. */
function KindField() {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-bold text-ink/60">
        Type of open play
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPEN_PLAY_KINDS.map((k, i) => (
          <label
            key={k}
            className="flex cursor-pointer flex-col gap-1 rounded-2xl bg-white p-3 ring-2 ring-ink/10 has-checked:bg-fuchsia-50 has-checked:ring-fuchsia-400"
          >
            <span className="flex items-center gap-2 font-display text-lg font-bold">
              <input
                type="radio"
                name="kind"
                value={k}
                defaultChecked={i === 0}
                className="size-5 accent-fuchsia-500"
              />
              {KIND_INFO[k].label}
            </span>
            <span className="text-sm text-ink/60">{KIND_INFO[k].blurb}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
