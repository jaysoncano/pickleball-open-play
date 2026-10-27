/** Soft color blobs behind every screen. Decorative only. */
export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
    >
      <div className="absolute -top-24 -left-20 size-80 rounded-full bg-lime-300/50 blur-3xl" />
      <div className="absolute top-1/3 -right-24 size-96 rounded-full bg-fuchsia-300/40 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 size-96 rounded-full bg-sky-300/40 blur-3xl" />
      <div className="absolute top-10 right-1/4 size-40 rounded-full bg-amber-200/60 blur-2xl" />
    </div>
  );
}
