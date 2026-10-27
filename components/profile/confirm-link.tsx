"use client";

import { useActionState } from "react";
import { confirmEmailLink, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ConfirmLink({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    confirmEmailLink,
    { error: null },
  );
  return (
    <form action={action} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Confirming…" : "Confirm & update my profile"}
      </Button>
    </form>
  );
}
