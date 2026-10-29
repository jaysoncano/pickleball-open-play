"use client";

import {
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Submit for saves that change or replace data. The tap checks the form,
 * then asks in a popup; confirming submits it. Pressing Enter in a field
 * counts as a tap, so it can't save by accident either.
 */
export function ConfirmSubmit({
  children,
  confirmLabel = "Save these changes?",
  warning,
  confirmText,
  onClick,
  className = "",
  ...button
}: Omit<ComponentProps<typeof Button>, "type" | "children"> & {
  children: ReactNode;
  /** The popup's question, e.g. "Save the venue?". */
  confirmLabel?: string;
  /** Shown under the question. */
  warning?: ReactNode;
  /** The popup's confirm button; defaults to this button's own text. */
  confirmText?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const self = useRef<HTMLButtonElement>(null);
  // Set while the confirmed click goes through to the form.
  const confirmed = useRef(false);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmed.current) {
      confirmed.current = false;
      onClick?.(event);
      return;
    }
    event.preventDefault();
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;
    setAsking(true);
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <Button {...button} ref={self} type="submit" onClick={handleClick}>
        {children}
      </Button>
      {asking && (
        <ConfirmDialog
          title={confirmLabel}
          warning={warning}
          confirmText={confirmText ?? children}
          danger={button.variant === "danger"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            confirmed.current = true;
            self.current?.click();
          }}
        />
      )}
    </span>
  );
}
