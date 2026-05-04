"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoginForm } from "./(auth)/login/LoginForm";
import { SignUpForm } from "./(auth)/sign-up/SignUpForm";
import { loginNoRedirect } from "./(auth)/login/actions";
import { signUpNoRedirect } from "./(auth)/sign-up/actions";

type Mode = "signin" | "signup";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: Mode;
};

export function AuthDialog({ open, onOpenChange, initialMode = "signin" }: Props) {
  const router = useRouter();
  // Use `key={initialMode}` on the content so the internal mode state resets
  // correctly whenever the caller (AuthHeader) switches between Sign in / Sign up.
  const [mode, setMode] = useState<Mode>(initialMode);

  // The forms invoke the no-redirect action variants, so this fires on success
  // (the redirecting variants throw NEXT_REDIRECT and never return).
  const onSuccess = () => {
    onOpenChange(false);
    router.push("/games");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Sign in" : "Sign up"}</DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Welcome back. Sign in to continue."
              : "Create an account to start playing."}
          </DialogDescription>
        </DialogHeader>
        {mode === "signin" ? (
          <LoginForm action={loginNoRedirect} onSuccess={onSuccess} />
        ) : (
          <SignUpForm action={signUpNoRedirect} onSuccess={onSuccess} />
        )}
        <p className="text-xs text-center text-muted-foreground">
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
