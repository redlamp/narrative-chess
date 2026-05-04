"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
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

export interface SignUpFormProps {
  /**
   * Called after a successful sign-up when the form is mounted outside the
   * normal page shell (e.g. inside a dialog). When omitted the server action
   * performs its own redirect, so no client-side navigation is needed.
   */
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (prev: SignUpState, formData: FormData) => {
      const result = await signUp(prev, formData);
      // If the action returned (i.e. no server-side redirect happened) and
      // there is no error, treat it as success and invoke the callback.
      if (!result.error) {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push("/games");
        }
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Sign up</h1>
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
      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
