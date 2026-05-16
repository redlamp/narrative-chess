"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Creating account..." : "Sign up"}
    </Button>
  );
}

/**
 * Server-action signature accepted by SignUpForm. Page shell uses the default
 * redirecting `signUp` action; AuthDialog passes `signUpNoRedirect` and an
 * `onSuccess` callback that closes the dialog + navigates client-side.
 */
type SignUpAction = (
  prev: SignUpState,
  formData: FormData,
) => Promise<SignUpState>;

export interface SignUpFormProps {
  /**
   * Server action to invoke. Defaults to the page-shell `signUp` action which
   * redirects to "/" on success and never returns. AuthDialog passes
   * `signUpNoRedirect`, which returns and lets `onSuccess` fire.
   */
  action?: SignUpAction;
  /**
   * Called after a successful sign-up when `action` returns instead of
   * redirecting. AuthDialog uses this to close the dialog and push /games.
   */
  onSuccess?: () => void;
}

export function SignUpForm({ action = signUp, onSuccess }: SignUpFormProps) {
  const [state, formAction] = useActionState(
    async (prev: SignUpState, formData: FormData) => {
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
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        Sign{" "}
        <em
          className="font-display italic"
          style={{ color: "var(--oxblood)" }}
        >
          up
        </em>
      </h1>
      <div className="space-y-2">
        <Label htmlFor="inviteCode">Invite code</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          type="text"
          placeholder="ABCD2345"
          required
          pattern="[A-Za-z2-7]{8}"
          minLength={8}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono tracking-widest uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Eight characters. Ask Taylor for one if you don&apos;t have it yet.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          placeholder="Your name"
          required
          maxLength={60}
        />
      </div>
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
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Min 8 characters"
          required
          minLength={8}
          maxLength={72}
        />
      </div>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
      <p className="text-xs text-center text-muted-foreground">
        By signing up you agree to the{" "}
        <Link
          href="/terms"
          target="_blank"
          className="text-primary underline-offset-4 hover:underline"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="text-primary underline-offset-4 hover:underline"
        >
          Privacy
        </Link>{" "}
        notice.
      </p>
      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
