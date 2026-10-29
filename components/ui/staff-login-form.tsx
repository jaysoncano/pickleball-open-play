"use client";

import { loginAdmin, loginHost } from "@/app/actions";
import { PasswordSignIn } from "@/components/ui/password-sign-in";

export function HostLoginForm() {
  return <PasswordSignIn action={loginHost} />;
}

export function AdminLoginForm() {
  return <PasswordSignIn action={loginAdmin} />;
}
