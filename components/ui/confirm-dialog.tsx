"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Modal } from "./modal";

/**
 * The one confirmation popup: a question, an optional warning, and Go back
 * or the action. Used by ConfirmSubmit (saves) and ConfirmButton (removes).
 */
export function ConfirmDialog({
  title,
  warning,
  confirmText,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  warning?: ReactNode;
  confirmText: ReactNode;
  /** Removing or ending something: a red header and button. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      eyebrow="Please confirm"
      tone={danger ? "from-rose-500 to-fuchsia-500" : undefined}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Go back
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      {warning && <p className="px-5 pt-4 text-ink/70">{warning}</p>}
    </Modal>
  );
}
