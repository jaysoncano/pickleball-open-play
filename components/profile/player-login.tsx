"use client";

import { useState } from "react";
import { playerSignIn } from "@/app/actions";
import { PasswordSignIn } from "@/components/ui/password-sign-in";
import { ClaimFlow } from "./claim-flow";

/** Players: username and password, or a 6-digit email code. */
export function PlayerLogin({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "code">("password");
  return (
    <div className="mt-4">
      <div
        role="radiogroup"
        aria-label="How to sign in"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-ink/5 p-1"
      >
        {(
          [
            ["password", "🔑 Password"],
            ["code", "✉️ Email code"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={`min-h-11 rounded-xl font-display font-semibold ${mode === value ? "bg-white shadow ring-2 ring-fuchsia-400" : "text-ink/60 hover:bg-white/60"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "password" ? (
        <>
          <PasswordSignIn action={playerSignIn} next={next} />
          <p className="mt-3 text-center text-sm text-ink/55">
            No password yet, or forgot it?{" "}
            <button
              type="button"
              onClick={() => setMode("code")}
              className="font-semibold text-fuchsia-600 underline"
            >
              Sign in with an email code
            </button>
            , then set one on your profile.
          </p>
        </>
      ) : (
        <ClaimFlow next={next} />
      )}
    </div>
  );
}
