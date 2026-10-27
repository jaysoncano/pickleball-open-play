"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Native modal dialog: traps focus, closes on Escape or a backdrop click.
 * Render it only while open; mount with a `key` to reset its contents.
 */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  tone = "from-sky-400 to-violet-500",
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Header gradient classes. */
  tone?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  // No close() on cleanup: removing the element ends the modal, and a
  // close event from StrictMode's re-run would dismiss it right away.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[2rem] bg-white p-0 text-ink shadow-[0_30px_80px_-20px_rgba(36,28,71,0.5)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
    >
      <div className="animate-pop-in flex max-h-[85dvh] flex-col motion-reduce:animate-none">
        <header
          className={`flex items-start justify-between gap-3 bg-gradient-to-br px-5 pt-5 pb-4 text-white ${tone}`}
        >
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-bold tracking-widest uppercase opacity-80">
                {eyebrow}
              </p>
            )}
            <h2
              id="modal-title"
              className="truncate font-display text-2xl font-bold"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl hover:bg-white/30"
          >
            ×
          </button>
        </header>
        {children}
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-ink/5 p-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
