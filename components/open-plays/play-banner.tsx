import type { ReactNode } from "react";
import { bannerUrl, placeholderTheme } from "@/lib/banner";
import type { OpenPlay } from "@/lib/db/queries";

/**
 * The open play's banner, or a colorful court-themed placeholder (its
 * colors are stable per open play). Children sit on top of it.
 */
export function PlayBanner({
  play,
  className = "h-28 sm:h-32",
  preview,
  children,
}: {
  play: Pick<OpenPlay, "id" | "bannerUpdatedAt" | "venue">;
  className?: string;
  /** A picked image not uploaded yet: shown instead. */
  preview?: string | null;
  children?: ReactNode;
}) {
  const src = preview ?? bannerUrl(play.id, play.bannerUpdatedAt);
  const theme = placeholderTheme(play.id);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={src ? undefined : { background: theme.background }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <Placeholder ink={theme.ink} venue={play.venue} />
      )}
      {/* Keeps chips readable on any photo. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/10"
      />
      {children && <div className="relative h-full">{children}</div>}
    </div>
  );
}

/** Court lines, a ball pattern, and a big paddle: no upload needed. */
function Placeholder({ ink, venue }: { ink: string; venue: string }) {
  return (
    <div aria-hidden className="absolute inset-0" style={{ color: ink }}>
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 2px, transparent 2.5px)",
          backgroundSize: "18px 18px",
        }}
      />
      {/* Kitchen line and center line, like a court seen from above. */}
      <div className="absolute inset-y-0 left-1/2 w-1 bg-white/50" />
      <div className="absolute inset-x-0 top-1/2 h-1 bg-white/50" />
      <div className="absolute inset-3 rounded-xl border-4 border-white/50" />
      <span className="absolute -right-2 -bottom-6 rotate-12 text-8xl opacity-40 select-none">
        🏓
      </span>
      {venue && (
        <span className="absolute bottom-3 left-4 max-w-[70%] truncate font-display text-lg font-bold opacity-60">
          {venue}
        </span>
      )}
    </div>
  );
}
