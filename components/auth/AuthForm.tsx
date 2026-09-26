"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { signIn, signUp, type AuthState } from "@/lib/auth/actions";

export function AuthForm({ mode, notice }: { mode: "login" | "signup"; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, {});
  const isLogin = mode === "login";

  return (
    <form action={action} className="space-y-4">
      <h1 className="text-3xl font-semibold">{isLogin ? "Log in" : "Create your account"}</h1>
      {notice && <p className="rounded-xl bg-brand-soft p-3 text-sm">{notice}</p>}
      <Field label="Email">
        <TextInput name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" hint={isLogin ? undefined : "At least 8 characters"}>
        <TextInput name="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={8} />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.message && <p className="text-sm text-brand">{state.message}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "One sec…" : isLogin ? "Log in" : "Sign up"}
      </Button>
      <p className="text-sm text-muted">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link className="text-brand underline" href={isLogin ? "/signup" : "/login"}>
          {isLogin ? "Create an account" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
