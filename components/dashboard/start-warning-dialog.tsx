import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { StartWarning } from "@/lib/queue/heads-up";

/**
 * Before a game starts with too little time left: how long a game takes
 * here, how long is left, and who's behind on games. The host can start
 * anyway, add time, or go back and seat someone else.
 */
export function StartWarningDialog({
  courtLabel,
  warning,
  endLabel,
  onStart,
  onEditTime,
  onClose,
}: {
  courtLabel: string;
  warning: StartWarning;
  /** "8:00 PM": when the session ends. */
  endLabel: string;
  onStart: () => void;
  onEditTime: () => void;
  onClose: () => void;
}) {
  const { minutesLeft, gameMinutes, behind } = warning;
  return (
    <Modal
      title={
        minutesLeft === 0
          ? "Session time is up"
          : `Only ${minutesLeft} min left`
      }
      eyebrow={`Before ${courtLabel} starts`}
      tone="from-amber-400 to-rose-500"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Go back
          </Button>
          <Button variant="secondary" onClick={onEditTime}>
            ⏱ Add time
          </Button>
          <Button onClick={onStart}>▶ Start anyway</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 px-5 py-4 text-ink/75">
        <p>
          A game here takes about <b>{gameMinutes} min</b>
          {minutesLeft === 0 ? (
            <>, and the session ended at {endLabel}.</>
          ) : (
            <>
              , so this one may not finish before <b>{endLabel}</b>.
            </>
          )}
        </p>
        {behind.length > 0 && (
          <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm ring-2 ring-amber-200">
            <p className="font-bold text-amber-900">
              ⚖️ Keep games even: {behind.length} waiting{" "}
              {behind.length === 1 ? "has" : "have"} played fewer games
            </p>
            <p className="mt-0.5 text-amber-900/80">
              {behind.join(", ")}. Consider swapping them onto this court first.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
