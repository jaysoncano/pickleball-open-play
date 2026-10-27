"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const RESET_AFTER_MS = 3000;

/**
 * Two-tap button for destructive actions: the first tap arms it, the second
 * confirms. Disarms itself after a few seconds. Avoids blocking dialogs.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Sure?",
  onConfirm,
  label,
  className = "",
  armedClassName = "",
}: {
  children: ReactNode;
  confirmLabel?: ReactNode;
  onConfirm: () => void;
  /** Accessible name, e.g. "Remove Ana". */
  label: string;
  className?: string;
  armedClassName?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleClick() {
    clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), RESET_AFTER_MS);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onBlur={() => setArmed(false)}
      aria-label={armed ? `Confirm: ${label}` : label}
      className={`relative inline-flex items-center justify-center rounded-full font-display font-semibold transition-all duration-150 after:absolute after:-inset-1.5 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${armed ? `bg-rose-500 px-3 text-white ${armedClassName}` : className}`}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
