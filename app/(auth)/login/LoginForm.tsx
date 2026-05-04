"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Logging in..." : "Log in"}
    </Button>
  );
}

/**
 * Server-action signature accepted by LoginForm. Page shell uses the default
 * redirecting `login` action; AuthDialog passes `loginNoRedirect` and an
 * `onSuccess` callback that closes the dialog + navigates client-side.
 */
type LoginAction = (
  prev: LoginState,
  formData: FormData,
) => Promise<LoginState>;

export interface LoginFormProps {
  /**
   * Server action to invoke. Defaults to the page-shell `login` action which
   * redirects to "/" on success and never returns. AuthDialog passes
   * `loginNoRedirect`, which returns and lets `onSuccess` fire.
   */
  action?: LoginAction;
  /**
   * Called after a successful login when `action` returns instead of
   * redirecting. AuthDialog uses this to close the dialog and push /games.
   */
  onSuccess?: () => void;
}

export function LoginForm({ action = login, onSuccess }: LoginFormProps) {
  const [state, formAction] = useActionState(
    async (prev: LoginState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result.error && onSuccess) {
        onSuccess();
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Log in</h1>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
      <p className="text-sm text-center text-muted-foreground">
        No account?{" "}
        <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
