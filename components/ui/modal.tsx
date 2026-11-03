"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** Matches `modal-out` in globals.css. */
const CLOSE_MS = 180;

/** A beat between the card and each part of its content. */
const delay = (ms: number) => ({ "--modal-delay": `${ms}ms` }) as CSSProperties;

/**
 * Native modal dialog: traps focus, closes on Escape or a backdrop click.
 * Render it only while open; mount with a `key` to reset its contents.
 * The whole card animates in (and out on Escape, the backdrop, or ×), so
 * it never shows as an empty white box; motion styles live in globals.css.
 */
export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  footer,
  tone = "from-sky-400 to-violet-500",
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Header gradient classes. */
  tone?: string;
  /** Room for a form: max-w-xl instead of max-w-md. */
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Play the exit, then let the parent unmount it.
  const requestClose = useCallback(() => {
    if (timer.current) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return onClose();
    setClosing(true);
    timer.current = setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => () => clearTimeout(timer.current), []);

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
      data-closing={closing || undefined}
      onClose={onClose}
      onCancel={(e) => {
        // Escape: animate out instead of vanishing.
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget) requestClose();
      }}
      className={`modal m-auto max-h-[85dvh] w-[calc(100%-2rem)] ${wide ? "max-w-xl" : "max-w-md"} overflow-hidden rounded-[2rem] bg-white p-0 text-ink shadow-[0_30px_80px_-20px_rgba(36,28,71,0.5)] backdrop:bg-ink/40 backdrop:backdrop-blur-sm`}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header
          className={`flex items-start justify-between gap-3 bg-gradient-to-br px-5 pt-5 pb-4 text-white ${tone}`}
        >
          <div className="modal-rise min-w-0" style={delay(40)}>
            {eyebrow && (
              <p className="text-xs font-bold tracking-widest uppercase opacity-80">
                {eyebrow}
              </p>
            )}
            <h2
              id="modal-title"
              className="line-clamp-2 font-display text-2xl font-bold break-words"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl hover:bg-white/30"
          >
            ×
          </button>
        </header>
        <div
          className="modal-rise flex min-h-0 flex-1 flex-col"
          style={delay(90)}
        >
          {children}
        </div>
        {footer && (
          <footer
            className="modal-rise flex justify-end gap-2 border-t border-ink/5 p-4"
            style={delay(140)}
          >
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
