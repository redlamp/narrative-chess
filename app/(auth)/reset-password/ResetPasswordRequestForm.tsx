"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  type ResetRequestState,
} from "./actions";

const initialState: ResetRequestState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Sending..." : "Send reset link"}
    </Button>
  );
}

export function ResetPasswordRequestForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        Reset{" "}
        <em
          className="font-display italic"
          style={{ color: "var(--oxblood)" }}
        >
          password
        </em>
      </h1>
      <p className="text-sm text-muted-foreground">
        Enter the email you signed up with. We&apos;ll send a link to set a
        new password.
      </p>
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
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.sent ? (
        <p className="text-sm text-foreground" role="status">
          If that email is on file, a reset link is on its way.
        </p>
      ) : (
        <SubmitButton />
      )}
      <p className="text-sm text-center text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
