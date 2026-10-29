"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deletePhoto, uploadPhoto, type FormState } from "@/app/actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { resizeImage } from "@/components/ui/resize-image";
import { PHOTO } from "@/lib/profile/forms";

/** Shrink the picked image to a WebP that fits the upload limit. */
const resize = (file: File) =>
  resizeImage(file, { maxSide: PHOTO.maxSide, maxBytes: PHOTO.maxBytes });

export function PhotoForm({
  playerId,
  name,
  src,
}: {
  playerId: string;
  name: string;
  src: string | null;
}) {
  const [state, upload, uploading] = useActionState<FormState, FormData>(
    uploadPhoto,
    { error: null },
  );
  const [preview, setPreview] = useState<string | null>(null);
  // A picked photo waits here until it's confirmed: it replaces the old one.
  const [picked, setPicked] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [, startUpload] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    try {
      const blob = await resize(file);
      setPreview(URL.createObjectURL(blob));
      setPicked(new File([blob], "photo.webp", { type: blob.type }));
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Couldn't read that image",
      );
    } finally {
      for (const el of [input.current, camera.current]) if (el) el.value = "";
    }
  }

  function save() {
    if (!picked) return;
    const form = new FormData();
    form.set("playerId", playerId);
    form.set("photo", picked);
    setPicked(null);
    startUpload(() => upload(form));
  }

  function discard() {
    setPicked(null);
    setPreview(null);
  }

  const error = localError ?? state.error;
  const shown = state.error ? src : (preview ?? src);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={shown} size="xl" />
      <div className="flex flex-col gap-2">
        <input
          ref={input}
          id="photo-input"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {/* Opens the camera on phones and tablets, e.g. at the booth. */}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="user"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button
          variant="secondary"
          disabled={uploading}
          onClick={() => camera.current?.click()}
        >
          <span aria-hidden>🤳</span> Take photo
        </Button>
        <Button
          variant="secondary"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <span aria-hidden>🖼️</span>{" "}
          {uploading ? "Uploading…" : "Choose a photo"}
        </Button>
        {picked && (
          <span className="flex flex-wrap items-center gap-2 rounded-2xl bg-rose-50 p-2">
            <span className="text-sm font-semibold text-rose-800">
              {src ? "Replace the current photo?" : "Use this photo?"}
            </span>
            <Button variant="lime" onClick={save}>
              ✓ Save photo
            </Button>
            <Button variant="ghost" onClick={discard}>
              Cancel
            </Button>
          </span>
        )}
        {src && !preview && (
          <ConfirmButton
            label="Remove photo"
            onConfirm={() => startRemove(() => deletePhoto(playerId))}
            className="min-h-11 px-4 text-sm text-ink/55 hover:bg-ink/5"
          >
            {removing ? "Removing…" : "Remove photo"}
          </ConfirmButton>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-rose-600">
            {error}
          </p>
        )}
        {state.ok && !uploading && !picked && (
          <p role="status" className="text-sm font-semibold text-lime-700">
            ✓ Photo saved
          </p>
        )}
      </div>
    </div>
  );
}
