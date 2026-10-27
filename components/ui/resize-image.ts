/**
 * Shrink a picked image to a WebP whose longest side is at most `maxSide`
 * and that fits `maxBytes`, lowering quality as needed. Browser only.
 */
export async function resizeImage(
  file: File,
  { maxSide, maxBytes }: { maxSide: number; maxBytes: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, "image/webp", quality),
    );
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error("That image is too big even after shrinking");
}
