"use client";

import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Button for destructive actions: the tap asks in a popup ("Remove Ana?"),
 * and only confirming does it.
 */
export function ConfirmButton({
  children,
  onConfirm,
  label,
  warning,
  confirmText,
  className = "",
}: {
  children: ReactNode;
  onConfirm: () => void;
  /** Accessible name and the popup's question, e.g. "Remove Ana". */
  label: string;
  /** Shown under the question. */
  warning?: ReactNode;
  /** The popup's button; defaults to the label's first word ("Remove"). */
  confirmText?: ReactNode;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-label={label}
        className={`relative inline-flex items-center justify-center rounded-full font-display font-semibold transition-all duration-150 after:absolute after:-inset-1.5 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${className}`}
      >
        {children}
      </button>
      {asking && (
        <ConfirmDialog
          danger
          title={`${label}?`}
          warning={warning}
          confirmText={confirmText ?? label.split(" ")[0]}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onConfirm();
          }}
        />
      )}
    </>
  );
}
