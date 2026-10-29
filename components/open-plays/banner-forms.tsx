"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { saveOpenPlayBanner, type FormState } from "@/app/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { resizeImage } from "@/components/ui/resize-image";
import { BANNER } from "@/lib/banner";
import type { OpenPlay } from "@/lib/db/queries";
import { PlayBanner } from "./play-banner";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

type BannerPlay = Pick<OpenPlay, "id" | "bannerUpdatedAt" | "venue">;

/**
 * Pick a banner: the browser shrinks it to fit the upload limit, swaps it
 * into the form's `banner` input, and previews it on the banner.
 */
export function BannerField({ play }: { play: BannerPlay }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return setPreview(null);
    try {
      const blob = await resizeImage(file, {
        maxSide: BANNER.maxWidth,
        maxBytes: BANNER.maxBytes,
      });
      const files = new DataTransfer();
      files.items.add(new File([blob], "banner.webp", { type: blob.type }));
      input.current!.files = files.files;
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      input.current!.value = "";
      setPreview(null);
      setError(e instanceof Error ? e.message : "Couldn't read that image");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <PlayBanner
        play={play}
        preview={preview}
        className="h-28 rounded-2xl sm:h-36"
      >
        <label className="flex h-full cursor-pointer items-center justify-center">
          <span className="rounded-full bg-white/90 px-4 py-2 font-display font-semibold shadow-sm ring-2 ring-white transition-colors hover:bg-white">
            <span aria-hidden>🖼️</span>{" "}
            {preview || play.bannerUpdatedAt ? "Change banner" : "Add a banner"}
          </span>
          <input
            ref={input}
            name="banner"
            type="file"
            accept={BANNER.types.join(",")}
            onChange={(e) => pick(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
      </PlayBanner>
      <p className="text-sm text-ink/60">
        Wide photos work best (about 3:1), like your courts or your crew.
        Without one, players see a colorful court placeholder.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Its hosts: change or remove an open play's banner. */
export function BannerForm({ play }: { play: BannerPlay }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    saveOpenPlayBanner,
    { error: null },
  );
  const [removing, startRemove] = useTransition();

  function remove() {
    const form = new FormData();
    form.set("openPlayId", play.id);
    form.set("removeBanner", "1");
    startRemove(() => action(form));
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="openPlayId" value={play.id} />
      {/* Remount after a save, so the field shows the saved banner. */}
      <BannerField key={String(play.bannerUpdatedAt)} play={play} />
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      ) : (
        state.message && (
          <p role="status" className="text-sm font-semibold text-lime-700">
            ✓ {state.message}
          </p>
        )
      )}
      <div className="flex flex-wrap gap-2">
        <ConfirmSubmit confirmLabel="Replace banner?" disabled={pending}>
          {pending && !removing ? "Saving…" : "Save banner"}
        </ConfirmSubmit>
        {play.bannerUpdatedAt && (
          <ConfirmButton
            label="Remove the banner"
            onConfirm={remove}
            className="min-h-11 rounded-2xl px-4 font-semibold text-ink/60 ring-2 ring-ink/10 hover:text-rose-600"
          >
            Remove banner
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}
