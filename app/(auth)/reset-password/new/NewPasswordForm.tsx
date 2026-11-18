"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setNewPassword, type NewPasswordState } from "../actions";

const initialState: NewPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? "Saving..." : "Set new password"}
    </Button>
  );
}

export function NewPasswordForm() {
  const [state, formAction] = useActionState(setNewPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        New{" "}
        <em
          className="font-display italic"
          style={{ color: "var(--oxblood)" }}
        >
          password
        </em>
      </h1>
      <p className="text-sm text-muted-foreground">
        Pick something at least 8 characters long.
      </p>
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
          autoComplete="new-password"
        />
      </div>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
