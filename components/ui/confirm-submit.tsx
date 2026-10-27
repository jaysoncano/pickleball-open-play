"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button } from "./button";

const RESET_AFTER_MS = 5000;

/**
 * Two-tap submit for saves that change or replace data. The first tap
 * checks the form and asks to confirm; the second submits it. Pressing
 * Enter in a field counts as a tap, so it can't save by accident either.
 * Disarms itself after a few seconds or when focus leaves.
 */
export function ConfirmSubmit({
  children,
  confirmLabel = "Tap again to save",
  warning = "This can't be undone.",
  onClick,
  className = "",
  ...button
}: Omit<ComponentProps<typeof Button>, "type" | "children"> & {
  children: ReactNode;
  confirmLabel?: ReactNode;
  /** Shown next to the armed button. Empty to hide it. */
  warning?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    clearTimeout(timer.current);
    if (armed) {
      setArmed(false);
      onClick?.(event);
      return;
    }
    event.preventDefault();
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), RESET_AFTER_MS);
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        {...button}
        type="submit"
        variant={armed ? "danger" : button.variant}
        onClick={handleClick}
        onBlur={() => setArmed(false)}
      >
        {armed ? confirmLabel : children}
      </Button>
      {armed && warning && (
        <span role="status" className="text-sm font-semibold text-rose-600">
          {warning}
        </span>
      )}
    </span>
  );
}
