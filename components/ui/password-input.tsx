"use client";

import { useState } from "react";

/**
 * A password field with a Show / Hide button, so people can check what
 * they typed. Takes the same props as an `<input>`.
 */
export function PasswordInput({
  className = "",
  ...input
}: Omit<React.ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative flex">
      <input
        {...input}
        type={shown ? "text" : "password"}
        autoCapitalize="none"
        spellCheck={false}
        className={`${className} w-full pr-20`}
      />
      <button
        type="button"
        aria-controls={input.id}
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-1 right-1 min-w-16 rounded-xl px-2 text-sm font-bold text-fuchsia-600 hover:bg-fuchsia-50 focus-visible:outline-2 focus-visible:outline-sky-400"
      >
        {shown ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </span>
  );
}
