"use client";

import { login } from "@/app/actions";
import { PasswordSignIn } from "@/components/ui/password-sign-in";

export function LoginForm() {
  return <PasswordSignIn action={login} />;
}
