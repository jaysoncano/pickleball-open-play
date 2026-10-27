import Image from "next/image";
import { LOGO_DATA_URI } from "@/lib/logo";

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const large = size === "lg";
  return (
    <div className="flex items-center gap-2.5">
      {/* Same mark as the favicon (app/icon.svg). */}
      <Image
        src={LOGO_DATA_URI}
        alt=""
        aria-hidden
        width={large ? 56 : 40}
        height={large ? 56 : 40}
        unoptimized
        priority
        className={large ? "size-14" : "size-10"}
      />
      <span className="leading-none">
        <span
          className={`block font-display font-bold tracking-tight ${large ? "text-3xl" : "text-xl"}`}
        >
          P<span className="text-lime-500">O</span>
          <span className="text-fuchsia-500">P</span>
        </span>
        <span className="text-xs font-semibold tracking-widest text-ink/50 uppercase">
          Pickleball open play
        </span>
      </span>
    </div>
  );
}
